import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Chatbot, Conversation, ChatTicket } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { handoffEventEmitter, ensureConnectedWhatsApp } from '@/lib/whatsapp/baileysManager';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel maximum execution limit

interface RouteParams {
  params: Promise<{ botId: string }>;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
 * Live Server-Sent Events (SSE) Stream for Website Visitor Chat.
 * Keeps the Vercel serverless function continuously awake and listening to WhatsApp
 * while the visitor is engaged in a live handoff conversation.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { botId } = await params;
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'sessionId query parameter is required' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Ensure WhatsApp socket is alive in this container
  ensureConnectedWhatsApp('admin_primary', 5000).catch(() => {});

  const encoder = new TextEncoder();
  let isClosed = false;
  let keepAliveTimer: NodeJS.Timeout | null = null;
  let dbPollTimer: NodeJS.Timeout | null = null;
  let timeoutTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: any) => {
        if (isClosed) return;
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          cleanup();
        }
      };

      const sendComment = (comment: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`: ${comment}\n\n`));
        } catch {
          cleanup();
        }
      };

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        if (dbPollTimer) clearInterval(dbPollTimer);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        handoffEventEmitter.off(`message:${sessionId}`, onLiveMessage);
        try {
          controller.close();
        } catch {}
      };

      req.signal.addEventListener('abort', cleanup);

      // 1. Instant in-memory event dispatch when Baileys receives WhatsApp reply (<1ms)
      const onLiveMessage = (msg: any) => {
        sendEvent('message', msg);
      };
      handoffEventEmitter.on(`message:${sessionId}`, onLiveMessage);

      sendComment('stream-start');

      // 2. Active keepalive ping every 2.5s keeps the Vercel function awake
      keepAliveTimer = setInterval(() => {
        sendComment('keepalive');
      }, 2500);

      // 3. Fast DB poll every 800ms to catch messages written by daemon or another container
      let lastSeenCount = 0;
      dbPollTimer = setInterval(async () => {
        if (isClosed) return;
        try {
          await connectToDatabase();
          let ticket: any = null;
          if (!isUsingMemoryDb()) {
            ticket = await ChatTicket.findOne({
              sessionId,
              status: { $in: ['open', 'waiting_admin', 'admin_replied', 'closed'] },
            }).lean();
          }

          if (ticket) {
            if (ticket.status === 'closed') {
              sendEvent('status', { status: 'resolved' });
              cleanup();
              return;
            }

            const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
            if (messages.length > lastSeenCount) {
              const newMsgs = messages.slice(lastSeenCount);
              lastSeenCount = messages.length;
              for (const m of newMsgs) {
                if (m.role === 'agent' || m.role === 'system') {
                  sendEvent('message', {
                    role: m.role,
                    content: m.content,
                    senderName: m.senderName,
                    timestamp: m.timestamp,
                  });
                }
              }
            }
          }
        } catch {
          // non-fatal
        }
      }, 800);

      // 4. Safe rotation after 50 seconds before Vercel 60s hard ceiling
      timeoutTimer = setTimeout(() => {
        sendEvent('reconnect', { reason: 'stream_cycle' });
        cleanup();
      }, 50000);
    },
    cancel() {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      if (dbPollTimer) clearInterval(dbPollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      isClosed = true;
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
