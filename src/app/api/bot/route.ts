import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Chatbot } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { isAdminEmail } from '@/lib/auth/adminAuth';
import { getOrCreateProfile, getRemainingBotSlots } from '@/lib/usage';
import { getPlanInfo } from '@/lib/plans';
import { ingestAndBuildBot } from '@/lib/bot-builder';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const userEmail =
      req.headers.get('x-user-email') || body.ownerEmail || '';
    const userId =
      req.headers.get('x-user-id') || body.ownerId || '';
    const userName =
      req.headers.get('x-user-name') || body.ownerName || '';

    // Protected: User must be logged in to create a bot project
    if (!userEmail && !userId) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in with Google to create your bot project.' },
        { status: 401 }
      );
    }

    // Enforce per-plan bot limit (free plan = 1 bot)
    const isAdmin = userEmail ? await isAdminEmail(userEmail) : false;
    if (!isAdmin) {
      const remaining = await getRemainingBotSlots({
        email: userEmail,
        userId,
        name: userName,
      });
      if (remaining <= 0) {
        const profile = await getOrCreateProfile({ email: userEmail, userId, name: userName });
        const plan = getPlanInfo(profile?.plan);
        const limit = Number(profile?.botLimit) || plan.botLimit;
        return NextResponse.json(
          {
            error: `You have reached the ${plan.label} plan limit of ${limit} chatbot(s).`,
            code: 'BOT_LIMIT_REACHED',
            plan: plan.label,
            limit,
          },
          { status: 402 }
        );
      }
    }

    const {
      name,
      siteUrl,
      primaryColor = '#6366f1',
      position = 'bottom-right',
      geminiKey = '',
      openrouterKey = '',
      openaiKey = '',
      nvidiaKey = '',
      chatProvider = process.env.DEFAULT_CHAT_PROVIDER || 'openai',
      chatModel = process.env.DEFAULT_CHAT_MODEL || 'gpt-4o-mini',
      embedProvider = process.env.DEFAULT_EMBED_PROVIDER || 'openai',
      embedModel = process.env.DEFAULT_EMBED_MODEL || 'text-embedding-3-small',
      systemPrompt,
      greeting,
      suggestedQuestions,
      customVectorDb,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Chatbot name is required' },
        { status: 400 }
      );
    }

    if (!siteUrl || !siteUrl.trim()) {
      return NextResponse.json(
        { error: 'Target website URL is required' },
        { status: 400 }
      );
    }

    // Ensure valid URL format
    let cleanUrl = siteUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    // Automated Ingestion & Build Pipeline if raw scraped content is supplied
    if (body.scrapedContent && typeof body.scrapedContent === 'string' && body.scrapedContent.trim()) {
      const buildResult = await ingestAndBuildBot({
        scrapedContent: body.scrapedContent,
        siteUrl: cleanUrl,
        botConfig: body.botConfig,
        ownerId: userId ? String(userId).trim() : '',
        ownerEmail: userEmail ? String(userEmail).toLowerCase().trim() : '',
        ownerName: userName ? String(userName).trim() : '',
        primaryColor,
        position,
        chatProvider,
        apiKeys: {
          gemini: geminiKey?.trim(),
          openrouter: openrouterKey?.trim(),
          openai: openaiKey?.trim(),
          nvidia: nvidiaKey?.trim(),
        },
      });

      return NextResponse.json({
        success: true,
        bot: {
          id: buildResult.botId,
          name: buildResult.bot.name,
          siteUrl: buildResult.bot.siteUrl,
          primaryColor: buildResult.bot.primaryColor,
          greeting: buildResult.bot.greeting,
          suggestedQuestions: buildResult.bot.suggestedQuestions,
          ownerEmail: buildResult.bot.ownerEmail,
          status: buildResult.bot.status,
          createdAt: buildResult.bot.createdAt,
          botConfig: buildResult.botConfig,
        },
        botConfig: buildResult.botConfig,
        chunksCount: buildResult.chunksCount,
      });
    }

    let cleanSlug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    if (cleanSlug && !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(cleanSlug)) {
      cleanSlug = '';
    }

    const botData = {
      name: name.trim(),
      siteUrl: cleanUrl,
      slug: cleanSlug || undefined,
      primaryColor,
      position,
      chatProvider,
      chatModel,
      embedProvider,
      embedModel,
      ownerId: userId ? String(userId).trim() : '',
      ownerEmail: userEmail ? String(userEmail).toLowerCase().trim() : '',
      ownerName: userName ? String(userName).trim() : '',
      status: 'active' as const,
      planTier: ['free', 'individual', 'enterprise'].includes(body.planTier) ? body.planTier : 'free',
      apiKeys: {
        gemini: geminiKey?.trim() || '',
        openrouter: openrouterKey?.trim() || '',
        openai: openaiKey?.trim() || '',
        nvidia: nvidiaKey?.trim() || '',
      },
      systemPrompt:
        systemPrompt ||
        `You are a knowledgeable, friendly, and reliable AI representative for ${name.trim()} (${cleanUrl}). Answer user questions accurately and concisely using strictly the verified context retrieved from the website. If the answer is not in the context, politely let the user know and offer to connect them with the team.`,
      greeting: greeting || `Hi there! 👋 Welcome to ${name.trim()}. How can I assist you today?`,
      suggestedQuestions: suggestedQuestions || [
        `What does ${name.trim()} offer?`,
        'How do I get started?',
        'What are the key features and pricing?',
      ],
      customVectorDb: customVectorDb
        ? {
            enabled: Boolean(customVectorDb.enabled),
            provider: customVectorDb.provider || 'qdrant',
            url: (customVectorDb.url || '').trim(),
            apiKey: (customVectorDb.apiKey || '').trim(),
            collectionName: (customVectorDb.collectionName || '').trim(),
          }
        : undefined,
    };

    let bot: any;
    if (isUsingMemoryDb()) {
      bot = MemoryDb.createChatbot(botData);
    } else {
      bot = await Chatbot.create(botData);
    }

    return NextResponse.json({
      success: true,
      bot: {
        id: bot._id.toString(),
        slug: bot.slug || '',
        name: bot.name,
        siteUrl: bot.siteUrl,
        primaryColor: bot.primaryColor,
        position: bot.position,
        greeting: bot.greeting,
        suggestedQuestions: bot.suggestedQuestions,
        ownerEmail: bot.ownerEmail,
        planTier: bot.planTier || 'free',
        status: bot.status,
        createdAt: bot.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error creating chatbot:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create chatbot' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const ids = searchParams.get('ids');
    const userEmail = (req.headers.get('x-user-email') || searchParams.get('email') || '').toLowerCase().trim();
    const userId = (req.headers.get('x-user-id') || searchParams.get('userId') || '').trim();

    const defaults = {
      chatProvider: process.env.DEFAULT_CHAT_PROVIDER || 'openai',
      chatModel: process.env.DEFAULT_CHAT_MODEL || 'gpt-4o-mini',
      embedProvider: process.env.DEFAULT_EMBED_PROVIDER || 'openai',
      embedModel: process.env.DEFAULT_EMBED_MODEL || 'text-embedding-3-small',
    };

    // Private: without a logged-in owner, no bots are ever listed or
    // fetchable by id — even if `ids` is supplied.
    if (!userEmail && !userId) {
      return NextResponse.json({ success: true, defaults, bots: [] });
    }

    let botList: any[] = [];
    const isUserAdmin = await isAdminEmail(userEmail);

    if (isUsingMemoryDb()) {
      const idArray =
        isUserAdmin && ids
          ? ids.split(',').map((id) => id.trim()).filter(Boolean)
          : undefined;
      let allBots = MemoryDb.findChatbots(idArray);

      // Non-admins only ever see their own bots.
      if (!isUserAdmin) {
        allBots = allBots.filter(
          (b) =>
            (b.ownerEmail && b.ownerEmail.toLowerCase() === userEmail) ||
            (userId && b.ownerId === userId)
        );
      }
      botList = allBots;
    } else {
      let query: any = {};
      if (isUserAdmin && ids) {
        const idArray = ids.split(',').map((id) => id.trim()).filter(Boolean);
        query._id = { $in: idArray };
      }

      // Non-admins only ever see their own bots.
      if (!isUserAdmin) {
        const orConditions: any[] = [{ ownerEmail: userEmail }];
        if (userId) orConditions.push({ ownerId: userId });
        query = { ...query, $or: orConditions };
      }

      botList = await Chatbot.find(query)
        .sort({ createdAt: -1 })
        .limit(100)
        .select('-apiKeys')
        .lean();
    }

    return NextResponse.json({
      success: true,
      defaults,
      bots: botList.map((b: any) => ({
        id: b._id.toString(),
        slug: b.slug || '',
        name: b.name,
        siteUrl: b.siteUrl,
        primaryColor: b.primaryColor,
        position: b.position,
        planTier: b.planTier || 'free',
        chatModel: b.chatModel,
        ownerEmail: b.ownerEmail || '',
        status: b.status || 'active',
        createdAt: b.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching chatbots:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch chatbots' },
      { status: 500 }
    );
  }
}
