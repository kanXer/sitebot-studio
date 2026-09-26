/**
 * Baileys WhatsApp Client Manager
 * Manages the WhatsApp socket lifecycle, QR code generation, incoming message
 * dispatch for two-way live support handoff, and proactive user notifications.
 * Auth state is persisted in MongoDB across restarts.
 */

import makeWASocket, {
  DisconnectReason,
  jidNormalizedUser,
  Browsers,
  WASocket,
  fetchLatestBaileysVersion,
  isJidBroadcast,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import {
  getMongoAuthState,
  saveSessionMeta,
  getSessionMeta,
  clearWhatsAppSession,
  WhatsAppSessionMeta,
  getAuthStorageMode,
} from './mongoAuthState';
import mongoose from 'mongoose';
import { EventEmitter } from 'events';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { ChatTicket, IChatTicket } from '@/lib/models/ChatTicket';
import { Conversation } from '@/lib/models/Conversation';
import { appendConversationMessage } from '@/lib/ai/handoff';

interface GlobalBaileysContainer {
  socket: WASocket | null;
  status: 'disconnected' | 'connecting' | 'connected';
  qrCode: string;
  phoneNumber: string;
  pushName: string;
  jid: string;
  isInitializing: boolean;
  sessionId: string;
  suppressNextClose: boolean;
  reconnectAttempts: number;
  keepAliveTimer: ReturnType<typeof setInterval> | null;
  lastDisconnectCode: number | null;
  requiresReauth: boolean;
  initPromise: Promise<{ status: string; qrCode?: string; phoneNumber?: string }> | null;
  initStartedAt: number;
}

declare global {
  var __baileysContainer: GlobalBaileysContainer | undefined;
  var __handoffEventEmitter: EventEmitter | undefined;
  var __whatsappHeartbeat: NodeJS.Timeout | undefined;
}

export const handoffEventEmitter: EventEmitter =
  global.__handoffEventEmitter || new EventEmitter();

if (!global.__handoffEventEmitter) {
  global.__handoffEventEmitter = handoffEventEmitter;
}

const DEFAULT_SESSION_ID = 'admin_primary';

const container: GlobalBaileysContainer = global.__baileysContainer || {
  socket: null,
  status: 'disconnected',
  qrCode: '',
  phoneNumber: '',
  pushName: '',
  jid: '',
  isInitializing: false,
  sessionId: DEFAULT_SESSION_ID,
  suppressNextClose: false,
  reconnectAttempts: 0,
  keepAliveTimer: null,
  lastDisconnectCode: null,
  requiresReauth: false,
  initPromise: null,
  initStartedAt: 0,
};

function backfillContainerFields(c: GlobalBaileysContainer): void {
  if (typeof c.suppressNextClose !== 'boolean') c.suppressNextClose = false;
  if (typeof c.reconnectAttempts !== 'number') c.reconnectAttempts = 0;
  if (c.keepAliveTimer === undefined) c.keepAliveTimer = null;
  if (c.lastDisconnectCode === undefined) c.lastDisconnectCode = null;
  if (typeof c.requiresReauth !== 'boolean') c.requiresReauth = false;
  if (c.initPromise === undefined) c.initPromise = null;
  if (typeof c.initStartedAt !== 'number') c.initStartedAt = 0;
}

backfillContainerFields(container);

if (!global.__baileysContainer) {
  global.__baileysContainer = container;
}

/**
 * Format phone string to valid WhatsApp JID
 */
export function formatPhoneToJid(phone: string): string {
  const clean = phone.replace(/[^0-9]/g, '');
  if (!clean) return '';
  return `${clean}@s.whatsapp.net`;
}

/**
 * Extract ticket ID from incoming text or quoted text
 */
export function extractTicketId(text: string): string | null {
  if (!text) return null;
  const match = text.match(/TICK-[A-Z0-9]+/i);
  return match ? match[0].toUpperCase() : null;
}

let cachedWaVersion: [number, number, number] | null = null;
let versionFetchPromise: Promise<[number, number, number] | undefined> | null = null;

async function getCachedBaileysVersion(): Promise<[number, number, number] | undefined> {
  if (cachedWaVersion) return cachedWaVersion;
  if (versionFetchPromise) return versionFetchPromise;

  versionFetchPromise = (async () => {
    try {
      const race = await Promise.race([
        fetchLatestBaileysVersion(),
        new Promise<null>((r) => setTimeout(() => r(null), 1500)),
      ]);
      if (race?.version) {
        cachedWaVersion = race.version;
        return race.version;
      }
    } catch (err) {
      console.warn('[Baileys] Version check warning:', err);
    }
    return undefined;
  })();

  const result = await versionFetchPromise;
  versionFetchPromise = null;
  return result;
}

/**
 * Get current live WhatsApp status and storage engine info
 */
export async function getWhatsAppStatus(
  sessionId = DEFAULT_SESSION_ID
): Promise<WhatsAppSessionMeta> {
  const dbMode = await getAuthStorageMode();

  // If memory container has active socket, return memory state
  if (container.socket && container.status === 'connected') {
    return {
      status: 'connected',
      qrCode: '',
      phoneNumber: container.phoneNumber,
      pushName: container.pushName,
      jid: container.jid,
      dbMode,
    };
  }

  // Otherwise check persisted state in MongoDB
  const meta = await getSessionMeta(sessionId);
  meta.dbMode = dbMode;

  if (container.qrCode && meta.status !== 'connected') {
    meta.qrCode = container.qrCode;
  }

  // AUTO-CONNECT: If session was previously connected or has a phone number,
  // but in-memory socket is disconnected, automatically reconnect in background!
  if (
    (meta.status === 'connected' || meta.phoneNumber) &&
    container.status === 'disconnected' &&
    !container.isInitializing &&
    !container.requiresReauth
  ) {
    console.log(`[Baileys] Auto-restoring WhatsApp connection for +${meta.phoneNumber || 'Admin'}...`);
    initializeWhatsApp({ sessionId, forceNew: false }).catch((err) => {
      console.warn('[Baileys] Auto-restore background error:', err?.message || err);
    });
  }

  return meta;
}

function toBotObjectId(botId: string): mongoose.Types.ObjectId | string {
  return mongoose.Types.ObjectId.isValid(botId) ? new mongoose.Types.ObjectId(botId) : botId;
}

/**
 * Handle incoming WhatsApp messages for Two-Way Live Support
 */
async function handleIncomingMessage(sock: WASocket, msg: any) {
  try {
    if (!msg.message) return;

    const text: string =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      msg.message.videoMessage?.caption ||
      '';

    const cleanText = text.trim();
    if (!cleanText) return;

    // Ignore automated system alerts sent by Rivafy itself to avoid echo loops
    if (
      cleanText.includes('🔴 *New Support Request*') ||
      cleanText.includes('New Support Request [Ticket:') ||
      cleanText.includes('✅ *Ticket #') ||
      cleanText.includes('✅ *Sent to Visitor Chat*') ||
      cleanText.includes('👋 *Rivafy Studio Test Notification*') ||
      cleanText.includes('👉 _Reply to visitor:') ||
      cleanText.includes('👉 *Reply to visitor:*') ||
      cleanText.includes('👉 *To Reply:*') ||
      cleanText.includes('👉 *To Close:*') ||
      cleanText.includes('Visitor is seeing this live in the website chat') ||
      cleanText.includes('Visitor chat has been restored to AI auto-reply mode')
    ) {
      return;
    }

    let ticketId = extractTicketId(cleanText);

    const contextInfo =
      msg.message.extendedTextMessage?.contextInfo ||
      msg.message.imageMessage?.contextInfo ||
      msg.message.videoMessage?.contextInfo ||
      msg.message.audioMessage?.contextInfo ||
      msg.message.documentMessage?.contextInfo ||
      msg.message.ephemeralMessage?.message?.extendedTextMessage?.contextInfo ||
      msg.message.viewOnceMessage?.message?.extendedTextMessage?.contextInfo ||
      (msg.message as any)?.viewOnceMessageV2?.message?.extendedTextMessage?.contextInfo;

    const stanzaId = contextInfo?.stanzaId;
    const quotedText: string =
      contextInfo?.quotedMessage?.conversation ||
      contextInfo?.quotedMessage?.extendedTextMessage?.text ||
      '';

    if (!ticketId && quotedText) {
      ticketId = extractTicketId(quotedText);
    }

    await connectToDatabase();

    let ticket: any = null;

    if (ticketId) {
      ticket = await ChatTicket.findOne({ ticketId });
    }

    if (!ticket && stanzaId) {
      ticket = await ChatTicket.findOne({ alertMessageId: stanzaId });
      if (ticket) {
        ticketId = ticket.ticketId;
      }
    }

    if (!ticket) {
      ticket = await ChatTicket.findOne({
        status: { $in: ['waiting_admin', 'open', 'admin_replied'] },
      }).sort({ updatedAt: -1 });

      if (ticket) {
        ticketId = ticket.ticketId;
      }
    }

    if (!ticket) {
      return;
    }

    const replyJid = msg.key.remoteJid;

    const isCloseCommand =
      cleanText.toLowerCase().trim() === '/close' ||
      cleanText.toLowerCase().trim() === 'close' ||
      cleanText.toLowerCase().includes('/close') ||
      cleanText.toLowerCase() === `#${ticket.ticketId.toLowerCase()} /close`;

    if (isCloseCommand) {
      ticket.status = 'closed';
      ticket.closedAt = new Date();
      ticket.messages.push({
        id: crypto.randomUUID(),
        role: 'system',
        senderName: 'System',
        content: 'Support agent closed this ticket from WhatsApp. AI assistant resumed.',
        timestamp: new Date(),
      });
      await ticket.save();

      if (!isUsingMemoryDb() && ticket.sessionId) {
        await Conversation.updateMany(
          {
            $or: [
              { sessionId: ticket.sessionId },
              { botId: toBotObjectId(String(ticket.botId)), sessionId: ticket.sessionId },
            ],
          },
          {
            $set: {
              status: 'resolved',
              lastMessageAt: new Date(),
            },
            $push: {
              messages: {
                role: 'system',
                content: 'Support agent closed this session via WhatsApp. AI assistant resumed.',
                timestamp: new Date(),
              },
            },
          }
        );
      }

      await appendConversationMessage(String(ticket.botId), ticket.sessionId, {
        role: 'system',
        content: 'Support agent closed this session via WhatsApp. AI assistant resumed.',
      });

      if (replyJid) {
        await sock.sendMessage(replyJid, {
          text: `✅ *Ticket #${ticket.ticketId} Closed*\nVisitor chat has been restored to AI auto-reply mode.`,
        });
      }
      return;
    }

    let replyContent = cleanText;
    const prefixRegex = new RegExp(`^#?${ticket.ticketId}\\s*[-:]*\\s*`, 'i');
    replyContent = replyContent.replace(prefixRegex, '').trim();

    if (!replyContent) {
      replyContent = cleanText;
    }

    const agentSenderName = container.pushName || 'Live Support Agent';
    const now = new Date();
    const agentMsgId = crypto.randomUUID();

    ticket.status = 'admin_replied';
    ticket.lastAdminReply = replyContent;
    ticket.messages.push({
      id: agentMsgId,
      role: 'agent',
      senderName: agentSenderName,
      content: replyContent,
      timestamp: now,
    });

    // 1. Immediately notify live SSE stream in memory for zero-latency (<1ms) delivery
    if (ticket.sessionId) {
      handoffEventEmitter.emit(`message:${ticket.sessionId}`, {
        role: 'agent',
        content: replyContent,
        senderName: agentSenderName,
        timestamp: now,
      });
    }

    // Parallelize database writes for instant latency
    await Promise.all([
      ticket.save(),
      appendConversationMessage(String(ticket.botId), ticket.sessionId, {
        role: 'agent',
        senderName: agentSenderName,
        content: replyContent,
      }),
      !isUsingMemoryDb() && ticket.sessionId
        ? Conversation.updateMany(
            {
              $or: [
                { sessionId: ticket.sessionId },
                { botId: toBotObjectId(String(ticket.botId)), sessionId: ticket.sessionId },
              ],
            },
            {
              $set: {
                status: 'agent_active',
                lastMessageAt: now,
              },
            }
          )
        : Promise.resolve(),
    ]);

    if (replyJid) {
      sock.sendMessage(replyJid, {
        text: `✅ *Sent to Visitor Chat* [Ticket: #${ticket.ticketId}]\n"${replyContent}"\n\n_(Visitor is seeing this live in the website chat)_`,
      }).catch((ackErr) => {
        console.warn('[Baileys Relay] Error sending delivery ack:', ackErr);
      });
    }
  } catch (err) {
    console.error('[Baileys Relay] Error handling incoming message:', err);
  }
}

/**
 * Keeps the socket warm with presence updates and active ping frames
 */
function startKeepAlive(sock: WASocket) {
  stopKeepAlive();
  container.keepAliveTimer = setInterval(() => {
    if (container.socket !== sock || container.status !== 'connected') return;
    try {
      sock.sendPresenceUpdate('available').catch(() => {});
      if ((sock as any)?.ws && typeof (sock as any).ws.ping === 'function') {
        (sock as any).ws.ping();
      }
    } catch {
      // Socket closing
    }
  }, 15_000);

  if (typeof container.keepAliveTimer.unref === 'function') {
    container.keepAliveTimer.unref();
  }
}

function stopKeepAlive() {
  if (container.keepAliveTimer) {
    clearInterval(container.keepAliveTimer);
    container.keepAliveTimer = null;
  }
}

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleReconnect(sessionId: string, immediate = false) {
  if (reconnectTimer) return;

  container.reconnectAttempts += 1;
  const attempt = container.reconnectAttempts;
  // If immediate (e.g. restartRequired 515), reconnect in 500ms
  // Otherwise fast backoff capped at 8s
  const delay = immediate ? 500 : Math.min(500 * Math.pow(1.5, Math.min(attempt - 1, 6)), 8000);

  console.log(`[Baileys] Scheduling reconnect #${attempt} in ${delay}ms...`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    initializeWhatsApp({ sessionId, forceNew: false }).catch((err) => {
      console.warn(`[Baileys] Reconnect attempt ${attempt} failed:`, err?.message || err);
      container.status = 'disconnected';
      scheduleReconnect(sessionId, false);
    });
  }, delay);

  if (typeof reconnectTimer.unref === 'function') {
    reconnectTimer.unref();
  }
}

