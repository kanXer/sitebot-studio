import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Chatbot, Conversation } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { sendWhatsAppMessage } from '@/lib/whatsapp/baileysManager';

interface RouteParams {
  params: Promise<{ botId: string }>;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/** Mirrors the recipient priority already used by the handoff alert. */
function resolveTargetNumber(bot: any): string {
  const handoffNumber = bot?.handoff?.whatsappEnabled ? bot?.handoff?.whatsappNumber : '';
  if (handoffNumber && String(handoffNumber).trim()) return String(handoffNumber).trim();

  const notifyNumber = bot?.notifications?.whatsapp?.enabled
    ? bot?.notifications?.whatsapp?.number
    : '';
  if (notifyNumber && String(notifyNumber).trim()) return String(notifyNumber).trim();

  return String(process.env.NOTIFY_WHATSAPP || '').trim();
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/**
 * Fired by the widget when a visitor closes the chat, so the business gets a
 * WhatsApp ping summarising the session that just ended.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { botId } = await params;

    let bot: any;
    if (isUsingMemoryDb()) {
      bot = MemoryDb.findChatbotById(botId);
    } else if (mongoose.Types.ObjectId.isValid(botId)) {
      bot = await Chatbot.findById(botId).lean();
    }
    if (!bot) {
      bot = isUsingMemoryDb()
        ? MemoryDb.findChatbots().find((b: any) => (b.slug || '').toLowerCase() === String(botId).toLowerCase()) || null
        : mongoose.Types.ObjectId.isValid(botId)
        ? null
        : await Chatbot.findOne({ slug: String(botId || '').toLowerCase().trim() }).lean();
    }

    if (!bot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404, headers: CORS_HEADERS });
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400, headers: CORS_HEADERS });
    }

    const durationSec = Number(body.durationSec) > 0 ? Number(body.durationSec) : 0;
    const transcript: Array<{ role?: string; content?: string }> = Array.isArray(body.transcript)
      ? body.transcript
          .filter((m: any) => m && typeof m.content === 'string' && m.content.trim())
          .slice(-8)
      : [];

    // Never notify for an empty/abandoned session.
    if (transcript.length === 0) {
      return NextResponse.json({ success: true, notified: false, reason: 'empty_session' }, { headers: CORS_HEADERS });
    }

    const userMessages = transcript.filter((m) => m.role === 'user');
    const lastUserMessage = [...userMessages].reverse().find((m) => m.content?.trim())?.content?.trim() || '';

    // Guard against duplicate notifications when the widget fires twice.
    const alreadyNotified = await markSessionEndNotified(bot, sessionId);
    if (alreadyNotified) {
      return NextResponse.json({ success: true, notified: false, reason: 'already_notified' }, { headers: CORS_HEADERS });
    }

    const target = resolveTargetNumber(bot);
    if (!target) {
      return NextResponse.json(
        { success: false, notified: false, error: 'No WhatsApp number configured for this bot' },
        { headers: CORS_HEADERS }
      );
    }

    const lines = transcript.map((m) => {
      const who = m.role === 'user' ? '🧑 Visitor' : m.role === 'agent' ? '🧑‍💼 Agent' : '🤖 Bot';
      return `${who}: ${String(m.content).trim().slice(0, 300)}`;
    });

    const text =
      `💬 *Chat ended* — ${bot.name || 'Assistant'}\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `⏱ Duration: ${formatDuration(durationSec)}\n` +
      `🗨 Messages: ${transcript.length} (${userMessages.length} from visitor)\n` +
      (lastUserMessage ? `\n*Last visitor message:*\n"${lastUserMessage.slice(0, 300)}"\n` : '') +
      `\n*Transcript:*\n${lines.join('\n')}`;

    const result = await sendWhatsAppMessage(target, text);

    return NextResponse.json(
      {
        success: result.ok,
        notified: result.ok,
        error: result.ok ? undefined : result.error,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('[Chat] session-end notification error:', error);
    return NextResponse.json(
      { success: false, notified: false, error: error?.message || 'Failed to notify' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

/**
 * Returns true when this session has already been reported, and marks it as
 * reported. Uses the conversation record so a reload/refresh cannot spam the
 * business with repeated "chat ended" messages.
 */
async function markSessionEndNotified(bot: any, sessionId: string): Promise<boolean> {
  if (isUsingMemoryDb()) {
    const conv: any = MemoryDb.findConversation(String(bot._id || bot.id), sessionId);
    if (!conv) return false;
    if (conv.sessionEndNotifiedAt) return true;
    conv.sessionEndNotifiedAt = new Date().toISOString();
    return false;
  }

  try {
    const botObjectId = new mongoose.Types.ObjectId(bot._id);
    const updated = await Conversation.findOneAndUpdate(
      { botId: botObjectId, sessionId, sessionEndNotifiedAt: { $exists: false } },
      { $set: { sessionEndNotifiedAt: new Date() } },
      { new: true }
    );
    return !updated;
  } catch (err) {
    console.warn('[Chat] Could not mark session end as notified:', err);
    return false;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
