/**
 * WhatsApp 24/7 Background Relay Daemon
 * Run this standalone worker on any persistent server (Railway, Render, VPS, PM2, Docker, or Local)
 * to maintain a continuous 24/7 WhatsApp connection for two-way live support handoff.
 * 
 * Usage:
 *   npm run whatsapp:daemon
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const makeWASocket = require('@whiskeysockets/baileys').default;
const {
  DisconnectReason,
  Browsers,
  BufferJSON,
  initAuthCreds,
  jidNormalizedUser,
  isJidBroadcast,
} = require('@whiskeysockets/baileys');
const pino = require('pino');

// Load environment variables from .env or .env.local if present
const envFiles = [path.join(__dirname, '../.env.local'), path.join(__dirname, '../.env')];
for (const envPath of envFiles) {
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const SESSION_ID = 'admin_primary';
const MONGODB_URI = process.env.MONGODB_URI;

console.log('─────────────────────────────────────────────────────────────');
console.log('🤖 Rivafy Studio WhatsApp Relay Daemon');
console.log('─────────────────────────────────────────────────────────────');

if (!MONGODB_URI) {
  console.error('[Daemon Error] MONGODB_URI is not defined in environment variables.');
  process.exit(1);
}

// WhatsAppAuth MongoDB Collection Helper
function sanitizeKey(key) {
  return key.replace(/\//g, '__').replace(/:/g, '-');
}

const memoryAuthStore = new Map();

async function getMongoAuthState(db, sessionId) {
  const collection = db.collection('whatsapp_auth');

  async function readKey(keyId) {
    const compositeId = `${sessionId}:${sanitizeKey(keyId)}`;
    const cached = memoryAuthStore.get(compositeId);
    if (cached) {
      try {
        return JSON.parse(cached, BufferJSON.reviver);
      } catch {}
    }
    const doc = await collection.findOne({ _id: compositeId });
    if (!doc || !doc.data) return null;
    memoryAuthStore.set(compositeId, doc.data);
    try {
      return JSON.parse(doc.data, BufferJSON.reviver);
    } catch {
      return null;
    }
  }

  async function writeKey(keyId, data) {
    const compositeId = `${sessionId}:${sanitizeKey(keyId)}`;
    const serialized = JSON.stringify(data, BufferJSON.replacer);
    memoryAuthStore.set(compositeId, serialized);
    await collection.updateOne(
      { _id: compositeId },
      {
        $set: {
          _id: compositeId,
          sessionId,
          keyId: sanitizeKey(keyId),
          data: serialized,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }

  let creds = await readKey('creds');
  if (!creds) {
    creds = initAuthCreds();
    await writeKey('creds', creds);
  }

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          if (!ids || ids.length === 0) return data;

          const missingCompositeIds = [];
          const keyMap = new Map();

          for (const id of ids) {
            const rawKey = `${type}-${id}`;
            const compositeId = `${sessionId}:${sanitizeKey(rawKey)}`;
            keyMap.set(compositeId, id);

            const cached = memoryAuthStore.get(compositeId);
            if (cached) {
              try {
                data[id] = JSON.parse(cached, BufferJSON.reviver);
              } catch {}
            } else {
              missingCompositeIds.push(compositeId);
            }
          }

          if (missingCompositeIds.length > 0) {
            const docs = await collection.find({ _id: { $in: missingCompositeIds } }).toArray();
            for (const doc of docs) {
              const id = keyMap.get(doc._id);
              if (id && doc.data) {
                try {
                  memoryAuthStore.set(doc._id, doc.data);
                  data[id] = JSON.parse(doc.data, BufferJSON.reviver);
                } catch {}
              }
            }
          }

          return data;
        },
        set: async (data) => {
          const bulkOps = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const rawKey = `${category}-${id}`;
              const compositeId = `${sessionId}:${sanitizeKey(rawKey)}`;

              if (value) {
                const serialized = JSON.stringify(value, BufferJSON.replacer);
                memoryAuthStore.set(compositeId, serialized);
                bulkOps.push({
                  updateOne: {
                    filter: { _id: compositeId },
                    update: {
                      $set: {
                        _id: compositeId,
                        sessionId,
                        keyId: sanitizeKey(rawKey),
                        data: serialized,
                        updatedAt: new Date(),
                      },
                    },
                    upsert: true,
                  },
                });
              } else {
                memoryAuthStore.delete(compositeId);
                bulkOps.push({
                  deleteOne: {
                    filter: { _id: compositeId },
                  },
                });
              }
            }
          }

          if (bulkOps.length > 0) {
            await collection.bulkWrite(bulkOps, { ordered: false });
          }
        },
      },
    },
    saveCreds: async () => {
      await writeKey('creds', creds);
    },
    saveMeta: async (meta) => {
      const existing = (await readKey('meta')) || { status: 'disconnected' };
      const updated = {
        ...existing,
        ...meta,
        updatedAt: new Date().toISOString(),
      };
      await writeKey('meta', updated);
    },
    readMeta: async () => {
      return (await readKey('meta')) || { status: 'disconnected' };
    },
  };
}

let activeSocket = null;
let keepAliveTimer = null;
let reconnectTimer = null;
let reconnectAttempts = 0;

function startKeepAlive(sock) {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  keepAliveTimer = setInterval(() => {
    if (activeSocket !== sock) return;
    try {
      sock.sendPresenceUpdate('available').catch(() => {});
      if (sock.ws && typeof sock.ws.ping === 'function') {
        sock.ws.ping();
      }
    } catch {}
  }, 15000);
}

let outboundDispatcherTimer = null;

function formatPhoneToJid(phone) {
  if (!phone) return '';
  const clean = String(phone).replace(/[^0-9]/g, '');
  if (!clean) return '';
  return `${clean}@s.whatsapp.net`;
}

function startOutboundTicketDispatcher(sock, db) {
  if (outboundDispatcherTimer) clearInterval(outboundDispatcherTimer);

  const checkPendingTickets = async () => {
    if (activeSocket !== sock) return;
    try {
      const ticketsCol = db.collection('chat_tickets');
      const chatbotsCol = db.collection('chatbots');

      // Find tickets waiting for admin that have not been dispatched
      const pendingTickets = await ticketsCol
        .find({
          status: 'waiting_admin',
          $or: [
            { alertMessageId: { $exists: false } },
            { alertMessageId: '' },
            { alertMessageId: null },
          ],
        })
        .limit(5)
        .toArray();

      for (const ticket of pendingTickets) {
        let bot = null;
        try {
          if (ticket.botId) {
            let queryId = ticket.botId;
            if (typeof ticket.botId === 'string' && mongoose.Types.ObjectId.isValid(ticket.botId)) {
              queryId = new mongoose.Types.ObjectId(ticket.botId);
            }
            bot = await chatbotsCol.findOne({
              $or: [{ _id: queryId }, { slug: String(ticket.botId).toLowerCase() }],
            });
          }
        } catch {}

        const targetNumber =
          bot?.handoff?.whatsappEnabled && bot?.handoff?.whatsappNumber
            ? bot.handoff.whatsappNumber
            : bot?.handoff?.whatsappNumber
            ? bot.handoff.whatsappNumber
            : bot?.notifications?.whatsapp?.enabled && bot?.notifications?.whatsapp?.number
            ? bot.notifications.whatsapp.number
            : bot?.whatsapp || bot?.phone || undefined;

        const targetJids = [];
        let primaryTargetJid = '';
        if (targetNumber && String(targetNumber).trim()) {
          const jid = formatPhoneToJid(String(targetNumber).trim());
          if (jid) {
            targetJids.push(jid);
            primaryTargetJid = jid;
          }
        }

        // Only fallback to admin if NO website owner number exists
        if (targetJids.length === 0) {
          const envAdminPhone = process.env.NOTIFY_WHATSAPP;
          const adminTargetJid = envAdminPhone
            ? formatPhoneToJid(envAdminPhone)
            : jidNormalizedUser(sock.user?.id || '');

          if (adminTargetJid) {
            targetJids.push(adminTargetJid);
            primaryTargetJid = adminTargetJid;
          }
        }

        if (targetJids.length === 0) continue;

        const formattedMessage =
          `🔴 *New Support Request* [Ticket: #${ticket.ticketId}]\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `*Bot:* ${ticket.botName || bot?.name || 'Rivafy Assistant'}\n` +
          `*Visitor:* ${ticket.visitor?.name || 'Website Visitor'}` +
          (ticket.visitor?.email ? ` (${ticket.visitor.email})` : '') +
          (ticket.visitor?.phone ? ` [${ticket.visitor.phone}]` : '') +
          `\n\n` +
          `💬 *Visitor message:*\n"${ticket.lastUserMessage || 'Human assistance requested'}"\n\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `👉 *To Reply:* Quote-reply to this message, or type your reply directly!\n` +
          `👉 *To Close:* Reply /close`;

        let sentMsgId = '';
        for (const jid of targetJids) {
          try {
            const sentMsg = await sock.sendMessage(jid, { text: formattedMessage });
            if (sentMsg?.key?.id) sentMsgId = sentMsg.key.id;
            console.log(`[Daemon Bridge] Alert dispatched for #${ticket.ticketId} to Website Owner ${jid} (msgId: ${sentMsgId})`);
          } catch (sendErr) {
            console.warn(`[Daemon] Error dispatching alert for Ticket #${ticket.ticketId} to ${jid}:`, sendErr?.message || sendErr);
          }
        }

        if (sentMsgId) {
          await ticketsCol.updateOne(
            { _id: ticket._id },
            {
              $set: {
                alertMessageId: sentMsgId,
                assignedAdminJid: primaryTargetJid,
                updatedAt: new Date(),
              },
            }
          );
          console.log(`[Daemon] 🚀 Outbound alert dispatched for Ticket #${ticket.ticketId} to ${targetJids.join(', ')}`);
        }
      }
    } catch {
      // non-fatal
    }
  };

  outboundDispatcherTimer = setInterval(checkPendingTickets, 2500);
  checkPendingTickets().catch(() => {});
}

async function startDaemon() {
  try {
    console.log('[Daemon] Connecting to MongoDB Atlas...');
    const conn = await mongoose.connect(MONGODB_URI, { bufferCommands: false });
    const db = conn.connection.db;
    console.log('[Daemon] Connected to MongoDB Atlas successfully.');

    const auth = await getMongoAuthState(db, SESSION_ID);
    const meta = await auth.readMeta();

    console.log(`[Daemon] Session state: ${meta.status || 'disconnected'} (Phone: +${meta.phoneNumber || 'None'})`);

    const connectSocket = async () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      console.log('[Daemon] Initializing WhatsApp Baileys socket...');
      const logger = pino({ level: 'silent' });

      const sock = makeWASocket({
        auth: auth.state,
        logger,
        printQRInTerminal: true,
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

      activeSocket = sock;

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log('[Daemon] New QR Code generated. Scan with WhatsApp to pair.');
        }

        if (connection === 'open') {
          const rawJid = sock.user?.id || '';
          const normalized = jidNormalizedUser(rawJid);
          const phone = normalized.split('@')[0] || '';
          const pushName = sock.user?.name || 'Rivafy Admin';

          console.log(`[Daemon] ✅ WhatsApp connected permanently as: +${phone} (${pushName})`);
          reconnectAttempts = 0;

          await auth.saveMeta({
            status: 'connected',
            phoneNumber: phone,
            pushName,
            jid: normalized,
            qrCode: '',
            lastConnectedAt: new Date().toISOString(),
          });

          startKeepAlive(sock);
          startOutboundTicketDispatcher(sock, db);
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const loggedOut = statusCode === DisconnectReason.loggedOut;
          if (keepAliveTimer) clearInterval(keepAliveTimer);
          if (outboundDispatcherTimer) clearInterval(outboundDispatcherTimer);

          console.log(`[Daemon] Connection closed. Reason code: ${statusCode}, loggedOut: ${loggedOut}`);

          if (loggedOut) {
            console.warn('[Daemon] WhatsApp logged out from phone. Please visit /admin/whatsapp to generate a new QR.');
            await auth.saveMeta({ status: 'disconnected', qrCode: '' });
          } else {
            reconnectAttempts += 1;
            const isImmediate = statusCode === DisconnectReason.restartRequired || statusCode === 515;
            const delay = isImmediate ? 500 : Math.min(500 * Math.pow(1.5, Math.min(reconnectAttempts - 1, 6)), 8000);
            console.log(`[Daemon] Auto-reconnecting in ${delay}ms (attempt #${reconnectAttempts})...`);
            reconnectTimer = setTimeout(connectSocket, delay);
          }
        }
      });

      sock.ev.on('creds.update', async () => {
        try {
          await auth.saveCreds();
        } catch (e) {
          console.error('[Daemon] Error saving creds:', e);
        }
      });

      // Listen for incoming messages to reply to live support tickets (Bridge Mode)
      sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify" && type !== "append") return;
        for (const msg of messages) {
          if (!msg.message) continue;
          const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            msg.message.videoMessage?.caption ||
            "";
          const cleanText = text.trim();
          if (!cleanText) continue;

          // Ignore automated echo alerts
          if (
            cleanText.includes("🔴 *New Support Request*") ||
            cleanText.includes("✅ *Sent to Visitor Chat*") ||
            cleanText.includes("Visitor is seeing this live in the website chat") ||
            cleanText.includes("Visitor chat has been restored to AI auto-reply mode")
          ) {
            continue;
          }

          let match = cleanText.match(/TICK-[A-Z0-9]+/i);
          let ticketId = match ? match[0].toUpperCase() : null;

          const contextInfo =
            msg.message.extendedTextMessage?.contextInfo ||
            msg.message.imageMessage?.contextInfo ||
            msg.message.videoMessage?.contextInfo;
          const stanzaId = contextInfo?.stanzaId;
          const quotedText =
            contextInfo?.quotedMessage?.conversation ||
            contextInfo?.quotedMessage?.extendedTextMessage?.text ||
            "";

          if (!ticketId && quotedText) {
            const qMatch = quotedText.match(/TICK-[A-Z0-9]+/i);
            if (qMatch) ticketId = qMatch[0].toUpperCase();
          }

          const rawSenderJid = msg.key.remoteJid || "";
          const senderJid = jidNormalizedUser(rawSenderJid);
          const senderDigits = senderJid.replace(/[^0-9]/g, "");

          const ticketsCol = db.collection("chat_tickets");
          const conversationsCol = db.collection("conversations");

          let ticket = null;
          // Strategy 1: Explicit ticket ID in text
          if (ticketId) {
            ticket = await ticketsCol.findOne({ ticketId });
          }
          // Strategy 2: Quoted WhatsApp message stanzaId matches alertMessageId
          if (!ticket && stanzaId) {
            ticket = await ticketsCol.findOne({ alertMessageId: stanzaId });
            if (ticket) ticketId = ticket.ticketId;
          }
          // Strategy 3: Match by Website Owner phone / JID
          if (!ticket && senderDigits && senderDigits.length >= 7) {
            const last10 = senderDigits.slice(-10);
            ticket = await ticketsCol.findOne(
              {
                status: { $in: ["waiting_admin", "open", "admin_replied"] },
                $or: [
                  { assignedAdminJid: senderJid },
                  { assignedAdminJid: rawSenderJid },
                  { assignedAdminJid: { $regex: last10 } },
                ],
              },
              { sort: { updatedAt: -1 } }
            );
            if (ticket) ticketId = ticket.ticketId;
          }

          if (!ticket) continue;

          // Handle /close command
          const isClose =
            cleanText.toLowerCase().trim() === "/close" ||
            cleanText.toLowerCase().trim() === "close" ||
            cleanText.toLowerCase().includes("/close") ||
            cleanText.toLowerCase() === `#${ticket.ticketId.toLowerCase()} /close`;

          if (isClose) {
            const now = new Date();
            await ticketsCol.updateOne(
              { ticketId: ticket.ticketId },
              { $set: { status: "closed", closedAt: now, updatedAt: now } }
            );
            if (ticket.sessionId) {
              await conversationsCol.updateMany(
                { sessionId: ticket.sessionId },
                {
                  $set: { status: "resolved", lastMessageAt: now },
                  $push: {
                    messages: {
                      id: String(Date.now()),
                      role: "system",
                      content: "Support agent closed this session via WhatsApp. AI assistant resumed.",
                      timestamp: now,
                    },
                  },
                }
              );
            }
            if (rawSenderJid) {
              await sock.sendMessage(rawSenderJid, {
                text: `✅ *Ticket #${ticket.ticketId} Closed*\nVisitor chat has been restored to AI auto-reply mode.`,
              });
            }
            continue;
          }

          const replyContent = cleanText.replace(new RegExp(`^#?${ticket.ticketId}\\s*[-:]*\\s*`, "i"), "").trim() || cleanText;
          const now = new Date();
          const agentName = ticket.botName || "Support Agent";

          await ticketsCol.updateOne(
            { ticketId: ticket.ticketId },
            {
              $set: {
                status: "admin_replied",
                lastAdminReply: replyContent,
                updatedAt: now,
              },
              $push: {
                messages: {
                  id: String(Date.now()),
                  role: "agent",
                  senderName: agentName,
                  content: replyContent,
                  timestamp: now,
                },
              },
            }
          );

          if (ticket.sessionId) {
            await conversationsCol.updateMany(
              { sessionId: ticket.sessionId },
              {
                $set: { status: "agent_active", lastMessageAt: now },
                $push: {
                  messages: {
                    id: String(Date.now()),
                    role: "agent",
                    senderName: agentName,
                    content: replyContent,
                    timestamp: now,
                  },
                },
              }
            );
          }

          if (rawSenderJid) {
            await sock.sendMessage(rawSenderJid, {
              text: `✅ *Sent to Visitor Chat* [Ticket: #${ticket.ticketId}]\n"${replyContent}"\n\n_(Visitor is seeing this live in the website chat)_`,
            });
          }
        }
      });
    };

    await connectSocket();
  } catch (err) {
    console.error('[Daemon] Fatal error:', err);
    setTimeout(startDaemon, 5000);
  }
}

process.on('uncaughtException', (err) => {
  console.error('[Daemon] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Daemon] Unhandled rejection:', reason);
});

startDaemon();
