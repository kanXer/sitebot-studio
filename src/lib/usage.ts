import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { UserProfile } from '@/lib/models/UserProfile';
import { UsageRecord } from '@/lib/models/UsageRecord';
import { Chatbot } from '@/lib/models/Chatbot';
import { MemoryDb } from '@/lib/memoryDb';
import { getPlanInfo } from '@/lib/plans';
import { getSystemSettings } from '@/lib/systemSettings';

export interface ProfileUser {
  userId?: string;
  email: string;
  name?: string;
  avatar?: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getOrCreateProfile(user: ProfileUser | null | undefined): Promise<any> {
  const email = user?.email?.toLowerCase().trim();
  if (!email) return null;
  const safeUser = user as ProfileUser;

  await connectToDatabase();

  if (isUsingMemoryDb()) {
let profile = MemoryDb.findUserProfileByEmail(email);
    if (!profile) {
      profile = MemoryDb.createUserProfile({
        userId: safeUser.userId || '',
        email,
        name: safeUser.name || '',
        avatar: safeUser.avatar || '',
        botLimit: 1,
      });
    }
    return profile;
  }

  let profile = await UserProfile.findOne({ email }).lean();
  if (!profile) {
    profile = await UserProfile.create({
      userId: safeUser.userId || '',
      email,
      name: safeUser.name || '',
      avatar: safeUser.avatar || '',
      botLimit: 1,
    });
  }
  return profile;
}

export async function updateProfile(email: string, data: any): Promise<any> {
  const clean = email?.toLowerCase().trim();
  if (!clean) return null;
  await connectToDatabase();

  if (isUsingMemoryDb()) {
    return MemoryDb.updateUserProfile(clean, data);
  }
  return UserProfile.findOneAndUpdate({ email: clean }, data, {
    new: true,
    runValidators: true,
  }).lean();
}

export async function countUserBots(email?: string | null, userId?: string | null): Promise<number> {
  const clean = email?.toLowerCase().trim();
  const cleanId = userId?.trim();
  if (!clean && !cleanId) return 0;
  await connectToDatabase();

  if (isUsingMemoryDb()) {
    return MemoryDb.findChatbots().filter((b) => {
      if (clean && b.ownerEmail?.toLowerCase() === clean) return true;
      if (cleanId && b.ownerId === cleanId) return true;
      return false;
    }).length;
  }

  const query: any[] = [];
  if (clean) {
    query.push({ ownerEmail: { $regex: new RegExp(`^${clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
  }
  if (cleanId) {
    query.push({ ownerId: cleanId });
  }

  return Chatbot.countDocuments(query.length > 1 ? { $or: query } : query[0]);
}

/**
 * Returns how many additional chatbots the user may still create.
 */
export async function getRemainingBotSlots(user: ProfileUser | null | undefined): Promise<number> {
  const profile = await getOrCreateProfile(user);
  if (!profile) return 0;
  const used = await countUserBots(profile.email, user?.userId);
  const sysSettings = await getSystemSettings().catch(() => null);
  const planSettings = profile.plan === 'pro' ? sysSettings?.proPlan : sysSettings?.freePlan;
  const limit = planSettings?.botLimit ?? (Number(profile.botLimit) || getPlanInfo(profile.plan).botLimit);
  return Math.max(0, limit - used);
}

/**
 * Records token / chat / lead usage for a profile and its daily usage record.
 */
export async function recordUsage(
  user: ProfileUser | null | undefined,
  delta: { inputTokens?: number; outputTokens?: number; chats?: boolean; leads?: boolean }
): Promise<void> {
  const email = user?.email?.toLowerCase().trim();
  if (!email) return;
  await connectToDatabase();

  if (isUsingMemoryDb()) {
    MemoryDb.incrementProfileUsage(email, delta);
    MemoryDb.upsertUsageRecord(email, '', today(), delta);
    return;
  }

  try {
    const profile = await getOrCreateProfile(user);
    if (profile) {
      const usage = profile.usage || {};
      await UserProfile.updateOne(
        { email },
        {
          $inc: {
            'usage.inputTokens': delta.inputTokens || 0,
            'usage.outputTokens': delta.outputTokens || 0,
            'usage.chats': delta.chats ? 1 : 0,
            'usage.leads': delta.leads ? 1 : 0,
          },
        }
      );
    }

    await UsageRecord.updateOne(
      { email, date: today(), botId: '' },
      {
        $inc: {
          inputTokens: delta.inputTokens || 0,
          outputTokens: delta.outputTokens || 0,
          chats: delta.chats ? 1 : 0,
          leads: delta.leads ? 1 : 0,
        },
        $setOnInsert: { email, date: today(), botId: '' },
      },
      { upsert: true }
    );
  } catch (err) {
    console.warn('[Usage] Could not record usage:', err);
  }
}

/**
 * Records a single chat turn against BOTH the chatbot's own usage counters and
 * the bot owner's profile usage + daily usage record, so the dashboard
 * "Conversations & Messages", "AI Tokens" and "Leads" stats update in real time.
 */
export async function trackChatTurn(
  bot: any,
  delta: { inputTokens?: number; outputTokens?: number; chats?: boolean; leads?: boolean }
): Promise<void> {
  const botId = bot?._id ? String(bot._id) : '';
  await connectToDatabase();

  if (botId) {
    try {
      if (isUsingMemoryDb()) {
        if (delta.inputTokens || delta.outputTokens || delta.chats) {
          MemoryDb.incrementChatbotUsage(botId, {
            inputTokens: delta.inputTokens,
            outputTokens: delta.outputTokens,
            chats: delta.chats,
          });
        }
        if (delta.leads) MemoryDb.incrementChatbotLeadCount(botId);
      } else {
        const inc: Record<string, number> = {};
        if (delta.inputTokens) inc['usage.inputTokens'] = delta.inputTokens;
        if (delta.outputTokens) inc['usage.outputTokens'] = delta.outputTokens;
        if (delta.chats) inc['usage.chats'] = 1;
        if (delta.leads) inc['usage.leads'] = 1;
        if (Object.keys(inc).length === 0) return;
        await Chatbot.updateOne({ _id: botId }, { $inc: inc });
      }
    } catch (err) {
      console.warn('[Usage] Could not track chatbot usage:', err);
    }
  }

  if (bot?.ownerEmail) {
    await recordUsage(
      { email: bot.ownerEmail, userId: bot.ownerId || undefined, name: bot.ownerName },
      {
        inputTokens: delta.inputTokens || 0,
        outputTokens: delta.outputTokens || 0,
        chats: delta.chats,
        leads: delta.leads,
      }
    );
  }
}

/**
 * True when the profile has consumed its token or chat quota.
 */
export function isOverQuota(profile: any, sysSettings?: any): boolean {
  if (!profile) return false;
  const usedTokens = (profile.usage?.inputTokens || 0) + (profile.usage?.outputTokens || 0);
  const planSettings = profile.plan === 'pro' ? sysSettings?.proPlan : sysSettings?.freePlan;
  const tokenQuota = planSettings?.tokenQuota ?? (Number(profile.tokenQuota) || getPlanInfo(profile.plan).tokenQuota);
  if (usedTokens >= tokenQuota) return true;
  const chats = profile.usage?.chats || 0;
  const chatQuota = planSettings?.chatQuota ?? (Number(profile.chatQuota) || getPlanInfo(profile.plan).chatQuota);
  return chats >= chatQuota;
}

export function quotaPercent(profile: any): { tokens: number; chats: number } {
  if (!profile) return { tokens: 0, chats: 0 };
  const usedTokens = (profile.usage?.inputTokens || 0) + (profile.usage?.outputTokens || 0);
  const tokenQuota = Number(profile.tokenQuota) || getPlanInfo(profile.plan).tokenQuota;
  const chatQuota = Number(profile.chatQuota) || getPlanInfo(profile.plan).chatQuota;
  return {
    tokens: tokenQuota ? Math.min(100, Math.round((usedTokens / tokenQuota) * 100)) : 0,
    chats: chatQuota ? Math.min(100, Math.round(((profile.usage?.chats || 0) / chatQuota) * 100)) : 0,
  };
}