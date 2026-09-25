import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Chatbot, CrawledPage, DocumentChunk, BotForm, FormSubmission } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { isAdminEmail } from '@/lib/auth/adminAuth';
import { deleteQdrantBotChunks, isQdrantConfigured } from '@/lib/vector/qdrant';

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

    let bots: any[] = [];
    if (isUsingMemoryDb()) {
      bots = MemoryDb.findChatbots();
      bots = bots.map((b) => ({
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
      const allBots = await Chatbot.find().sort({ createdAt: -1 }).lean();

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
  } catch (error: any) {
    console.error('Error in admin bots GET:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch admin bot list' },
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
    const body = await req.json();
    const { botId, status, ownerEmail } = body;

    if (!botId) {
      return NextResponse.json({ error: 'botId is required' }, { status: 400 });
    }

    const updateFields: any = {};
    if (status !== undefined) {
      if (!['active', 'disabled'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
      }
      updateFields.status = status;
    }
    if (ownerEmail !== undefined) {
      updateFields.ownerEmail = String(ownerEmail).toLowerCase().trim();
    }

    if (isUsingMemoryDb()) {
      const updated = MemoryDb.updateChatbot(botId, updateFields);
      if (!updated) {
        return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, bot: updated });
    } else {
      if (!mongoose.Types.ObjectId.isValid(botId)) {
        return NextResponse.json({ error: 'Invalid bot ID' }, { status: 400 });
      }
      const updated = await Chatbot.findByIdAndUpdate(botId, updateFields, {
        returnDocument: 'after',
      }).lean();

      if (!updated) {
        return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, bot: updated });
    }
  } catch (error: any) {
    console.error('Error in admin bots PATCH:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update chatbot status' },
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

    if (!botId) {
      return NextResponse.json({ error: 'botId is required' }, { status: 400 });
    }

    if (isUsingMemoryDb()) {
      const bot = MemoryDb.findChatbotById(botId);
      if (!bot) {
        return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
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
      const bot = await Chatbot.findById(botObjectId).lean();
      if (!bot) {
        return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
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
  } catch (error: any) {
    console.error('Error in admin bots DELETE:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete chatbot' },
      { status: 500 }
    );
  }
}
