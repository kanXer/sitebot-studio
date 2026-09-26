/**
 * MongoDB Auth State Adapter for Baileys WhatsApp Web Client
 * Replaces the local multi-file filesystem storage with persistent MongoDB documents.
 * Uses Baileys BufferJSON replacer/reviver so binary buffers, keys, and credentials
 * serialize/deserialize without loss across server restarts and serverless environments.
 */

import {
  AuthenticationCreds,
  AuthenticationState,
  BufferJSON,
  initAuthCreds,
  proto,
  SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { WhatsAppAuth } from '@/lib/models/WhatsAppAuth';

export interface WhatsAppSessionMeta {
  status: 'disconnected' | 'connecting' | 'connected';
  qrCode?: string;
  phoneNumber?: string;
  pushName?: string;
  jid?: string;
  lastConnectedAt?: Date | string;
  updatedAt?: Date | string;
  dbMode?: 'mongodb' | 'memory';
}

// In-memory fallback map when running without MongoDB connection
const memoryAuthStore = new Map<string, string>();

/**
 * Check if the active storage is real MongoDB or in-memory fallback
 */
export async function getAuthStorageMode(): Promise<'mongodb' | 'memory'> {
  try {
    const conn = await connectToDatabase();
    if (conn && !isUsingMemoryDb()) {
      return 'mongodb';
    }
  } catch {
    // fallback
  }
  return 'memory';
}

/**
 * Clean key ID string for storage
 */
function sanitizeKey(key: string): string {
  return key.replace(/\//g, '__').replace(/:/g, '-');
}

/**
 * Write a key-value record to MongoDB (or memory store)
 */
async function writeKey(
  sessionId: string,
  keyId: string,
  data: unknown
): Promise<void> {
  const serialized = JSON.stringify(data, BufferJSON.replacer);
  const compositeId = `${sessionId}:${sanitizeKey(keyId)}`;

  try {
    await connectToDatabase();
    if (!isUsingMemoryDb()) {
      await WhatsAppAuth.findOneAndUpdate(
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
        { upsert: true, new: true }
      );
      // Also cache in memory for fast lookup in warm container
      memoryAuthStore.set(compositeId, serialized);
      return;
    }
  } catch (err) {
    console.warn('[WhatsAppAuth] MongoDB write failed, using memory store:', err);
  }

  memoryAuthStore.set(compositeId, serialized);
}

/**
 * Read a key-value record from MongoDB (or memory store)
 */
async function readKey<T = unknown>(
  sessionId: string,
  keyId: string
): Promise<T | null> {
  const compositeId = `${sessionId}:${sanitizeKey(keyId)}`;

  // Check warm in-memory cache first
  const cached = memoryAuthStore.get(compositeId);
  if (cached) {
    try {
      return JSON.parse(cached, BufferJSON.reviver) as T;
    } catch {}
  }

  try {
    await connectToDatabase();
    if (!isUsingMemoryDb()) {
      const record = await WhatsAppAuth.findOne({ _id: compositeId }).lean();
      if (record && record.data) {
        memoryAuthStore.set(compositeId, record.data);
        return JSON.parse(record.data, BufferJSON.reviver) as T;
      }
      return null;
    }
  } catch (err) {
    console.warn('[WhatsAppAuth] MongoDB read failed, falling back to memory store:', err);
  }

  return null;
}

/**
 * Remove a key-value record from MongoDB (or memory store)
 */
async function removeKey(sessionId: string, keyId: string): Promise<void> {
  const compositeId = `${sessionId}:${sanitizeKey(keyId)}`;

  try {
    await connectToDatabase();
    if (!isUsingMemoryDb()) {
      await WhatsAppAuth.deleteOne({ _id: compositeId });
    }
  } catch (err) {
    console.warn('[WhatsAppAuth] MongoDB remove failed:', err);
  }

  memoryAuthStore.delete(compositeId);
}

/**
 * Clear all auth data for a given session
 */
export async function clearWhatsAppSession(sessionId: string): Promise<void> {
  try {
    await connectToDatabase();
    if (!isUsingMemoryDb()) {
      await WhatsAppAuth.deleteMany({ sessionId });
    }
  } catch (err) {
    console.warn('[WhatsAppAuth] MongoDB clearSession failed:', err);
  }

  // Clear in-memory keys for this session
  for (const key of memoryAuthStore.keys()) {
    if (key.startsWith(`${sessionId}:`)) {
      memoryAuthStore.delete(key);
    }
  }
}

/**
 * Save meta state (status, QR code, phone number, etc.)
 */
export async function saveSessionMeta(
  sessionId: string,
  meta: Partial<WhatsAppSessionMeta>
): Promise<void> {
  const existing = (await readKey<WhatsAppSessionMeta>(sessionId, 'meta')) || {
    status: 'disconnected',
  };
  const updated: WhatsAppSessionMeta = {
    ...existing,
    ...meta,
    updatedAt: new Date().toISOString(),
  };
  await writeKey(sessionId, 'meta', updated);
}

/**
 * Read meta state (status, QR code, phone number, etc.)
 */
export async function getSessionMeta(
  sessionId: string
): Promise<WhatsAppSessionMeta> {
  const meta = await readKey<WhatsAppSessionMeta>(sessionId, 'meta');
  const dbMode = await getAuthStorageMode();
  return {
    status: 'disconnected',
    ...(meta || {}),
    dbMode,
  };
}

/**
 * Baileys Auth State Factory backed by MongoDB
 */
export async function getMongoAuthState(sessionId = 'admin_primary'): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearSession: () => Promise<void>;
}> {
  // Preload all session keys into warm in-memory cache in ONE single batch query
  // This turns dozens of subsequent round-trips to remote MongoDB Atlas into instant 0ms memory lookups!
  try {
    await connectToDatabase();
    if (!isUsingMemoryDb()) {
      const allDocs = await WhatsAppAuth.find({ sessionId }).lean();
      for (const doc of allDocs) {
        if (doc && doc._id && doc.data) {
          memoryAuthStore.set(doc._id, doc.data);
        }
      }
    }
  } catch (preloadErr) {
    console.warn('[WhatsAppAuth] Auth keys batch preload warning:', preloadErr);
  }

  let creds: AuthenticationCreds | null = await readKey<AuthenticationCreds>(sessionId, 'creds');
  if (!creds) {
    creds = initAuthCreds();
    // Persist initial creds immediately so subsequent calls use the same keypair
    await writeKey(sessionId, 'creds', creds);
  }

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(
          type: T,
          ids: string[]
        ): Promise<{ [key: string]: SignalDataTypeMap[T] }> => {
          const data: { [key: string]: SignalDataTypeMap[T] } = {};
          if (!ids || ids.length === 0) return data;

          const keyMap = new Map<string, string>(); // compositeId -> id
          const compositeIds: string[] = [];

          for (const id of ids) {
            const rawKey = `${type}-${id}`;
            const compositeId = `${sessionId}:${sanitizeKey(rawKey)}`;
            keyMap.set(compositeId, id);
            compositeIds.push(compositeId);

            // Fast path: check in-memory cache
            const cached = memoryAuthStore.get(compositeId);
            if (cached) {
              try {
                let parsed = JSON.parse(cached, BufferJSON.reviver);
                if (type === 'app-state-sync-key' && parsed) {
                  parsed = proto.Message.AppStateSyncKeyData.fromObject(parsed as object);
                }
                data[id] = parsed as SignalDataTypeMap[T];
              } catch {}
            }
          }

          // Fetch missing keys from MongoDB in a single batch query
          const missingCompositeIds = compositeIds.filter((cid) => {
            const id = keyMap.get(cid);
            return id && !data[id];
          });

          if (missingCompositeIds.length > 0) {
            try {
              await connectToDatabase();
              if (!isUsingMemoryDb()) {
                const records = await WhatsAppAuth.find({
                  _id: { $in: missingCompositeIds },
                }).lean();

                for (const record of records) {
                  const id = keyMap.get(record._id);
                  if (id && record.data) {
                    try {
                      memoryAuthStore.set(record._id, record.data);
                      let parsed = JSON.parse(record.data, BufferJSON.reviver);
                      if (type === 'app-state-sync-key' && parsed) {
                        parsed = proto.Message.AppStateSyncKeyData.fromObject(parsed as object);
                      }
                      data[id] = parsed as SignalDataTypeMap[T];
                    } catch {}
                  }
                }
              }
            } catch (err) {
              console.warn('[WhatsAppAuth] Batch read failed:', err);
            }
          }

          return data;
        },
        set: async (data: Record<string, Record<string, unknown>>) => {
          const bulkOps: any[] = [];

          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const fileKey = `${category}-${id}`;
              const compositeId = `${sessionId}:${sanitizeKey(fileKey)}`;

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
                        keyId: sanitizeKey(fileKey),
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
            try {
              await connectToDatabase();
              if (!isUsingMemoryDb()) {
                await WhatsAppAuth.bulkWrite(bulkOps, { ordered: false });
              }
            } catch (err) {
              console.warn('[WhatsAppAuth] Bulk write failed:', err);
            }
          }
        },
      },
    },
    saveCreds: async () => {
      await writeKey(sessionId, 'creds', creds);
    },
    clearSession: async () => {
      await clearWhatsAppSession(sessionId);
    },
  };
}
