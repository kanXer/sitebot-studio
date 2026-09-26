import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Chatbot, CrawledPage, DocumentChunk, BotForm, FormSubmission } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { isAdminEmail } from '@/lib/auth/adminAuth';
import { deleteQdrantBotChunks, isQdrantConfigured } from '@/lib/vector/qdrant';

interface AdminBotSummary {
  id: string;
  slug?: string;
  name: string;
  siteUrl: string;
  primaryColor: string;
  chatProvider: string;
  chatModel: string;
  ownerEmail?: string;
  ownerName?: string;
  status?: string;
  pagesCount: number;
  chunksCount: number;
  formsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CallerIdentity {
  callerEmail: string;
  callerId: string;
}

function getCallerIdentity(req: NextRequest): CallerIdentity {
  const { searchParams } = new URL(req.url);
  const callerEmail = (
    req.headers.get('x-user-email') || searchParams.get('email') || ''
  )
    .toLowerCase()
    .trim();
  const callerId = (req.headers.get('x-user-id') || '').trim();
  return { callerEmail, callerId };
}

/**
 * Owner match used for both the "My Bots" list and for every mutating action on
 * this route, so a caller cannot act on a bot they do not own.
 */
function isOwnedByCaller(
  bot: { ownerEmail?: string; ownerId?: string },
  identity: CallerIdentity
): boolean {
  const { callerEmail, callerId } = identity;
  const ownerEmail = (bot.ownerEmail || '').toLowerCase().trim();
  const ownerId = (bot.ownerId || '').trim();
  if (ownerEmail && callerEmail && ownerEmail === callerEmail) return true;
  if (ownerId && callerId && ownerId === callerId) return true;
  return false;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userEmail = req.headers.get('x-user-email') || searchParams.get('email');

    // Admin authorization check
    const isAuthorized = await isAdminEmail(userEmail);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required.' },
        { status: 403 }
      );
    }

    await connectToDatabase();

    // "My Bots" is scoped to the logged-in admin. Authorization (isAdminEmail)
    // only proves the caller may open /admin; it must not be used to list every
    // bot in the system, which is what this route used to do.
    const identity = getCallerIdentity(req);
    const { callerEmail, callerId } = identity;

    let bots: AdminBotSummary[] = [];
    if (isUsingMemoryDb()) {
      const owned = MemoryDb.findChatbots().filter((b) => isOwnedByCaller(b, identity));
      bots = owned.map((b) => ({
        id: b._id.toString(),
        name: b.name,
        siteUrl: b.siteUrl,
        primaryColor: b.primaryColor,
        chatProvider: b.chatProvider,
        chatModel: b.chatModel,
        ownerEmail: b.ownerEmail || 'Unassigned',
        ownerName: b.ownerName || '',
        status: b.status || 'active',
        pagesCount: MemoryDb.countCrawledPages(b._id),
        chunksCount: MemoryDb.countDocumentChunks(b._id),
        formsCount: MemoryDb.findBotForms(b._id).length,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      }));
    } else {
      const orConditions: Record<string, string>[] = [];
      if (callerEmail) orConditions.push({ ownerEmail: callerEmail });
      if (callerId) orConditions.push({ ownerId: callerId });

      // A caller with no identity at all must not fall back to "everyone".
      const ownerQuery = orConditions.length > 0 ? { $or: orConditions } : { _id: null };

      const allBots = await Chatbot.find(ownerQuery).sort({ createdAt: -1 }).lean();

      // Aggregate page and chunk counts for all bots
      const botIds = allBots.map((b) => b._id);
      const [pageCounts, chunkCounts, formCounts] = await Promise.all([
        CrawledPage.aggregate([
          { $match: { chatbotId: { $in: botIds } } },
          { $group: { _id: '$chatbotId', count: { $sum: 1 } } },
        ]),
        DocumentChunk.aggregate([
          { $match: { chatbotId: { $in: botIds } } },
          { $group: { _id: '$chatbotId', count: { $sum: 1 } } },
        ]),
        BotForm.aggregate([
          { $match: { botId: { $in: botIds } } },
          { $group: { _id: '$botId', count: { $sum: 1 } } },
        ]),
      ]);

      const pageMap = new Map(pageCounts.map((p) => [p._id.toString(), p.count]));
      const chunkMap = new Map(chunkCounts.map((c) => [c._id.toString(), c.count]));
      const formMap = new Map(formCounts.map((f) => [f._id.toString(), f.count]));

      bots = allBots.map((b) => {
        const idStr = b._id.toString();
        return {
          id: idStr,
          slug: b.slug || '',
          name: b.name,
          siteUrl: b.siteUrl,
          primaryColor: b.primaryColor,
          chatProvider: b.chatProvider,
          chatModel: b.chatModel,
          ownerEmail: b.ownerEmail || 'Unassigned',
          ownerName: b.ownerName || '',
          status: b.status || 'active',
          pagesCount: pageMap.get(idStr) || 0,
          chunksCount: chunkMap.get(idStr) || 0,
          formsCount: formMap.get(idStr) || 0,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
        };
      });
    }

    return NextResponse.json({
      success: true,
      bots,
    });
  } catch (error) {
    console.error('Error in admin bots GET:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch admin bot list' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userEmail = req.headers.get('x-user-email');
    const isAuthorized = await isAdminEmail(userEmail);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required.' },
        { status: 403 }
      );
    }

    await connectToDatabase();
    const identity = getCallerIdentity(req);
    const { callerEmail, callerId } = identity;
    const body = (await req.json()) as Record<string, unknown>;
    const botIdValue = body.botId;
    const botId = botIdValue == null ? '' : String(botIdValue);
    const { status, ownerEmail } = body;


    if (!botId) {
      return NextResponse.json({ error: 'botId is required' }, { status: 400 });
    }

    const updateFields: Record<string, unknown> = {};
    if (status !== undefined) {
      if (status !== 'active' && status !== 'disabled') {
        return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
      }
      updateFields.status = status;
    }
    if (ownerEmail !== undefined) {
      updateFields.ownerEmail = String(ownerEmail).toLowerCase().trim();
    }

    if (isUsingMemoryDb()) {
      const existing = MemoryDb.findChatbotById(botId);
      if (!existing) {
        return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
      }
      if (!isOwnedByCaller(existing, identity)) {
        return NextResponse.json({ error: 'Forbidden: this bot belongs to another user' }, { status: 403 });
      }
      const updated = MemoryDb.updateChatbot(botId, updateFields);
      return NextResponse.json({ success: true, bot: updated });
    } else {
      if (!mongoose.Types.ObjectId.isValid(botId)) {
        return NextResponse.json({ error: 'Invalid bot ID' }, { status: 400 });
      }
      const orConditions: Record<string, string>[] = [];
      if (callerEmail) orConditions.push({ ownerEmail: callerEmail });
      if (callerId) orConditions.push({ ownerId: callerId });
      const ownerQuery = orConditions.length > 0 ? { $or: orConditions } : { _id: null };

      const updated = await Chatbot.findOneAndUpdate(
        { _id: botId, ...ownerQuery },
        updateFields,
        { returnDocument: 'after' }
      ).lean();

      if (!updated) {
        return NextResponse.json(
          { error: 'Chatbot not found or not owned by you' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, bot: updated });
    }
  } catch (error) {
    console.error('Error in admin bots PATCH:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update chatbot status' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userEmail = req.headers.get('x-user-email');
    const isAuthorized = await isAdminEmail(userEmail);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required.' },
        { status: 403 }
      );
    }

    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const botId = searchParams.get('botId');
    const identity = getCallerIdentity(req);
    const { callerEmail, callerId } = identity;

    if (!botId) {
      return NextResponse.json({ error: 'botId is required' }, { status: 400 });
    }

    if (isUsingMemoryDb()) {
      const bot = MemoryDb.findChatbotById(botId);
      if (!bot) {
        return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
      }
      if (!isOwnedByCaller(bot, identity)) {
        return NextResponse.json({ error: 'Forbidden: this bot belongs to another user' }, { status: 403 });
      }
      const qdrantConfig = bot.customVectorDb?.enabled ? bot.customVectorDb : undefined;
      if (isQdrantConfigured(qdrantConfig)) {
        await deleteQdrantBotChunks(botId, undefined, qdrantConfig);
      }
      MemoryDb.deleteChatbot(botId);
    } else {
      if (!mongoose.Types.ObjectId.isValid(botId)) {
        return NextResponse.json({ error: 'Invalid bot ID' }, { status: 400 });
      }

      const botObjectId = new mongoose.Types.ObjectId(botId);
      const orConditions: Record<string, string>[] = [];
      if (callerEmail) orConditions.push({ ownerEmail: callerEmail });
      if (callerId) orConditions.push({ ownerId: callerId });
      const ownerQuery = orConditions.length > 0 ? { $or: orConditions } : { _id: null };

      const bot = await Chatbot.findOne({ _id: botObjectId, ...ownerQuery }).lean();
      if (!bot) {
        return NextResponse.json(
          { error: 'Chatbot not found or not owned by you' },
          { status: 404 }
        );
      }

      const qdrantConfig = bot.customVectorDb?.enabled ? bot.customVectorDb : undefined;
      if (isQdrantConfigured(qdrantConfig)) {
        await deleteQdrantBotChunks(botId, undefined, qdrantConfig);
      }

      // Find form IDs for cascade deletion
      const forms = await BotForm.find({ botId: botObjectId }).select('_id').lean();
      const formIds = forms.map((f) => f._id.toString());

      await Promise.all([
        Chatbot.findByIdAndDelete(botObjectId),
        CrawledPage.deleteMany({ chatbotId: botObjectId }),
        DocumentChunk.deleteMany({ chatbotId: botObjectId }),
        BotForm.deleteMany({ botId: botObjectId }),
        formIds.length > 0 ? FormSubmission.deleteMany({ formId: { $in: formIds } }) : Promise.resolve(),
      ]);
    }

    return NextResponse.json({
      success: true,
      message: 'Chatbot and all associated data permanently deleted.',
    });
  } catch (error) {
    console.error('Error in admin bots DELETE:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete chatbot' },
      { status: 500 }
    );
  }
}