/**
 * Public entry point for (re)connecting WhatsApp.
 */
export async function initializeWhatsApp(options?: {
  sessionId?: string;
  forceNew?: boolean;
}): Promise<{ status: string; qrCode?: string; phoneNumber?: string }> {
  if (container.socket && container.status === 'connected' && !options?.forceNew) {
    return { status: 'connected', phoneNumber: container.phoneNumber };
  }

  if (container.isInitializing && !options?.forceNew) {
    if (container.initPromise) {
      try {
        return await container.initPromise;
      } catch {
        // Fall through
      }
    }
    return {
      status: container.status,
      qrCode: container.qrCode,
      phoneNumber: container.phoneNumber,
    };
  }

  const promise = runInitializeWhatsApp(options);
  container.initPromise = promise;

  promise
    .catch(() => {})
    .finally(() => {
      if (container.initPromise === promise) {
        container.initPromise = null;
        container.initStartedAt = 0;
      }
    });

  return promise;
}

async function runInitializeWhatsApp(options?: {
  sessionId?: string;
  forceNew?: boolean;
}): Promise<{ status: string; qrCode?: string; phoneNumber?: string }> {
  const sessionId = options?.sessionId || DEFAULT_SESSION_ID;

  if (options?.forceNew) {
    if (container.socket) {
      container.suppressNextClose = true;
      try {
        container.socket.end(new Error('Resetting socket for fresh QR'));
      } catch {}
      container.socket = null;
    }
    container.qrCode = '';
    container.phoneNumber = '';
    container.jid = '';
    container.status = 'connecting';
    await clearWhatsAppSession(sessionId);
  }

  container.isInitializing = true;
  container.initStartedAt = Date.now();
  container.status = 'connecting';
  const existingMeta = await getSessionMeta(sessionId);
  if (options?.forceNew || existingMeta.status !== 'connected') {
    await saveSessionMeta(sessionId, { status: 'connecting' });
  }

  try {
    const { state, saveCreds } = await getMongoAuthState(sessionId);
    const logger = pino({ level: 'silent' });

    const waVersion = await getCachedBaileysVersion();

    if (container.socket) {
      container.suppressNextClose = true;
      try {
        container.socket.end(new Error('Replacing with new socket'));
      } catch {}
      container.socket = null;
    }

    const sock = makeWASocket({
      version: waVersion,
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      connectTimeoutMs: 30000,
      defaultQueryTimeoutMs: 30000,
      keepAliveIntervalMs: 10000,
      markOnlineOnConnect: true,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      emitOwnEvents: true,
      shouldIgnoreJid: (jid) => isJidBroadcast(jid) || jid.endsWith('@newsletter'),
      retryRequestDelayMs: 250,
      maxMsgRetryCount: 3,
    });

    container.socket = sock;

    // Handle Connection State Updates
    sock.ev.on('connection.update', async (update) => {
      // Guard against zombie callbacks from superseded sockets
      if (container.socket !== sock) {
        return;
      }

      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, {
            margin: 2,
            scale: 7,
            color: { dark: '#0f172a', light: '#ffffff' },
          });
          container.qrCode = qrDataUrl;
          container.status = 'connecting';
          await saveSessionMeta(sessionId, {
            status: 'connecting',
            qrCode: qrDataUrl,
          });
        } catch (err) {
          console.error('[Baileys] QR code generation error:', err);
        }
      }

      if (connection === 'open') {
        container.status = 'connected';
        container.qrCode = '';
        container.isInitializing = false;

        const rawJid = sock.user?.id || '';
        const normalized = jidNormalizedUser(rawJid);
        const phone = normalized.split('@')[0] || '';
        const pushName = sock.user?.name || 'Rivafy Admin';

        container.phoneNumber = phone;
        container.pushName = pushName;
        container.jid = normalized;

        await saveSessionMeta(sessionId, {
          status: 'connected',
          qrCode: '',
          phoneNumber: phone,
          pushName,
          jid: normalized,
          lastConnectedAt: new Date().toISOString(),
        });

        container.reconnectAttempts = 0;
        container.requiresReauth = false;
        container.lastDisconnectCode = null;
        startKeepAlive(sock);
        dispatchPendingTicketAlerts(sock).catch(() => {});

        console.log(`[Baileys] WhatsApp connected successfully as: ${phone} (${pushName})`);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        const isReplaced = statusCode === 440 || statusCode === DisconnectReason.connectionReplaced;

        stopKeepAlive();
        container.lastDisconnectCode = statusCode ?? null;

        console.log(`[Baileys] Connection closed. Reason code: ${statusCode}, loggedOut: ${loggedOut}`);

        if (container.suppressNextClose) {
          container.suppressNextClose = false;
          return;
        }

        if (isReplaced) {
          console.warn('[Baileys] Socket connection replaced by active session. Yielding.');
          container.status = 'disconnected';
          container.socket = null;
          container.isInitializing = false;
          return;
        }

        if (loggedOut) {
          container.status = 'disconnected';
          container.qrCode = '';
          container.socket = null;
          container.isInitializing = false;
          container.requiresReauth = true;

          await saveSessionMeta(sessionId, {
            status: 'disconnected',
            qrCode: '',
          });
        } else {
          const isImmediate = statusCode === DisconnectReason.restartRequired || statusCode === 515;
          container.status = 'connecting';
          container.isInitializing = false;
          scheduleReconnect(sessionId, isImmediate);
        }
      }
    });

    // Handle Credentials Persistence
    sock.ev.on('creds.update', async () => {
      try {
        await saveCreds();
      } catch (err) {
        console.error('[Baileys] Error saving credentials:', err);
      }
    });

    // Handle Incoming Messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify' && type !== 'append') return;
      for (const msg of messages) {
        await handleIncomingMessage(sock, msg);
      }
    });

    // Await first QR code or connection event (max 5 seconds)
    const isLive = (): boolean =>
      Boolean(container.qrCode) || container.status === 'connected';

    if (!isLive()) {
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (!done) {
            done = true;
            resolve();
          }
        };

        const checkInterval = setInterval(() => {
          if (isLive()) {
            clearInterval(checkInterval);
            finish();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          finish();
        }, 5000);
      });
    }

    return {
      status: container.status,
      qrCode: container.qrCode,
      phoneNumber: container.phoneNumber,
    };
  } catch (error) {
    container.isInitializing = false;
    container.status = 'disconnected';
    console.error('[Baileys] Initialization failed:', error);
    await saveSessionMeta(sessionId, { status: 'disconnected' });
    throw error;
  }
}

