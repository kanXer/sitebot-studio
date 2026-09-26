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
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import {
  getMongoAuthState,
  saveSessionMeta,
  getSessionMeta,
  clearWhatsAppSession,
  WhatsAppSessionMeta,
} from './mongoAuthState';
import mongoose from 'mongoose';
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
  /**
   * True only between "we deliberately end this socket" and the resulting
   * connection.update close event. Without this guard, ending a socket
   * re-enters this handler, which ended it again -> an endless reconnect loop.
   */
  suppressNextClose: boolean;
  /** Consecutive failed reconnect attempts, used for backoff. */
  reconnectAttempts: number;
  /** Interval that keeps the socket alive so WhatsApp does not drop it. */
  keepAliveTimer: ReturnType<typeof setInterval> | null;
  /** Last disconnect code, surfaced for diagnostics. */
  lastDisconnectCode: number | null;
  /** True once a 401/loggedOut close happened, so status can explain itself. */
  requiresReauth: boolean;
  /** In-flight init, so concurrent callers join one socket instead of racing. */
  initPromise: Promise<{ status: string; qrCode?: string; phoneNumber?: string }> | null;
  /** When the current init began, used to detect a stale flag after a hot reload. */
  initStartedAt: number;
}

declare global {
  var __baileysContainer: GlobalBaileysContainer | undefined;
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

/**
 * Older hot-reloaded containers predate the reconnect fields. Backfill them on a
 * function parameter so TypeScript does not narrow the module-level binding.
 */
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
 * Patterns matched:
 * - #TICK-ABCD
 * - TICK-ABCD
 * - Ticket: #TICK-ABCD
 */
export function extractTicketId(text: string): string | null {
  if (!text) return null;
  const match = text.match(/TICK-[A-Z0-9]+/i);
  return match ? match[0].toUpperCase() : null;
}

/**
 * Get current live WhatsApp status
 */
export async function getWhatsAppStatus(
  sessionId = DEFAULT_SESSION_ID
): Promise<WhatsAppSessionMeta> {
  // If memory container is connected, return memory state
  if (container.socket && container.status === 'connected') {
    return {
      status: container.status,
      qrCode: container.qrCode,
      phoneNumber: container.phoneNumber,
      pushName: container.pushName,
      jid: container.jid,
    };
  }

  // Otherwise check persisted state in MongoDB
  const meta = await getSessionMeta(sessionId);
  if (container.qrCode && meta.status !== 'connected') {
    meta.qrCode = container.qrCode;
  }

  // Auto-resume: a saved session that is merely disconnected (server restart,
  // dropped network) should reattach on its own instead of showing the admin a
  // dead "disconnected" panel that looks like a logout.
  const hasSavedSession = meta.status === 'connected' || Boolean(meta.phoneNumber);
  if (hasSavedSession && !container.requiresReauth && !container.isInitializing) {
    container.status = 'connecting';
    meta.status = 'connecting';
    // Fire and forget: report "connecting" immediately, the UI polls again.
    initializeWhatsApp({ sessionId }).catch(() => {
      container.status = 'disconnected';
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

    // Extract text from regular or extended message
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

    // 1. Check if message has ticket ID explicitly (e.g. #TICK-ABCD or TICK-ABCD)
    let ticketId = extractTicketId(cleanText);

    // 2. Check contextInfo if admin swipe-replied / quoted the alert message
    const contextInfo =
      msg.message.extendedTextMessage?.contextInfo ||
      msg.message.imageMessage?.contextInfo ||
      msg.message.videoMessage?.contextInfo ||
      msg.message.audioMessage?.contextInfo ||
      msg.message.documentMessage?.contextInfo ||
      msg.message.ephemeralMessage?.message?.extendedTextMessage?.contextInfo ||
      msg.message.viewOnceMessage?.message?.extendedTextMessage?.contextInfo ||
      (msg.message as any)?.viewOnceMessageV2?.message?.extendedTextMessage?.contextInfo;

    const stanzaId = contextInfo?.stanzaId; // Quoted message ID from WhatsApp
    const quotedText: string =
      contextInfo?.quotedMessage?.conversation ||
      contextInfo?.quotedMessage?.extendedTextMessage?.text ||
      '';

    if (!ticketId && quotedText) {
      ticketId = extractTicketId(quotedText);
    }

    await connectToDatabase();

    let ticket: any = null;

    // A. Find by direct ticketId
    if (ticketId) {
      ticket = await ChatTicket.findOne({ ticketId });
    }

    // B. Find by alertMessageId (matched from swipe / quote-reply stanzaId)
    if (!ticket && stanzaId) {
      ticket = await ChatTicket.findOne({ alertMessageId: stanzaId });
      if (ticket) {
        ticketId = ticket.ticketId;
        console.log(`[Baileys Relay] Matched quoted stanzaId ${stanzaId} to ticket #${ticketId}`);
      }
    }

    // C. EASY RESPONSE MODE: If still not matched, auto-match the latest active ticket!
    if (!ticket) {
      ticket = await ChatTicket.findOne({
        status: { $in: ['waiting_admin', 'open', 'admin_replied'] },
      }).sort({ updatedAt: -1 });

      if (ticket) {
        ticketId = ticket.ticketId;
        console.log(`[Baileys Relay] Auto-matched incoming WhatsApp reply to active ticket #${ticketId}`);
      }
    }

    if (!ticket) {
      console.log(`[Baileys Relay] No active ticket found for incoming text: "${cleanText}"`);
      return;
    }

    const replyJid = msg.key.remoteJid;

    // Check if the command is to close the ticket
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

      // Resolve corresponding conversation if present
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

      // Also append system message to conversation transcript via helper
      await appendConversationMessage(String(ticket.botId), ticket.sessionId, {
        role: 'system',
        content: 'Support agent closed this session via WhatsApp. AI assistant resumed.',
      });

      // Send ack back to WhatsApp
      if (replyJid) {
        await sock.sendMessage(replyJid, {
          text: `✅ *Ticket #${ticket.ticketId} Closed*\nVisitor chat has been restored to AI auto-reply mode.`,
        });
      }
      return;
    }

    // Extract actual message content without the #TICKET-ID prefix if present
    let replyContent = cleanText;
    const prefixRegex = new RegExp(`^#?${ticket.ticketId}\\s*[-:]*\\s*`, 'i');
    replyContent = replyContent.replace(prefixRegex, '').trim();

    if (!replyContent) {
      replyContent = cleanText;
    }

    const agentSenderName = container.pushName || 'Live Support Agent';
    const now = new Date();
    const agentMsgId = crypto.randomUUID();

    // 1. Append agent reply to ChatTicket
    ticket.status = 'admin_replied';
    ticket.lastAdminReply = replyContent;
    ticket.messages.push({
      id: agentMsgId,
      role: 'agent',
      senderName: agentSenderName,
      content: replyContent,
      timestamp: now,
    });
    await ticket.save();

    // 2. Relay message to widget's Conversation record
    await appendConversationMessage(String(ticket.botId), ticket.sessionId, {
      role: 'agent',
      senderName: agentSenderName,
      content: replyContent,
    });

    // 3. Direct Conversation record update to ensure immediate widget rendering
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
            status: 'agent_active',
            lastMessageAt: now,
          },
          $push: {
            messages: {
              role: 'agent',
              senderName: agentSenderName,
              content: replyContent,
              timestamp: now,
            },
          },
        }
      );
    }

    // 4. Send delivery confirmation ack to WhatsApp
    if (replyJid) {
      try {
        await sock.sendMessage(replyJid, {
          text: `✅ *Sent to Visitor Chat* [Ticket: #${ticket.ticketId}]\n"${replyContent}"\n\n_(Visitor is seeing this live in the website chat)_`,
        });
      } catch (ackErr) {
        console.warn('[Baileys Relay] Error sending delivery ack:', ackErr);
      }
    }

    console.log(`[Baileys Relay] Dispatched reply for ticket #${ticket.ticketId} to website visitor widget.`);
  } catch (err) {
    console.error('[Baileys Relay] Error handling incoming message:', err);
  }
}

