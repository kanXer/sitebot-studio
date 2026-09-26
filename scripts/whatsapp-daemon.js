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
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const loggedOut = statusCode === DisconnectReason.loggedOut;
          if (keepAliveTimer) clearInterval(keepAliveTimer);

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

      // Listen for incoming messages to reply to live support tickets
      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify' && type !== 'append') return;
        for (const msg of messages) {
          if (!msg.message) continue;
          const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            '';
          if (!text) continue;

          const match = text.match(/TICK-[A-Z0-9]+/i);
          if (!match) continue;

          const ticketId = match[0].toUpperCase();
          const cleanText = text.replace(new RegExp(`^#?${ticketId}\\s*[-:]*\\s*`, 'i'), '').trim();

          console.log(`[Daemon] Received live reply for Ticket #${ticketId}: "${cleanText}"`);
          try {
            const ticketsCol = db.collection('chattickets');
            const conversationsCol = db.collection('conversations');

            const ticket = await ticketsCol.findOne({ ticketId });
            if (!ticket) continue;

            const now = new Date();
            await ticketsCol.updateOne(
              { ticketId },
              {
                $set: {
                  status: 'admin_replied',
                  lastAdminReply: cleanText,
                  updatedAt: now,
                },
                $push: {
                  messages: {
                    id: String(Date.now()),
                    role: 'agent',
                    senderName: sock.user?.name || 'Rivafy Support',
                    content: cleanText,
                    timestamp: now,
                  },
                },
              }
            );

            if (ticket.sessionId) {
              await conversationsCol.updateMany(
                { sessionId: ticket.sessionId },
                {
                  $set: { status: 'agent_active', lastMessageAt: now },
                  $push: {
                    messages: {
                      role: 'agent',
                      senderName: sock.user?.name || 'Rivafy Support',
                      content: cleanText,
                      timestamp: now,
                    },
                  },
                }
              );
            }

            const senderJid = msg.key.remoteJid;
            if (senderJid) {
              await sock.sendMessage(senderJid, {
                text: `✅ *Sent to Visitor Chat* [Ticket #${ticketId}]\n"${cleanText}"`,
              });
            }
          } catch (replyErr) {
            console.error('[Daemon] Error processing ticket reply:', replyErr);
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
