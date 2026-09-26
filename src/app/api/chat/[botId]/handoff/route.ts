import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Chatbot, Conversation, ChatTicket } from '@/lib/models';
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
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
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

    let activeTicket: any = null;
    if (!isUsingMemoryDb()) {
      try {
        activeTicket = await ChatTicket.findOne({
          sessionId,
          status: { $in: ['open', 'waiting_admin', 'admin_replied'] },
        }).sort({ updatedAt: -1 }).lean();
      } catch {
        // non-fatal
      }
    }

    let conv: any = null;
    if (isUsingMemoryDb()) {
      conv = MemoryDb.findConversation(resolvedBotId, sessionId);
    } else {
      const botObjId = mongoose.Types.ObjectId.isValid(resolvedBotId)
        ? new mongoose.Types.ObjectId(resolvedBotId)
        : null;
      conv = await Conversation.findOne({
        $or: [
          { sessionId },
          ...(botObjId ? [{ botId: botObjId, sessionId }] : []),
        ],
      }).sort({ updatedAt: -1 }).lean();
    }

    const isConvActive = conv && (conv.status === 'waiting_agent' || conv.status === 'agent_active');
    const isTicketActive = activeTicket && (activeTicket.status === 'open' || activeTicket.status === 'waiting_admin' || activeTicket.status === 'admin_replied');

    if (!isConvActive && !isTicketActive) {
      return NextResponse.json(
        {
          status: 'bot',
          assignedAgent: null,
          messages: [],
        },
        { headers: CORS_HEADERS }
      );
    }

    // Keep Baileys socket actively warm in background during live handoff sessions
    try {
      const { getWhatsAppStatus } = await import('@/lib/whatsapp/baileysManager');
      getWhatsAppStatus().catch(() => {});
    } catch {}

    // Merge messages from Conversation and ChatTicket to ensure 100% delivery of WhatsApp replies
    const mergedMap = new Map<string, any>();

    if (conv && Array.isArray(conv.messages)) {
      for (const m of conv.messages) {
        if (!m || !m.content) continue;
        const key = `${m.role || 'agent'}:${String(m.content).trim()}`;
        mergedMap.set(key, {
          role: m.role || 'assistant',
          content: m.content,
          senderName: m.senderName,
          timestamp: m.timestamp || new Date(),
        });
      }
    }

    if (activeTicket && Array.isArray(activeTicket.messages)) {
      for (const m of activeTicket.messages) {
        if (!m || !m.content) continue;
        const key = `${m.role || 'agent'}:${String(m.content).trim()}`;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, {
            role: m.role || 'agent',
            content: m.content,
            senderName: m.senderName || 'Live Support Agent',
            timestamp: m.timestamp || new Date(),
          });
        }
      }
    }

    let newMessages = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    if (afterTimestamp) {
      const afterDate = new Date(afterTimestamp);
      if (!isNaN(afterDate.getTime())) {
        newMessages = newMessages.filter(
          (m) => new Date(m.timestamp).getTime() > afterDate.getTime()
        );
      }
    }

    let currentStatus = conv?.status || 'bot';
    if (activeTicket) {
      if (activeTicket.status === 'admin_replied') currentStatus = 'agent_active';
      else if (activeTicket.status === 'waiting_admin') currentStatus = 'waiting_agent';
      else if (activeTicket.status === 'closed') currentStatus = 'resolved';
    }

    return NextResponse.json(
      {
        status: currentStatus,
        ticketId: activeTicket?.ticketId || null,
        handoffReason: conv?.handoffReason || activeTicket?.lastUserMessage || 'visitor_request',
        assignedAgent: conv?.assignedAgent || { name: 'Support Agent' },
        messages: newMessages,
        lastMessageAt: conv?.lastMessageAt || activeTicket?.updatedAt || new Date(),
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

    // Create or locate ChatTicket for Two-Way WhatsApp Relay
    let ticketId = '';
    if (!isUsingMemoryDb()) {
      try {
        let ticket = await ChatTicket.findOne({
          sessionId,
          status: { $in: ['open', 'waiting_admin', 'admin_replied'] },
        });

        if (!ticket) {
          const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
          ticketId = `TICK-${randSuffix}`;
          ticket = await ChatTicket.create({
            ticketId,
            botId: resolvedBotId,
            botName: (bot as any)?.name || 'Rivafy Assistant',
            sessionId,
            visitor: {
              name: visitorName || 'Visitor',
              email: visitorEmail || '',
              phone: visitorPhone || '',
            },
            status: 'waiting_admin',
            lastUserMessage: message?.trim() || 'Visitor requested live agent',
            messages: message?.trim()
              ? [
                  {
                    id: crypto.randomUUID(),
                    role: 'user',
                    senderName: visitorName || 'Visitor',
                    content: message.trim(),
                    timestamp: new Date(),
                  },
                ]
              : [],
          });
        } else {
          ticketId = ticket.ticketId;
          if (message && typeof message === 'string' && message.trim()) {
            ticket.lastUserMessage = message.trim();
            ticket.messages.push({
              id: crypto.randomUUID(),
              role: 'user',
              senderName: visitorName || 'Visitor',
              content: message.trim(),
              timestamp: new Date(),
            });
            await ticket.save();
          }
        }
      } catch (ticketErr) {
        console.warn('[Handoff] Ticket initialization warning:', ticketErr);
      }
    } else {
      // Memory mode has no ChatTicket collection, but the visitor still needs
      // a reference id and the WhatsApp alert must still be delivered.
      ticketId = `TICK-${String(sessionId || '').slice(0, 6).toUpperCase()}`;
    }

    // Determine target WhatsApp number (handoff-specific first, then
    // notifications.whatsapp, then the admin fallback)
    const targetNumber =
      (bot as any)?.handoff?.whatsappEnabled && (bot as any)?.handoff?.whatsappNumber
        ? (bot as any).handoff.whatsappNumber
        : (bot as any)?.notifications?.whatsapp?.enabled && (bot as any)?.notifications?.whatsapp?.number
        ? (bot as any).notifications.whatsapp.number
        : undefined;

    // Trigger the WhatsApp alert to the agent/admin via Baileys.
    //
    // This is AWAITED and its result is reported back to the caller. It used to
    // be fire-and-forget inside a `!isUsingMemoryDb()` block while the API still
    // replied "a representative has been alerted" — so a disconnected WhatsApp
    // session was indistinguishable from a successful alert.
    let notified = false;
    let notifyError: string | undefined;
    try {
      const { sendTicketAlertToAdmin } = await import('@/lib/whatsapp/baileysManager');
      const result = await sendTicketAlertToAdmin({
        ticketId: ticketId || 'PENDING',
        botName: (bot as any)?.name || 'Rivafy Assistant',
        visitorName: visitorName || 'Visitor',
        visitorEmail,
        visitorPhone,
        userMessage: message?.trim() || 'Visitor requested human support',
        targetNumber,
      });
      notified = Boolean(result?.ok);
      if (!notified) {
        notifyError = result?.error || 'WhatsApp alert was not delivered';
        console.error(
          `[Handoff] WhatsApp alert NOT delivered (bot=${resolvedBotId}, ticket=${ticketId}, target=${targetNumber || 'admin fallback'}): ${notifyError}`
        );
      } else {
        console.log(
          `[Handoff] WhatsApp alert delivered (bot=${resolvedBotId}, ticket=${ticketId}, target=${targetNumber || 'admin fallback'})`
        );
      }
    } catch (alertErr) {
      notifyError = alertErr instanceof Error ? alertErr.message : 'Unknown WhatsApp error';
      console.error('[Handoff] WhatsApp alert dispatch failed:', alertErr);
    }

    // Append system escalation notice AFTER the send attempt, so the transcript
    // never claims an agent was alerted when the WhatsApp send actually failed.
    await appendConversationMessage(resolvedBotId, sessionId, {
      role: 'system',
      content: notified
        ? `Live handoff requested (${reason}). A human support representative has been alerted on WhatsApp.`
        : `Live handoff requested (${reason}). You are in the live agent queue. WhatsApp alerting is currently unavailable, so a representative may take a little longer to reach you.`,
    });

    return NextResponse.json(
      {
        success: true,
        status: 'waiting_agent',
        ticketId: ticketId || undefined,
        notified,
        notifiedChannels: notified ? ['whatsapp'] : [],
        notifyError,
        message: notified
          ? 'You are now connected to the live agent queue. Our team has been alerted on WhatsApp and a representative will be with you shortly.'
          : 'You are in the live agent queue and a representative will be with you shortly. If we do not respond right away, please use the contact options on this site to reach us directly.',
        conversationId: conv?._id,
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

/**
 * Visitor or Admin clears session / chat history: close tickets & resolve active conversations
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { botId } = await params;
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId query parameter is required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!isUsingMemoryDb()) {
      await ChatTicket.updateMany(
        {
          sessionId,
          status: { $in: ['open', 'waiting_admin', 'admin_replied'] },
        },
        {
          $set: {
            status: 'closed',
            closedAt: new Date(),
          },
        }
      );

      await Conversation.updateMany(
        {
          sessionId,
        },
        {
          $set: {
            status: 'resolved',
            lastMessageAt: new Date(),
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        status: 'bot',
        message: 'Active handoff session cleared and closed successfully',
      },
      { headers: CORS_HEADERS }
    );
  } catch (error: unknown) {
    console.error('Handoff DELETE session failure:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to clear session') },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
