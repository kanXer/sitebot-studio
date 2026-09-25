import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Chatbot, CrawledPage, DocumentChunk } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { chunkText } from '@/lib/crawler/chunker';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { upsertQdrantChunks, isQdrantConfigured } from '@/lib/vector/qdrant';

interface RouteParams {
  params: Promise<{ botId: string }>;
}

async function resolveKnowledgeBot(botId: string): Promise<any> {
  if (isUsingMemoryDb()) {
    return MemoryDb.findChatbotById(botId);
  }
  let bot: any = null;
  if (mongoose.Types.ObjectId.isValid(botId)) {
    bot = await Chatbot.findById(botId);
  }
  if (!bot) {
    bot = await Chatbot.findOne({ slug: String(botId || '').toLowerCase().trim() });
  }
  return bot;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { botId } = await params;

    const { searchParams } = new URL(req.url);
    const pageUrl = searchParams.get('pageUrl') || undefined;

    const bot = await resolveKnowledgeBot(botId);
    if (!bot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    let chunks: any[] = [];
    let pages: any[] = [];

    if (isUsingMemoryDb()) {
      const key = (bot._id || bot.id).toString();
      chunks = MemoryDb.findDocumentChunks(key, pageUrl);
      pages = MemoryDb.findCrawledPages(key);
    } else {
      const botObjectId = new mongoose.Types.ObjectId(bot._id);
      const query: any = { chatbotId: botObjectId };
      if (pageUrl) query.pageUrl = pageUrl;

      [chunks, pages] = await Promise.all([
        DocumentChunk.find(query)
          .sort({ createdAt: -1 })
          .limit(100)
          .select('-embedding')
          .lean(),
        CrawledPage.find({ chatbotId: botObjectId })
          .sort({ createdAt: -1 })
          .lean(),
      ]);
    }

    return NextResponse.json({
      success: true,
      pages: pages.map((p: any) => ({
        id: p._id.toString(),
        url: p.url,
        title: p.title,
        status: p.status,
        chunkCount: p.chunkCount,
        error: p.error,
        updatedAt: p.updatedAt,
      })),
      chunks: chunks.map((c: any) => ({
        id: c._id.toString(),
        pageUrl: c.pageUrl,
        content: c.content,
        metadata: c.metadata,
        createdAt: c.createdAt,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch knowledge base' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { botId } = await params;

    const bot = await resolveKnowledgeBot(botId);
    if (!bot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    const embedProvider = bot.embedProvider || 'nvidia';
    const apiKey =
      embedProvider === 'nvidia'
        ? bot.apiKeys?.nvidia || process.env.NVIDIA_API_KEY
        : embedProvider === 'openai'
        ? bot.apiKeys?.openai || process.env.OPENAI_API_KEY
        : bot.apiKeys?.gemini || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: `API key for ${embedProvider} is required to embed knowledge snippets` },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { title, content, sourceUrl } = body;

    if (!title || !content || !content.trim()) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const resolvedUrl =
      sourceUrl?.trim() || `${bot.siteUrl}/manual-faq#${Date.now()}`;

    const chunks = chunkText(content.trim(), 700, 100);
    const createdChunks = [];
    const qdrantChunksToUpsert = [];
    const botIdStr = (bot._id || bot.id).toString();

    if (isUsingMemoryDb()) {
      MemoryDb.upsertCrawledPage(botIdStr, resolvedUrl, {
        title: title.trim(),
        status: 'indexed',
        chunkCount: chunks.length,
      });

      for (const chunk of chunks) {
        const embedding = await generateEmbedding(
          chunk.content,
          embedProvider,
          apiKey,
          bot.embedModel
        );

        const docList = MemoryDb.insertDocumentChunks([
          {
            chatbotId: botIdStr,
            pageUrl: resolvedUrl,
            content: chunk.content,
            embedding,
            metadata: {
              title: title.trim(),
              chunkIndex: chunk.chunkIndex,
              totalChunks: chunk.totalChunks,
              isManual: true,
            },
          },
        ]);
        createdChunks.push(...docList);
        qdrantChunksToUpsert.push({
          chatbotId: botIdStr,
          pageUrl: resolvedUrl,
          content: chunk.content,
          embedding,
          metadata: { title: title.trim(), isManual: true },
        });
      }
    } else {
      const botObjectId = new mongoose.Types.ObjectId(bot._id);

      await CrawledPage.findOneAndUpdate(
        { chatbotId: botObjectId, url: resolvedUrl },
        {
          chatbotId: botObjectId,
          url: resolvedUrl,
          title: title.trim(),
          status: 'indexed',
          chunkCount: chunks.length,
        },
        { upsert: true }
      );

      for (const chunk of chunks) {
        const embedding = await generateEmbedding(
          chunk.content,
          embedProvider,
          apiKey,
          bot.embedModel
        );

        const doc = await DocumentChunk.create({
          chatbotId: botObjectId,
          pageUrl: resolvedUrl,
          content: chunk.content,
          embedding,
          metadata: {
            title: title.trim(),
            chunkIndex: chunk.chunkIndex,
            totalChunks: chunk.totalChunks,
            isManual: true,
          },
        });

        createdChunks.push({
          id: doc._id.toString(),
          content: doc.content,
          pageUrl: doc.pageUrl,
        });
        qdrantChunksToUpsert.push({
          chatbotId: botId,
          pageUrl: resolvedUrl,
          content: chunk.content,
          embedding,
          metadata: { title: title.trim(), isManual: true },
        });
      }
    }

    const qdrantConfig = bot.customVectorDb?.enabled ? bot.customVectorDb : undefined;
    if (isQdrantConfigured(qdrantConfig) && qdrantChunksToUpsert.length > 0) {
      await upsertQdrantChunks(qdrantChunksToUpsert, undefined, qdrantConfig);
    }

    return NextResponse.json({
      success: true,
      message: `Added ${createdChunks.length} knowledge chunk(s) successfully into vector store`,
      chunks: createdChunks,
    });
  } catch (error: any) {
    console.error('Error adding knowledge snippet:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add knowledge snippet' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { botId } = await params;
    const { searchParams } = new URL(req.url);
    const chunkId = searchParams.get('chunkId');
    const pageId = searchParams.get('pageId');

    const bot = await resolveKnowledgeBot(botId);
    if (!bot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    const botIdStr = (bot._id || bot.id).toString();

    if (isUsingMemoryDb()) {
      if (chunkId) {
        MemoryDb.deleteDocumentChunk(botIdStr, chunkId);
        return NextResponse.json({ success: true, message: 'Chunk deleted' });
      }
      if (pageId) {
        MemoryDb.deleteCrawledPage(botIdStr, pageId);
        return NextResponse.json({ success: true, message: 'Page deleted' });
      }
    } else {
      const botObjectId = new mongoose.Types.ObjectId(bot._id);

      if (chunkId && mongoose.Types.ObjectId.isValid(chunkId)) {
        await DocumentChunk.findOneAndDelete({
          _id: new mongoose.Types.ObjectId(chunkId),
          chatbotId: botObjectId,
        });
        return NextResponse.json({ success: true, message: 'Chunk deleted' });
      }

      if (pageId && mongoose.Types.ObjectId.isValid(pageId)) {
        const page = await CrawledPage.findOne({
          _id: new mongoose.Types.ObjectId(pageId),
          chatbotId: botObjectId,
        });
        if (page) {
          await DocumentChunk.deleteMany({
            chatbotId: botObjectId,
            pageUrl: page.url,
          });
          await CrawledPage.findByIdAndDelete(page._id);
        }
        return NextResponse.json({ success: true, message: 'Page and its chunks deleted' });
      }
    }

    return NextResponse.json(
      { error: 'Specify either chunkId or pageId to delete' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete item' },
      { status: 500 }
    );
  }
}