/**
 * Server-Sent Events (SSE) Live Pairing Stream.
 * Keeps the Vercel serverless function continuously awake and running
 * while the QR code is displayed on the screen until the phone scans it.
 */
export function startPairingStream(options?: {
  sessionId?: string;
  forceNew?: boolean;
  abortSignal?: AbortSignal;
}): Response {
  const sessionId = options?.sessionId || DEFAULT_SESSION_ID;
  const forceNew = Boolean(options?.forceNew);
  const encoder = new TextEncoder();

  let keepAliveTimer: NodeJS.Timeout | null = null;
  let timeoutTimer: NodeJS.Timeout | null = null;
  let isClosed = false;

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
        if (timeoutTimer) clearTimeout(timeoutTimer);
        try {
          controller.close();
        } catch {}
      };

      if (options?.abortSignal) {
        options.abortSignal.addEventListener('abort', cleanup);
      }

      sendComment('stream-start');

      // Keepalive heartbeat every 2.5s keeps the Lambda process running
      keepAliveTimer = setInterval(() => {
        sendComment('keepalive');
      }, 2500);

      // Max 55 seconds (safe margin before Vercel 60s hard limit)
      timeoutTimer = setTimeout(() => {
        sendEvent('timeout', { message: 'Pairing session timed out. Click Generate New QR to retry.' });
        cleanup();
      }, 55000);

      try {
        const meta = await getSessionMeta(sessionId);
        const shouldForceFresh = Boolean(forceNew);

        if (shouldForceFresh) {
          if (container.socket) {
            container.suppressNextClose = true;
            try {
              container.socket.end(new Error('Resetting for fresh QR'));
            } catch {}
            container.socket = null;
          }
          container.qrCode = '';
          container.phoneNumber = '';
          container.jid = '';
          container.status = 'connecting';
          await clearWhatsAppSession(sessionId);
        }

        // If already connected and not forcing new:
        if (container.socket && container.status === 'connected' && !shouldForceFresh) {
          sendEvent('connected', {
            status: 'connected',
            phoneNumber: container.phoneNumber,
            pushName: container.pushName,
            jid: container.jid,
          });
          setTimeout(cleanup, 1000);
          return;
        }

        container.isInitializing = true;
        container.initStartedAt = Date.now();
        container.status = 'connecting';
        await saveSessionMeta(sessionId, { status: 'connecting' });

        const { state, saveCreds } = await getMongoAuthState(sessionId);
        const logger = pino({ level: 'silent' });
        const waVersion = await getCachedBaileysVersion();

        const createSocket = () => {
          if (isClosed) return;

          const sock = makeWASocket({
            version: waVersion,
            auth: state,
            logger,
            printQRInTerminal: false,
            browser: Browsers.ubuntu('Chrome'),
            connectTimeoutMs: 30000,
            defaultQueryTimeoutMs: 30000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: true,
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            emitOwnEvents: true,
            shouldIgnoreJid: (jid) => isJidBroadcast(jid) || jid.endsWith('@newsletter'),
            retryRequestDelayMs: 250,
            maxMsgRetryCount: 3,
          });

          container.socket = sock;

          sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
              try {
                const qrDataUrl = await QRCode.toDataURL(qr, {
                  margin: 2,
                  scale: 7,
                  color: { dark: '#0f172a', light: '#ffffff' },
                });
                container.qrCode = qrDataUrl;
                container.status = 'connecting';
                await saveSessionMeta(sessionId, { status: 'connecting', qrCode: qrDataUrl });
                sendEvent('qr', { qrCode: qrDataUrl, status: 'connecting' });
              } catch (err) {
                console.error('[Baileys Stream] QR encode error:', err);
              }
            }

            if (connection === 'open') {
              container.status = 'connected';
              container.qrCode = '';
              container.isInitializing = false;

              const rawJid = sock.user?.id || '';
              const normalized = jidNormalizedUser(rawJid);
              const phone = normalized.split('@')[0] || '';
              const pushName = sock.user?.name || 'Rivafy Admin';

              container.phoneNumber = phone;
              container.pushName = pushName;
              container.jid = normalized;

              await saveSessionMeta(sessionId, {
                status: 'connected',
                qrCode: '',
                phoneNumber: phone,
                pushName,
                jid: normalized,
                lastConnectedAt: new Date().toISOString(),
              });

              container.reconnectAttempts = 0;
              container.requiresReauth = false;
              container.lastDisconnectCode = null;
              startKeepAlive(sock);

              console.log(`[Baileys Stream] WhatsApp connected successfully as: ${phone} (${pushName})`);
              sendEvent('connected', {
                status: 'connected',
                phoneNumber: phone,
                pushName,
                jid: normalized,
              });

              setTimeout(cleanup, 2000);
            }

            if (connection === 'close') {
              const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
              const loggedOut = statusCode === DisconnectReason.loggedOut;
              stopKeepAlive();

              console.log(`[Baileys Stream] Connection closed. Reason: ${statusCode}, loggedOut: ${loggedOut}`);

              if (loggedOut) {
                container.status = 'disconnected';
                container.qrCode = '';
                container.socket = null;
                sendEvent('error', { message: 'WhatsApp session logged out. Please generate a new QR.' });
                cleanup();
              } else if (!isClosed) {
                // WhatsApp sends 515 (restartRequired) right after scanning the QR code to finalize credentials.
                // Reconnect immediately within the live stream!
                console.log(`[Baileys Stream] Reconnecting socket (code ${statusCode}) to finalize pairing...`);
                sendComment('reconnecting-after-qr-scan');
                setTimeout(() => {
                  if (!isClosed) {
                    createSocket();
                  }
                }, 1000);
              }
            }
          });

          sock.ev.on('creds.update', async () => {
            try {
              await saveCreds();
            } catch (e) {
              console.error('[Baileys Stream] Error saving creds:', e);
            }
          });

          sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify' && type !== 'append') return;
            for (const msg of messages) {
              await handleIncomingMessage(sock, msg);
            }
          });
        };

        createSocket();

      } catch (err: any) {
        console.error('[Baileys Stream] Init error:', err);
        sendEvent('error', { message: err?.message || 'Failed to initialize WhatsApp socket' });
        cleanup();
      }
    },
    cancel() {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      isClosed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * Ensures a live, authenticated Baileys socket is connected.
 * In serverless environments, this quickly reattaches to saved MongoDB credentials
 * with an adequate timeout (15s) to guarantee reliable outbound message delivery.
 */
export async function ensureConnectedWhatsApp(
  sessionId = DEFAULT_SESSION_ID,
  timeoutMs = 35000
): Promise<WASocket> {
  // If socket is already connected and open:
  if (
    container.socket &&
    container.status === 'connected' &&
    (container.socket as any)?.ws?.readyState === 1
  ) {
    return container.socket;
  }

  const meta = await getSessionMeta(sessionId);
  if (meta.status !== 'connected' && !meta.phoneNumber) {
    throw new Error('WhatsApp is not linked on Admin panel. Please link WhatsApp first.');
  }

  // Trigger init with saved credentials
  container.status = 'connecting';
  initializeWhatsApp({ sessionId, forceNew: false }).catch(() => {});

  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (
      container.socket &&
      container.status === 'connected' &&
      (container.socket as any)?.ws?.readyState === 1
    ) {
      return container.socket;
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  if (container.socket && container.status === 'connected') {
    return container.socket;
  }

  throw new Error(`WhatsApp connection timed out after ${Math.round(timeoutMs / 1000)}s`);
}

/**
 * Logout and clear WhatsApp session
 */
export async function logoutWhatsApp(
  sessionId = DEFAULT_SESSION_ID
): Promise<{ success: boolean }> {
  try {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    stopKeepAlive();

    if (container.socket) {
      container.suppressNextClose = true;
      try {
        await container.socket.logout();
      } catch {}
      container.socket = null;
    }

    container.reconnectAttempts = 0;
    container.requiresReauth = false;
    container.lastDisconnectCode = null;
    container.status = 'disconnected';
    container.qrCode = '';
    container.phoneNumber = '';
    container.pushName = '';
    container.jid = '';
    container.isInitializing = false;

    await clearWhatsAppSession(sessionId);
    await saveSessionMeta(sessionId, {
      status: 'disconnected',
      qrCode: '',
      phoneNumber: '',
    });

    return { success: true };
  } catch (err) {
    console.error('[Baileys] Logout error:', err);
    return { success: false };
  }
}

/**
 * Send a notification directly to any WhatsApp number
 */
export async function sendWhatsAppMessage(
  toNumber: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const jid = formatPhoneToJid(toNumber);
    if (!jid) {
      return { ok: false, error: 'Invalid recipient phone number' };
    }

    const sock = await ensureConnectedWhatsApp(DEFAULT_SESSION_ID, 35000);
    await sock.sendMessage(jid, { text });
    return { ok: true };
  } catch (err: any) {
    console.error('[Baileys] Send message error:', err);
    return { ok: false, error: err?.message || 'Failed to send WhatsApp message' };
  }
}

/**
 * Dispatch Instant Human Support Alert to Admin's WhatsApp
 */
export async function sendTicketAlertToAdmin(params: {
  ticketId: string;
  botName: string;
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
  userMessage?: string;
  targetNumber?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const sock = await ensureConnectedWhatsApp(DEFAULT_SESSION_ID, 25000);

    const {
      ticketId,
      botName,
      visitorName,
      visitorEmail,
      visitorPhone,
      userMessage,
      targetNumber,
    } = params;

    const formattedMessage =
      `🔴 *New Support Request* [Ticket: #${ticketId}]\n` +
      `*Bot:* ${botName || 'Rivafy Assistant'}\n` +
      `*Visitor:* ${visitorName || 'Visitor'}` +
      (visitorEmail ? ` (${visitorEmail})` : '') +
      (visitorPhone ? ` [${visitorPhone}]` : '') +
      `\n\n` +
      `💬 *Visitor message:*\n"${userMessage || 'Human assistance requested'}"\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `👉 *To Reply:* Swipe / Quote-Reply to this message, or type your reply directly!\n` +
      `👉 *To Close:* Reply /close`;

    const targetJids: string[] = [];

    if (targetNumber && targetNumber.trim()) {
      const botTargetJid = formatPhoneToJid(targetNumber.trim());
      if (botTargetJid && !targetJids.includes(botTargetJid)) {
        targetJids.push(botTargetJid);
      }
    }

    const envAdminPhone = process.env.NOTIFY_WHATSAPP;
    const adminTargetJid = envAdminPhone
      ? formatPhoneToJid(envAdminPhone)
      : container.jid || jidNormalizedUser(sock.user?.id || '');

    if (adminTargetJid && !targetJids.includes(adminTargetJid)) {
      targetJids.push(adminTargetJid);
    }

    if (targetJids.length === 0) {
      return { ok: false, error: 'No WhatsApp recipient found' };
    }

    let sent = false;
    let sentMsgId = '';
    for (const jid of targetJids) {
      try {
        const sentMsg = await sock.sendMessage(jid, { text: formattedMessage });
        sent = true;
        if (sentMsg?.key?.id) {
          sentMsgId = sentMsg.key.id;
        }
      } catch (sendErr) {
        console.warn(`[Baileys] Error sending ticket alert to ${jid}:`, sendErr);
      }
    }

    if (sent && sentMsgId) {
      try {
        await connectToDatabase();
        await ChatTicket.updateOne(
          { ticketId },
          { $set: { alertMessageId: sentMsgId } }
        );
      } catch (saveErr) {
        console.warn('[Baileys] Error saving alertMessageId on ChatTicket:', saveErr);
      }
    }

    return { ok: sent };
  } catch (err: any) {
    console.error('[Baileys] Error sending ticket alert:', err);
    return { ok: false, error: err?.message || 'Failed to alert admin' };
  }
}

/**
 * Background Dispatcher for Pending ChatTickets.
 * Checks for any support tickets waiting for an admin where the WhatsApp alert hasn't been sent.
 * Delivers the alert immediately and marks alertMessageId.
 */
export async function dispatchPendingTicketAlerts(sock?: WASocket): Promise<void> {
  try {
    const activeSock = sock || (container.status === 'connected' ? container.socket : null);
    if (!activeSock) return;

    await connectToDatabase();
    if (isUsingMemoryDb()) return;

    const pendingTickets = await ChatTicket.find({
      status: 'waiting_admin',
      $or: [
        { alertMessageId: { $exists: false } },
        { alertMessageId: '' },
        { alertMessageId: null },
      ],
    }).sort({ createdAt: -1 }).limit(5);

    for (const ticket of pendingTickets) {
      try {
        let targetNumber: string | undefined;
        if (ticket.botId) {
          const { Chatbot } = await import('@/lib/models/Chatbot');
          const bot = await Chatbot.findById(ticket.botId).lean();
          targetNumber =
            (bot as any)?.handoff?.whatsappEnabled && (bot as any)?.handoff?.whatsappNumber
              ? (bot as any).handoff.whatsappNumber
              : (bot as any)?.notifications?.whatsapp?.enabled && (bot as any)?.notifications?.whatsapp?.number
              ? (bot as any).notifications.whatsapp.number
              : (bot as any)?.whatsapp || undefined;
        }

        const res = await sendTicketAlertToAdmin({
          ticketId: ticket.ticketId,
          botName: ticket.botName || 'Rivafy Assistant',
          visitorName: ticket.visitor?.name || 'Visitor',
          visitorEmail: ticket.visitor?.email,
          visitorPhone: ticket.visitor?.phone,
          userMessage: ticket.lastUserMessage || 'Visitor requested human support',
          targetNumber,
        });

        if (res.ok) {
          console.log(`[Baileys Outbound] Dispatched pending alert for Ticket #${ticket.ticketId}`);
        }
      } catch (err) {
        console.warn(`[Baileys Outbound] Failed to dispatch alert for #${ticket.ticketId}:`, err);
      }
    }
  } catch (e) {
    console.warn('[Baileys Outbound] Error in dispatchPendingTicketAlerts:', e);
  }
}

