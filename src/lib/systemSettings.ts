import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { SystemSettings } from '@/lib/models/SystemSettings';
import { MemoryDb } from '@/lib/memoryDb';

export interface GlobalSystemConfig {
  defaultChatProvider: 'openai' | 'gemini' | 'nvidia' | 'openrouter';
  defaultChatModel: string;
  defaultEmbedProvider: 'openai' | 'gemini' | 'nvidia';
  defaultEmbedModel: string;
  freePlan: {
    botLimit: number;
    tokenQuota: number;
    chatQuota: number;
    monthlyPrice: number;
  };
  proPlan: {
    botLimit: number;
    tokenQuota: number;
    chatQuota: number;
    monthlyPrice: number;
  };
  byokBypassQuota: boolean;
}

export const DEFAULT_SYSTEM_CONFIG: GlobalSystemConfig = {
  defaultChatProvider: 'nvidia',
  defaultChatModel: 'meta/muse-glimmer-30b',
  defaultEmbedProvider: 'nvidia',
  defaultEmbedModel: 'nvidia/llama-nemotron-embed-vl-1b-v2',
  freePlan: {
    botLimit: 1,
    tokenQuota: 25000, // Reduced as requested (25K tokens)
    chatQuota: 50,     // Reduced as requested (50 messages)
    monthlyPrice: 0,
  },
  proPlan: {
    botLimit: 10,
    tokenQuota: 2500000,
    chatQuota: 50000,
    monthlyPrice: 9,
  },
  byokBypassQuota: true, // Custom API keys bypass token and message quotas
};

/**
 * Retrieves the global system settings from database or memory store.
 */
export async function getSystemSettings(): Promise<GlobalSystemConfig> {
  try {
    await connectToDatabase();

    if (isUsingMemoryDb()) {
      const mem = MemoryDb.getSystemSettings();
      if (mem) return mem;
      return DEFAULT_SYSTEM_CONFIG;
    }

    const doc = await SystemSettings.findOne({ key: 'global_settings' }).lean();
    if (doc) {
      return {
        defaultChatProvider: (doc.defaultChatProvider as any) || DEFAULT_SYSTEM_CONFIG.defaultChatProvider,
        defaultChatModel: doc.defaultChatModel || DEFAULT_SYSTEM_CONFIG.defaultChatModel,
        defaultEmbedProvider: (doc.defaultEmbedProvider as any) || DEFAULT_SYSTEM_CONFIG.defaultEmbedProvider,
        defaultEmbedModel: doc.defaultEmbedModel || DEFAULT_SYSTEM_CONFIG.defaultEmbedModel,
        freePlan: {
          botLimit: doc.freePlan?.botLimit ?? DEFAULT_SYSTEM_CONFIG.freePlan.botLimit,
          tokenQuota: doc.freePlan?.tokenQuota ?? DEFAULT_SYSTEM_CONFIG.freePlan.tokenQuota,
          chatQuota: doc.freePlan?.chatQuota ?? DEFAULT_SYSTEM_CONFIG.freePlan.chatQuota,
          monthlyPrice: doc.freePlan?.monthlyPrice ?? 0,
        },
        proPlan: {
          botLimit: doc.proPlan?.botLimit ?? DEFAULT_SYSTEM_CONFIG.proPlan.botLimit,
          tokenQuota: doc.proPlan?.tokenQuota ?? DEFAULT_SYSTEM_CONFIG.proPlan.tokenQuota,
          chatQuota: doc.proPlan?.chatQuota ?? DEFAULT_SYSTEM_CONFIG.proPlan.chatQuota,
          monthlyPrice: doc.proPlan?.monthlyPrice ?? DEFAULT_SYSTEM_CONFIG.proPlan.monthlyPrice,
        },
        byokBypassQuota: doc.byokBypassQuota ?? DEFAULT_SYSTEM_CONFIG.byokBypassQuota,
      };
    }

    // Initialize default if not present
    await SystemSettings.create({
      key: 'global_settings',
      ...DEFAULT_SYSTEM_CONFIG,
    });
    return DEFAULT_SYSTEM_CONFIG;
  } catch (err) {
    console.warn('[SystemSettings] Could not read settings, returning defaults:', err);
    return DEFAULT_SYSTEM_CONFIG;
  }
}

/**
 * Updates the global system settings.
 */
export async function updateSystemSettings(data: Partial<GlobalSystemConfig>): Promise<GlobalSystemConfig> {
  await connectToDatabase();

  if (isUsingMemoryDb()) {
    return MemoryDb.updateSystemSettings(data);
  }

  const existing = await getSystemSettings();
  const merged: GlobalSystemConfig = {
    defaultChatProvider: data.defaultChatProvider || existing.defaultChatProvider,
    defaultChatModel: data.defaultChatModel || existing.defaultChatModel,
    defaultEmbedProvider: data.defaultEmbedProvider || existing.defaultEmbedProvider,
    defaultEmbedModel: data.defaultEmbedModel || existing.defaultEmbedModel,
    freePlan: {
      ...existing.freePlan,
      ...(data.freePlan || {}),
    },
    proPlan: {
      ...existing.proPlan,
      ...(data.proPlan || {}),
    },
    byokBypassQuota: data.byokBypassQuota !== undefined ? Boolean(data.byokBypassQuota) : existing.byokBypassQuota,
  };

  await SystemSettings.findOneAndUpdate(
    { key: 'global_settings' },
    { $set: merged },
    { upsert: true, new: true }
  );

  return merged;
}
