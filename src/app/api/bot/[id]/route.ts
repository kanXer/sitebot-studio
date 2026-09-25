import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Chatbot, CrawledPage, DocumentChunk, BotForm, FormSubmission } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { deleteQdrantBotChunks, isQdrantConfigured } from '@/lib/vector/qdrant';
import { isAdminEmail } from '@/lib/auth/adminAuth';
import { deriveBusinessRoleSubtitle } from '@/lib/niche-detector';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const callerEmail = (req.headers.get('x-user-email') || searchParams.get('email') || '').toLowerCase().trim();
    const callerId = (req.headers.get('x-user-id') || searchParams.get('userId') || '').trim();

    let bot: any;
    let pageCount = 0;
    let chunkCount = 0;
    let indexedCount = 0;

    if (isUsingMemoryDb()) {
      bot = MemoryDb.findChatbotById(id);
      if (!bot) {
        return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
      }
      const botKey = bot._id || bot.id;
      pageCount = MemoryDb.countCrawledPages(botKey);
      indexedCount = MemoryDb.countCrawledPages(botKey, 'indexed');
      chunkCount = MemoryDb.countDocumentChunks(botKey);
    } else {
      if (mongoose.Types.ObjectId.isValid(id)) {
        bot = await Chatbot.findById(id).lean();
      }
      if (!bot) {
        bot = await Chatbot.findOne({ slug: String(id || '').toLowerCase().trim() }).lean();
      }
      if (!bot) {
        return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
      }

      [pageCount, chunkCount, indexedCount] = await Promise.all([
        CrawledPage.countDocuments({ chatbotId: bot._id }),
        DocumentChunk.countDocuments({ chatbotId: bot._id }),
        CrawledPage.countDocuments({ chatbotId: bot._id, status: 'indexed' }),
      ]);
    }

    // Access control:
    // If the bot has an owner, verify the caller is the owner or an admin.
    const hasOwner = Boolean(bot.ownerEmail || bot.ownerId);
    if (hasOwner) {
      const isAdmin = callerEmail ? await isAdminEmail(callerEmail) : false;
      const isOwner =
        !!callerEmail &&
        !!bot.ownerEmail &&
        bot.ownerEmail.toLowerCase() === callerEmail;
      const isOwnerById = !!callerId && !!bot.ownerId && bot.ownerId === callerId;

      if (!isAdmin && !isOwner && !isOwnerById) {
        if (!callerEmail && !callerId) {
          return NextResponse.json(
            { error: 'Authentication required. Please sign in to view this bot.', requiresAuth: true },
            { status: 401 }
          );
        }
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to access this bot.' },
          { status: 403 }
        );
      }
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
        roleTitle:
          bot.roleTitle ||
          deriveBusinessRoleSubtitle(
            bot.name,
            (bot.systemPrompt || '') + ' ' + (bot.siteUrl || ''),
            bot.siteUrl,
            bot.suggestedQuestions
          ),
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
        guardrails: bot.guardrails || {
          enabled: true,
          strictRAG: true,
          promptInjectionDefense: true,
          domainScopeEnforcement: true,
          piiMasking: true,
          similarityThreshold: 0.40,
          fallbackMessage:
            "I'm sorry, but I do not have verified information about that from this website. For assistance on this specific request, please feel free to contact our team or request to speak with a human representative.",
        },
        handoff: bot.handoff || {
          enabled: true,
          autoDetect: true,
          notifyEmail: '',
          agentName: 'Support Agent',
          offlineMessage:
            'Our human support agents are currently offline or busy. Please leave your contact details and message, and our team will get back to you shortly!',
        },
        metaPrompt: bot.metaPrompt || '',
        aiLimit: bot.aiLimit || { enabled: false, maxTokens: 400 },
        notifications: bot.notifications || {
          email: { enabled: false, to: '' },
          whatsapp: { enabled: false, number: '' },
          telegram: { enabled: false, chatId: '', botToken: '' },
        },
        usage: bot.usage || { inputTokens: 0, outputTokens: 0, chats: 0, leads: 0 },
        ownerId: bot.ownerId || '',
        ownerEmail: bot.ownerEmail || '',
        ownerName: bot.ownerName || '',
        planTier: bot.planTier || 'free',
        status: bot.status || 'active',
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
      'roleTitle',
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
      'status',
      'planTier',
      'ownerEmail',
      'ownerName',
      'metaPrompt',
    ];

    const callerEmail = (req.headers.get('x-user-email') || body.userEmail || '').toLowerCase().trim();
    const callerId = (req.headers.get('x-user-id') || body.userId || '').trim();

    let existingBot: any;
    if (isUsingMemoryDb()) {
      existingBot = MemoryDb.findChatbotById(id);
    } else {
      if (mongoose.Types.ObjectId.isValid(id)) {
        existingBot = await Chatbot.findById(id).lean();
      }
      if (!existingBot) {
        existingBot = await Chatbot.findOne({ slug: String(id || '').toLowerCase().trim() }).lean();
      }
    }

    if (!existingBot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    const hasOwner = Boolean(existingBot.ownerEmail || existingBot.ownerId);
    if (hasOwner) {
      const isOwner =
        !!callerEmail &&
        !!existingBot.ownerEmail &&
        existingBot.ownerEmail.toLowerCase() === callerEmail;
      const isOwnerById = !!callerId && !!existingBot.ownerId && existingBot.ownerId === callerId;
      const isAdmin = callerEmail ? await isAdminEmail(callerEmail) : false;

      if (!isOwner && !isOwnerById && !isAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to modify this chatbot.' },
          { status: 403 }
        );
      }
    }

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
        if (!isUsingMemoryDb()) {
          const clash = await Chatbot.findOne({
            slug: slugVal,
            _id: { $ne: existingBot._id },
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
      const existingKey = existingBot?.customVectorDb?.apiKey || '';

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

    // Handle guardrails configuration update
    if (body.guardrails !== undefined) {
      updateData.guardrails = {
        enabled: Boolean(body.guardrails.enabled),
        strictRAG: Boolean(body.guardrails.strictRAG),
        promptInjectionDefense: Boolean(body.guardrails.promptInjectionDefense),
        domainScopeEnforcement: Boolean(body.guardrails.domainScopeEnforcement),
        piiMasking: Boolean(body.guardrails.piiMasking),
        similarityThreshold:
          typeof body.guardrails.similarityThreshold === 'number'
            ? body.guardrails.similarityThreshold
            : 0.40,
        fallbackMessage:
          body.guardrails.fallbackMessage ||
          "I'm sorry, but I do not have verified information about that from this website. For assistance on this specific request, please feel free to contact our team or request to speak with a human representative.",
      };
    }

    // Handle handoff configuration update
    if (body.handoff !== undefined) {
      updateData.handoff = {
        enabled: Boolean(body.handoff.enabled),
        autoDetect: Boolean(body.handoff.autoDetect),
        notifyEmail: (body.handoff.notifyEmail || '').trim(),
        agentName: (body.handoff.agentName || 'Support Agent').trim(),
        offlineMessage:
          body.handoff.offlineMessage ||
          'Our human support agents are currently offline or busy. Please leave your contact details and message, and our team will get back to you shortly!',
      };
    }

    if (updateData.metaPrompt !== undefined) {
      const mp = String(updateData.metaPrompt || '').trim();
      if (mp.length > 3000) {
        return NextResponse.json(
          { error: 'Meta prompt cannot exceed 3000 characters.' },
          { status: 400 }
        );
      }
      updateData.metaPrompt = mp;
    }

    if (body.aiLimit !== undefined) {
      updateData.aiLimit = {
        enabled: Boolean(body.aiLimit.enabled),
        maxTokens: Math.max(50, Math.min(4000, Math.floor(Number(body.aiLimit.maxTokens) || 400))),
      };
    }

    if (body.notifications !== undefined) {
      updateData.notifications = {
        email: {
          enabled: Boolean(body.notifications.email?.enabled),
          to: String(body.notifications.email?.to || '').trim(),
        },
        whatsapp: {
          enabled: Boolean(body.notifications.whatsapp?.enabled),
          number: String(body.notifications.whatsapp?.number || '').trim(),
        },
        telegram: {
          enabled: Boolean(body.notifications.telegram?.enabled),
          chatId: String(body.notifications.telegram?.chatId || '').trim(),
          botToken: String(body.notifications.telegram?.botToken || '').trim(),
        },
      };
    }

    let updatedBot: any;

    if (isUsingMemoryDb()) {
      if (body.apiKeys) {
        updateData.apiKeys = {
          gemini:
            body.apiKeys.gemini !== undefined && !body.apiKeys.gemini.includes('••••')
              ? body.apiKeys.gemini.trim()
              : existingBot.apiKeys?.gemini || '',
          openrouter:
            body.apiKeys.openrouter !== undefined && !body.apiKeys.openrouter.includes('••••')
              ? body.apiKeys.openrouter.trim()
              : existingBot.apiKeys?.openrouter || '',
          openai:
            body.apiKeys.openai !== undefined && !body.apiKeys.openai.includes('••••')
              ? body.apiKeys.openai.trim()
              : existingBot.apiKeys?.openai || '',
          nvidia:
            body.apiKeys.nvidia !== undefined && !body.apiKeys.nvidia.includes('••••')
              ? body.apiKeys.nvidia.trim()
              : existingBot.apiKeys?.nvidia || '',
        };
      }

      updatedBot = MemoryDb.updateChatbot(existingBot._id, updateData);
    } else {
      const targetObjectId = existingBot._id;

      if (body.apiKeys) {
        const currentBot = await Chatbot.findById(targetObjectId);
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

      updatedBot = await Chatbot.findByIdAndUpdate(targetObjectId, updateData, {
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
        slug: updatedBot.slug || '',
        guardrails: updatedBot.guardrails || {
          enabled: true,
          strictRAG: true,
          promptInjectionDefense: true,
          domainScopeEnforcement: true,
          piiMasking: true,
          similarityThreshold: 0.40,
          fallbackMessage:
            "I'm sorry, but I do not have verified information about that from this website. For assistance on this specific request, please feel free to contact our team or request to speak with a human representative.",
        },
        handoff: updatedBot.handoff || {
          enabled: true,
          autoDetect: true,
          notifyEmail: '',
          agentName: 'Support Agent',
          offlineMessage:
            'Our human support agents are currently offline or busy. Please leave your contact details and message, and our team will get back to you shortly!',
        },
        allowedOrigins: updatedBot.allowedOrigins || [],
        rateLimit: updatedBot.rateLimit,
        metaPrompt: updatedBot.metaPrompt || '',
        aiLimit: updatedBot.aiLimit || { enabled: false, maxTokens: 400 },
        notifications: updatedBot.notifications || {
          email: { enabled: false, to: '' },
          whatsapp: { enabled: false, number: '' },
          telegram: { enabled: false, chatId: '', botToken: '' },
        },
        ownerEmail: updatedBot.ownerEmail || '',
        ownerName: updatedBot.ownerName || '',
        status: updatedBot.status || 'active',
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
    const callerEmail = (req.headers.get('x-user-email') || '').toLowerCase().trim();
    const callerId = (req.headers.get('x-user-id') || '').trim();

    let bot: any;
    if (isUsingMemoryDb()) {
      bot = MemoryDb.findChatbotById(id);
    } else {
      if (mongoose.Types.ObjectId.isValid(id)) {
        bot = await Chatbot.findById(id).lean();
      }
      if (!bot) {
        bot = await Chatbot.findOne({ slug: String(id || '').toLowerCase().trim() }).lean();
      }
    }

    if (!bot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    const hasOwner = Boolean(bot.ownerEmail || bot.ownerId);
    if (hasOwner) {
      const isOwner =
        !!callerEmail &&
        !!bot.ownerEmail &&
        bot.ownerEmail.toLowerCase() === callerEmail;
      const isOwnerById = !!callerId && !!bot.ownerId && bot.ownerId === callerId;
      const isAdmin = callerEmail ? await isAdminEmail(callerEmail) : false;

      if (!isOwner && !isOwnerById && !isAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to delete this chatbot.' },
          { status: 403 }
        );
      }
    }

    const qdrantConfig = bot.customVectorDb?.enabled ? bot.customVectorDb : undefined;
    const botIdStr = (bot._id || bot.id).toString();

    if (isQdrantConfigured(qdrantConfig)) {
      await deleteQdrantBotChunks(botIdStr, undefined, qdrantConfig);
    }

    if (isUsingMemoryDb()) {
      MemoryDb.deleteChatbot(botIdStr);
    } else {
      const botObjectId = new mongoose.Types.ObjectId(bot._id);
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
      message: 'Chatbot and all vector index points deleted successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete chatbot' },
      { status: 500 }
    );
  }
}
