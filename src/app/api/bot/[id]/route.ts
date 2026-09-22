import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Chatbot, CrawledPage, DocumentChunk } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { deleteQdrantBotChunks, isQdrantConfigured } from '@/lib/vector/qdrant';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;

    let bot: any;
    let pageCount = 0;
    let chunkCount = 0;
    let indexedCount = 0;

    if (isUsingMemoryDb()) {
      bot = MemoryDb.findChatbotById(id);
      if (!bot) {
        return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
      }
      pageCount = MemoryDb.countCrawledPages(id);
      indexedCount = MemoryDb.countCrawledPages(id, 'indexed');
      chunkCount = MemoryDb.countDocumentChunks(id);
    } else {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: 'Invalid bot ID' }, { status: 400 });
      }

      bot = await Chatbot.findById(id).lean();
      if (!bot) {
        return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
      }

      [pageCount, chunkCount, indexedCount] = await Promise.all([
        CrawledPage.countDocuments({ chatbotId: bot._id }),
        DocumentChunk.countDocuments({ chatbotId: bot._id }),
        CrawledPage.countDocuments({ chatbotId: bot._id, status: 'indexed' }),
      ]);
    }

    // Mask API keys for security in UI response
    const maskedKeys = {
      gemini: bot.apiKeys?.gemini ? `••••••••${bot.apiKeys.gemini.slice(-4)}` : '',
      openrouter: bot.apiKeys?.openrouter ? `••••••••${bot.apiKeys.openrouter.slice(-4)}` : '',
      openai: bot.apiKeys?.openai ? `••••••••${bot.apiKeys.openai.slice(-4)}` : '',
      nvidia: bot.apiKeys?.nvidia ? `••••••••${bot.apiKeys.nvidia.slice(-4)}` : '',
    };

    return NextResponse.json({
      success: true,
      bot: {
        id: bot._id.toString(),
        slug: bot.slug || '',
        name: bot.name,
        siteUrl: bot.siteUrl,
        systemPrompt: bot.systemPrompt,
        primaryColor: bot.primaryColor,
        position: bot.position,
        chatProvider: bot.chatProvider,
        chatModel: bot.chatModel,
        embedProvider: bot.embedProvider,
        embedModel: bot.embedModel,
        allowedOrigins: bot.allowedOrigins || [],
        rateLimit: bot.rateLimit || { enabled: false, maxRequests: 20, windowMs: 60000 },
        apiKeysConfigured: {
          gemini: !!bot.apiKeys?.gemini,
          openrouter: !!bot.apiKeys?.openrouter,
          openai: !!bot.apiKeys?.openai,
          nvidia: !!bot.apiKeys?.nvidia,
        },
        maskedKeys,
        greeting: bot.greeting,
        suggestedQuestions: bot.suggestedQuestions,
        phone: bot.phone || '',
        whatsapp: bot.whatsapp || '',
        email: bot.email || '',
        auditUrl: bot.auditUrl || '',
        pricingUrl: bot.pricingUrl || '',
        launcherStyle: bot.launcherStyle || 'standard',
        customLinks: bot.customLinks || [],
        customVectorDb: {
          enabled: bot.customVectorDb?.enabled || false,
          provider: bot.customVectorDb?.provider || 'qdrant',
          url: bot.customVectorDb?.url || '',
          apiKey: bot.customVectorDb?.apiKey ? `••••••••${bot.customVectorDb.apiKey.slice(-4)}` : '',
          hasApiKey: !!bot.customVectorDb?.apiKey,
          collectionName: bot.customVectorDb?.collectionName || '',
        },
        createdAt: bot.createdAt,
        updatedAt: bot.updatedAt,
      },
      stats: {
        totalPages: pageCount,
        indexedPages: indexedCount,
        totalChunks: chunkCount,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch chatbot details' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const body = await req.json();
    const updateData: Record<string, any> = {};

    const allowedFields = [
      'name',
      'siteUrl',
      'systemPrompt',
      'primaryColor',
      'position',
      'chatProvider',
      'chatModel',
      'embedProvider',
      'embedModel',
      'greeting',
      'suggestedQuestions',
      'phone',
      'whatsapp',
      'email',
      'auditUrl',
      'pricingUrl',
      'launcherStyle',
      'customLinks',
      'slug',
      'allowedOrigins',
      'rateLimit',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Normalize custom bot ID and ensure uniqueness
    if (updateData.slug !== undefined) {
      const slugVal = typeof updateData.slug === 'string' ? updateData.slug.trim().toLowerCase() : '';
      if (slugVal) {
        if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slugVal)) {
          return NextResponse.json(
            { error: 'Custom bot ID can only contain lowercase letters, numbers and dashes.' },
            { status: 400 }
          );
        }
        if (!isUsingMemoryDb() && mongoose.Types.ObjectId.isValid(id)) {
          const clash = await Chatbot.findOne({
            slug: slugVal,
            _id: { $ne: new mongoose.Types.ObjectId(id) },
          })
            .select('_id')
            .lean();
          if (clash) {
            return NextResponse.json(
              { error: 'This custom bot ID is already in use by another chatbot.' },
              { status: 409 }
            );
          }
        }
        updateData.slug = slugVal;
      } else {
        updateData.slug = null;
      }
    }

    if (updateData.allowedOrigins !== undefined) {
      updateData.allowedOrigins = Array.isArray(updateData.allowedOrigins)
        ? updateData.allowedOrigins.map((o) => String(o).trim()).filter(Boolean)
        : String(updateData.allowedOrigins || '')
            .split(/[,\n]/)
            .map((o) => o.trim())
            .filter(Boolean);
    }

    if (updateData.rateLimit !== undefined) {
      updateData.rateLimit = {
        enabled: Boolean(updateData.rateLimit.enabled),
        maxRequests: Math.max(1, Math.floor(Number(updateData.rateLimit.maxRequests) || 20)),
        windowMs: Math.max(1000, Math.floor(Number(updateData.rateLimit.windowMs) || 60000)),
      };
    }

    // Handle custom vector database update
    if (body.customVectorDb !== undefined) {
      let existingKey = '';
      if (isUsingMemoryDb()) {
        existingKey = MemoryDb.findChatbotById(id)?.customVectorDb?.apiKey || '';
      } else if (mongoose.Types.ObjectId.isValid(id)) {
        const found = await Chatbot.findById(id).select('customVectorDb').lean();
        existingKey = found?.customVectorDb?.apiKey || '';
      }

      const inputKey = body.customVectorDb.apiKey;
      const finalKey =
        inputKey !== undefined && !inputKey.includes('••••')
          ? inputKey.trim()
          : existingKey;

      updateData.customVectorDb = {
        enabled: Boolean(body.customVectorDb.enabled),
        provider: body.customVectorDb.provider || 'qdrant',
        url: (body.customVectorDb.url || '').trim(),
        apiKey: finalKey,
        collectionName: (body.customVectorDb.collectionName || '').trim(),
      };
    }

    let updatedBot: any;

    if (isUsingMemoryDb()) {
      const currentBot = MemoryDb.findChatbotById(id);
      if (!currentBot) {
        return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
      }

      if (body.apiKeys) {
        updateData.apiKeys = {
          gemini:
            body.apiKeys.gemini !== undefined && !body.apiKeys.gemini.includes('••••')
              ? body.apiKeys.gemini.trim()
              : currentBot.apiKeys?.gemini || '',
          openrouter:
            body.apiKeys.openrouter !== undefined && !body.apiKeys.openrouter.includes('••••')
              ? body.apiKeys.openrouter.trim()
              : currentBot.apiKeys?.openrouter || '',
          openai:
            body.apiKeys.openai !== undefined && !body.apiKeys.openai.includes('••••')
              ? body.apiKeys.openai.trim()
              : currentBot.apiKeys?.openai || '',
          nvidia:
            body.apiKeys.nvidia !== undefined && !body.apiKeys.nvidia.includes('••••')
              ? body.apiKeys.nvidia.trim()
              : currentBot.apiKeys?.nvidia || '',
        };
      }

      updatedBot = MemoryDb.updateChatbot(id, updateData);
    } else {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: 'Invalid bot ID' }, { status: 400 });
      }

      if (body.apiKeys) {
        const currentBot = await Chatbot.findById(id);
        if (currentBot) {
          updateData.apiKeys = {
            gemini:
              body.apiKeys.gemini !== undefined && !body.apiKeys.gemini.includes('••••')
                ? body.apiKeys.gemini.trim()
                : currentBot.apiKeys?.gemini || '',
            openrouter:
              body.apiKeys.openrouter !== undefined && !body.apiKeys.openrouter.includes('••••')
                ? body.apiKeys.openrouter.trim()
                : currentBot.apiKeys?.openrouter || '',
            openai:
              body.apiKeys.openai !== undefined && !body.apiKeys.openai.includes('••••')
                ? body.apiKeys.openai.trim()
                : currentBot.apiKeys?.openai || '',
            nvidia:
              body.apiKeys.nvidia !== undefined && !body.apiKeys.nvidia.includes('••••')
                ? body.apiKeys.nvidia.trim()
                : currentBot.apiKeys?.nvidia || '',
          };
        }
      }

      updatedBot = await Chatbot.findByIdAndUpdate(id, updateData, {
        returnDocument: 'after',
        runValidators: true,
      }).lean();
    }

    if (!updatedBot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      bot: {
        id: updatedBot._id.toString(),
        name: updatedBot.name,
        siteUrl: updatedBot.siteUrl,
        systemPrompt: updatedBot.systemPrompt,
        primaryColor: updatedBot.primaryColor,
        position: updatedBot.position,
        chatProvider: updatedBot.chatProvider,
        chatModel: updatedBot.chatModel,
        embedProvider: updatedBot.embedProvider,
        embedModel: updatedBot.embedModel,
        greeting: updatedBot.greeting,
        suggestedQuestions: updatedBot.suggestedQuestions,
        phone: updatedBot.phone || '',
        whatsapp: updatedBot.whatsapp || '',
        email: updatedBot.email || '',
        auditUrl: updatedBot.auditUrl || '',
        pricingUrl: updatedBot.pricingUrl || '',
        launcherStyle: updatedBot.launcherStyle || 'standard',
        customLinks: updatedBot.customLinks || [],
        customVectorDb: updatedBot.customVectorDb,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update chatbot' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;

    let bot: any;
    if (isUsingMemoryDb()) {
      bot = MemoryDb.findChatbotById(id);
      if (!bot) {
        return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
      }
      const qdrantConfig = bot.customVectorDb?.enabled ? bot.customVectorDb : undefined;
      if (isQdrantConfigured(qdrantConfig)) {
        await deleteQdrantBotChunks(id, undefined, qdrantConfig);
      }
      MemoryDb.deleteChatbot(id);
    } else {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: 'Invalid bot ID' }, { status: 400 });
      }

      const botObjectId = new mongoose.Types.ObjectId(id);
      bot = await Chatbot.findById(botObjectId).lean();
      if (!bot) {
        return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
      }

      const qdrantConfig = bot.customVectorDb?.enabled ? bot.customVectorDb : undefined;
      if (isQdrantConfigured(qdrantConfig)) {
        await deleteQdrantBotChunks(id, undefined, qdrantConfig);
      }

      await Promise.all([
        Chatbot.findByIdAndDelete(botObjectId),
        CrawledPage.deleteMany({ chatbotId: botObjectId }),
        DocumentChunk.deleteMany({ chatbotId: botObjectId }),
      ]);
    }

    return NextResponse.json({
      success: true,
      message: 'Chatbot and all vector index points deleted successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete chatbot' },
      { status: 500 }
    );
  }
}