/**
 * Keeps the socket warm.
 *
 * WhatsApp silently drops connections that go idle. A presence ping every ~25s
 * is cheap and is what stops the "connected for a while, then suddenly
 * disconnected" behaviour. Errors are ignored on purpose: a failed ping means
 * the socket is already closing and connection.update/close will handle it.
 */
function startKeepAlive(sock: WASocket) {
  stopKeepAlive();
  container.keepAliveTimer = setInterval(() => {
    if (container.socket !== sock) return;
    try {
      sock.sendPresenceUpdate('available').catch(() => {});
    } catch {
      // Socket already gone; close handler takes over.
    }
  }, 25_000);

  // Do not hold the Node process open just for the keepalive.
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

/**
 * Schedules a single reconnect attempt with capped exponential backoff.
 *
 * The previous code fired a bare `setTimeout(initializeWhatsApp({ forceNew:
 * true }))` on every close. forceNew ends the socket, which emits another
 * close, which schedules another reconnect -- so one network blip could cascade
 * into repeated socket resets, and those resets are what the admin was
 * perceiving as WhatsApp logging itself out.
 *
 * This guard makes at most one attempt in flight at a time.
 */
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleReconnect(sessionId: string) {
  if (reconnectTimer) return; // an attempt is already pending

  container.reconnectAttempts += 1;
  const attempt = container.reconnectAttempts;
  const delay = Math.min(3000 * Math.pow(2, attempt - 1), 60_000);

  console.log(
    `[Baileys] Scheduling reconnect attempt ${attempt} for session ${sessionId} in ${Math.round(delay / 1000)}s`
  );

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    // No forceNew: reuse the persisted credentials so this is a silent
    // reconnect and cannot self-trigger another close.
    initializeWhatsApp({ sessionId }).catch((err) => {
      console.warn(`[Baileys] Reconnect attempt ${attempt} failed:`, err);
      container.status = 'disconnected';
      scheduleReconnect(sessionId);
    });
  }, delay);

  if (typeof reconnectTimer.unref === 'function') {
    reconnectTimer.unref();
  }
}

