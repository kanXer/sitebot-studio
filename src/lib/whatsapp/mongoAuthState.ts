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
}

// In-memory fallback map when running without MongoDB connection
const memoryAuthStore = new Map<string, string>();

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
            sessionId,
            keyId: sanitizeKey(keyId),
            data: serialized,
            updatedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
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

  try {
    await connectToDatabase();
    if (!isUsingMemoryDb()) {
      const record = await WhatsAppAuth.findOne({ _id: compositeId }).lean();
      if (record && record.data) {
        return JSON.parse(record.data, BufferJSON.reviver) as T;
      }
      return null;
    }
  } catch (err) {
    console.warn('[WhatsAppAuth] MongoDB read failed, falling back to memory store:', err);
  }

  const raw = memoryAuthStore.get(compositeId);
  if (!raw) return null;
  return JSON.parse(raw, BufferJSON.reviver) as T;
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
      return;
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
  return (
    meta || {
      status: 'disconnected',
    }
  );
}

/**
 * Baileys Auth State Factory backed by MongoDB
 */
export async function getMongoAuthState(sessionId = 'admin_primary'): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearSession: () => Promise<void>;
}> {
  const creds: AuthenticationCreds =
    (await readKey<AuthenticationCreds>(sessionId, 'creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(
          type: T,
          ids: string[]
        ): Promise<{ [key: string]: SignalDataTypeMap[T] }> => {
          const data: { [key: string]: SignalDataTypeMap[T] } = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readKey<SignalDataTypeMap[T]>(
                sessionId,
                `${type}-${id}`
              );
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(
                  value as object
                ) as unknown as SignalDataTypeMap[T];
              }
              if (value) {
                data[id] = value;
              }
            })
          );
          return data;
        },
        set: async (data: Record<string, Record<string, unknown>>) => {
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const fileKey = `${category}-${id}`;
              if (value) {
                tasks.push(writeKey(sessionId, fileKey, value));
              } else {
                tasks.push(removeKey(sessionId, fileKey));
              }
            }
          }
          await Promise.all(tasks);
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
