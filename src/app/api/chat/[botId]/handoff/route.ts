import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Chatbot, Conversation } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { appendConversationMessage, escalateToLiveAgent } from '@/lib/ai/handoff';

interface RouteParams {
  params: Promise<{ botId: string }>;
}

type ObjectIdLike = { toString(): string };

interface HandoffBot {
  _id: ObjectIdLike;
  handoff?: {
    enabled?: boolean;
    offlineMessage?: string;
  };
}

interface HandoffMessage {
  timestamp: Date | string;
}

interface HandoffConversation {
  _id: ObjectIdLike;
  status: string;
  handoffReason?: string;
  assignedAgent?: unknown;
  messages?: HandoffMessage[];
  lastMessageAt?: Date | string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (isRecord(error) && typeof error.message === 'string' && error.message) {
    return error.message;
  }
  return fallback;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-SiteBot-Preview',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * Visitor polling or checking handoff status & receiving new agent messages
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { botId } = await params;
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const afterTimestamp = searchParams.get('after');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId query parameter is required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Resolve bot
    let bot: HandoffBot | null;
    if (isUsingMemoryDb()) {
      bot = MemoryDb.findChatbotById(botId);
    } else if (mongoose.Types.ObjectId.isValid(botId)) {
      bot = await Chatbot.findById(botId).lean();
    } else {
      bot = await Chatbot.findOne({ slug: String(botId || '').toLowerCase() }).lean();
    }

    if (!bot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const resolvedBotId = bot._id.toString();

    let conv: HandoffConversation | null;
    if (isUsingMemoryDb()) {
      conv = MemoryDb.findConversation(resolvedBotId, sessionId);
    } else {
      const botObjId = new mongoose.Types.ObjectId(resolvedBotId);
      conv = await Conversation.findOne({ botId: botObjId, sessionId }).lean();
    }

    if (!conv) {
      return NextResponse.json(
        {
          status: 'bot',
          assignedAgent: null,
          messages: [],
        },
        { headers: CORS_HEADERS }
      );
    }

    // Filter messages after the given timestamp if specified
    let newMessages = conv.messages || [];
    if (afterTimestamp) {
      const afterDate = new Date(afterTimestamp);
      if (!isNaN(afterDate.getTime())) {
        newMessages = newMessages.filter(
          (m) => new Date(m.timestamp).getTime() > afterDate.getTime()
        );
      }
    }

    return NextResponse.json(
      {
        status: conv.status,
        handoffReason: conv.handoffReason,
        assignedAgent: conv.assignedAgent || null,
        messages: newMessages,
        lastMessageAt: conv.lastMessageAt,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error: unknown) {
    console.error('Handoff status check failure:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to check handoff status') },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

/**
 * Visitor requests a live agent handoff or sends a message while in handoff
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { botId } = await params;
    const rawBody: unknown = await req.json().catch(() => ({}));
    const body = isRecord(rawBody) ? rawBody : {};
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    const visitorName =
      typeof body.visitorName === 'string' ? body.visitorName : undefined;
    const visitorEmail =
      typeof body.visitorEmail === 'string' ? body.visitorEmail : undefined;
    const visitorPhone =
      typeof body.visitorPhone === 'string' ? body.visitorPhone : undefined;
    const reason =
      typeof body.reason === 'string' ? body.reason : 'visitor_request';
    const message = typeof body.message === 'string' ? body.message : '';

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Resolve bot
    let bot: HandoffBot | null;
    if (isUsingMemoryDb()) {
      bot = MemoryDb.findChatbotById(botId);
    } else if (mongoose.Types.ObjectId.isValid(botId)) {
      bot = await Chatbot.findById(botId).lean();
    } else {
      bot = await Chatbot.findOne({ slug: String(botId || '').toLowerCase() }).lean();
    }

    if (!bot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const resolvedBotId = bot._id.toString();

    // Check if handoff is enabled on this bot
    if (bot.handoff && bot.handoff.enabled === false) {
      return NextResponse.json(
        {
          error:
            bot.handoff.offlineMessage ||
            'Live agent support is currently unavailable for this bot. Please use our contact channels.',
          available: false,
        },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // Escalate to live agent
    const conv = await escalateToLiveAgent(resolvedBotId, sessionId, reason, {
      name: visitorName,
      email: visitorEmail,
      phone: visitorPhone,
    });

    // If a user message accompanied the request, append it
    if (message && typeof message === 'string' && message.trim()) {
      await appendConversationMessage(resolvedBotId, sessionId, {
        role: 'user',
        content: message.trim(),
        senderName: visitorName || 'Visitor',
      });
    }

    // Append system escalation notice
    await appendConversationMessage(resolvedBotId, sessionId, {
      role: 'system',
      content: `Live handoff requested (${reason}). A human support representative has been alerted.`,
    });

    return NextResponse.json(
      {
        success: true,
        status: 'waiting_agent',
        message:
          'You are now connected to the live agent queue. A representative will be with you shortly.',
        conversationId: conv._id,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error: unknown) {
    console.error('Handoff escalation failure:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to escalate to live agent') },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