/**
 * Initialize WhatsApp Baileys connection
 */
/**
 * Public entry point for (re)connecting WhatsApp.
 *
 * Single-flight by design. The previous guard was
 * `if (container.isInitializing && container.qrCode) return ...`, which only
 * short-circuited once a QR had actually been produced. During the first
 * moments of an init `qrCode` is still empty, so a concurrent caller (the admin
 * page polls /status every few seconds) fell straight through and built a
 * SECOND socket over the same auth keys. Two live sockets for one session make
 * WhatsApp treat the second as a duplicate device and drop it, which surfaced
 * to the admin as "could not connect" moments after the QR was scanned.
 *
 * Now every caller joins the in-flight init instead of racing it.
 */
export async function initializeWhatsApp(options?: {
  sessionId?: string;
  forceNew?: boolean;
}): Promise<{ status: string; qrCode?: string; phoneNumber?: string }> {
  // Fast path: already live and the caller does not want a fresh QR.
  if (container.socket && container.status === 'connected' && !options?.forceNew) {
    return { status: 'connected', phoneNumber: container.phoneNumber };
  }

  // A previous init is still running: join it rather than starting another.
  if (container.isInitializing && !options?.forceNew) {
    if (container.initPromise) {
      try {
        return await container.initPromise;
      } catch {
        // The in-flight init failed; fall through and report current state.
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

  // Clear the shared handle as soon as this init settles so the next call can
  // start a fresh one.
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

  if (options?.forceNew && container.socket) {
    // Mark before ending: `end()` synchronously emits connection.update/close,
    // and the close handler must not treat our own shutdown as a new drop.
    container.suppressNextClose = true;
    try {
      container.socket.end(new Error('Resetting socket for fresh QR'));
    } catch {}
    container.socket = null;
    container.qrCode = '';
  }

  container.isInitializing = true;
  container.initStartedAt = Date.now();
  container.status = 'connecting';
  await saveSessionMeta(sessionId, { status: 'connecting' });

  try {
    const { state, saveCreds } = await getMongoAuthState(sessionId);

    const logger = pino({ level: 'silent' });

    let waVersion: [number, number, number] | undefined;
    try {
      const v = await fetchLatestBaileysVersion();
      if (v?.version) waVersion = v.version;
    } catch (verErr) {
      console.warn('[Baileys] Version check warning:', verErr);
    }

    const sock = makeWASocket({
      version: waVersion,
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
    });

    container.socket = sock;

    // Handle Connection State Updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, {
            margin: 2,
            scale: 7,
            color: {
              dark: '#0f172a',
              light: '#ffffff',
            },
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

        console.log(`[Baileys] WhatsApp connected successfully as: ${phone} (${pushName})`);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        stopKeepAlive();
        container.lastDisconnectCode = statusCode ?? null;

        console.log(`[Baileys] Connection closed. Reason code: ${statusCode}, loggedOut: ${loggedOut}`);

        // Our own socket.end() (forceNew / logout) lands here. Swallow it so it
        // does not schedule another reconnect.
        if (container.suppressNextClose) {
          container.suppressNextClose = false;
          console.log('[Baileys] Close was self-initiated; skipping reconnect.');
          return;
        }

        if (loggedOut) {
          // Previously this deleted the saved credentials from Mongo, which is
          // why the admin was silently kicked back to the QR screen after a
          // short while. A 401 often means a transient re-registration or a
          // competing session, so we keep the credentials and try to recover.
          // Credentials are only destroyed by logoutWhatsApp(), which is the
          // explicit "Disconnect" button.
          container.status = 'disconnected';
          container.qrCode = '';
          container.socket = null;
          container.isInitializing = false;
          container.requiresReauth = true;

          await saveSessionMeta(sessionId, {
            status: 'disconnected',
            qrCode: '',
          });

          console.warn(
            '[Baileys] Session reported loggedOut (401). Credentials kept; attempting silent reconnect. ' +
              'Re-scan the QR from Admin > WhatsApp if it does not recover.'
          );

          scheduleReconnect(sessionId);
        } else {
          // Reconnect automatically if the network dropped or the container
          // restarted. Reuse the saved credentials (no forceNew) so we do not
          // need a fresh QR and do not trigger another close event.
          container.status = 'connecting';
          container.isInitializing = false;
          scheduleReconnect(sessionId);
        }
      }
    });

    // Handle Credentials Persistence
    sock.ev.on('creds.update', saveCreds);

    // Handle Incoming Messages (Two-Way Live Support Relay)
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify' && type !== 'append') return;
      for (const msg of messages) {
        await handleIncomingMessage(sock, msg);
      }
    });

    // Await first QR code or connection event (max 4.5 seconds)
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
        }, 150);

        setTimeout(() => {
          clearInterval(checkInterval);
          finish();
        }, 4500);
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
      // An explicit logout must not be undone by the auto-reconnect logic, and
      // its close event must not schedule another reconnect.
      container.suppressNextClose = true;
      try {
        await container.socket.logout();
      } catch {
        // non-fatal
      }
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
    // If socket is not running, attempt quick auto-init if creds exist
    if (!container.socket || container.status !== 'connected') {
      const meta = await getSessionMeta(DEFAULT_SESSION_ID);
      if (meta.status === 'connected') {
        await initializeWhatsApp();
      }
    }

    if (!container.socket || container.status !== 'connected') {
      return { ok: false, error: 'WhatsApp is not connected on admin panel' };
    }

    const jid = formatPhoneToJid(toNumber);
    if (!jid) {
      return { ok: false, error: 'Invalid recipient phone number' };
    }

    await container.socket.sendMessage(jid, { text });
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
    if (!container.socket || container.status !== 'connected') {
      const meta = await getSessionMeta(DEFAULT_SESSION_ID);
      if (meta.status === 'connected') {
        await initializeWhatsApp();
      }
    }

    if (!container.socket || container.status !== 'connected') {
      return { ok: false, error: 'WhatsApp not connected to receive alerts' };
    }

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

    // Recipient priority:
    // 1. Target bot-specific WhatsApp number if provided (from bot handoff or bot notification settings)
    // 2. Admin WhatsApp number from NOTIFY_WHATSAPP
    // 3. Admin self-message on connected WhatsApp session
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
      : container.jid || jidNormalizedUser(container.socket.user?.id || '');

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
        const sentMsg = await container.socket.sendMessage(jid, { text: formattedMessage });
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