/**
 * Global Permanent 60-Second Background Heartbeat:
 * Runs automatically every 60 seconds (1 minute).
 * Checks if WhatsApp session credentials exist in MongoDB.
 * If linked and socket is disconnected, automatically reconnects without any admin needing to open the page.
 * If already connected, pings WhatsApp presence ('available') to keep the connection warm and healthy.
 */
export function startGlobalWhatsAppHeartbeat(): void {
  if (global.__whatsappHeartbeat) return;

  const runHeartbeat = async () => {
    try {
      const meta = await getSessionMeta(DEFAULT_SESSION_ID);
      const isLinked = meta.status === 'connected' || Boolean(meta.phoneNumber);
      const isSocketReady =
        container.socket &&
        container.status === 'connected' &&
        (container.socket as any)?.ws?.readyState === 1;

      if (isLinked) {
        if (!isSocketReady) {
          if (!container.isInitializing && !container.requiresReauth) {
            console.log('[Baileys Heartbeat] WhatsApp session is disconnected. Auto-reconnecting in background...');
            await initializeWhatsApp({ sessionId: DEFAULT_SESSION_ID, forceNew: false });
          }
        } else {
          // Socket connected, ping presence to keep socket alive
          try {
            await container.socket?.sendPresenceUpdate('available');
            dispatchPendingTicketAlerts(container.socket).catch(() => {});
          } catch {}
        }
      }
    } catch (err: any) {
      // Quietly ignore network/heartbeat glitches
    }
  };

  global.__whatsappHeartbeat = setInterval(runHeartbeat, 60000);
  if (typeof (global.__whatsappHeartbeat as any)?.unref === 'function') {
    (global.__whatsappHeartbeat as any).unref();
  }

  // Initial immediate check after short 2.5s bootstrap
  setTimeout(() => {
    runHeartbeat().catch(() => {});
  }, 2500);
}

// Auto-start background heartbeat on module load
startGlobalWhatsAppHeartbeat();

