import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Chatbot } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

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

    const botData = {
      name: name.trim(),
      siteUrl: cleanUrl,
      primaryColor,
      position,
      chatProvider,
      chatModel,
      embedProvider,
      embedModel,
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
        name: bot.name,
        siteUrl: bot.siteUrl,
        primaryColor: bot.primaryColor,
        position: bot.position,
        greeting: bot.greeting,
        suggestedQuestions: bot.suggestedQuestions,
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

    let botList: any[] = [];
    if (isUsingMemoryDb()) {
      const idArray = ids ? ids.split(',').map((id) => id.trim()).filter(Boolean) : undefined;
      botList = MemoryDb.findChatbots(idArray);
    } else {
      let query = {};
      if (ids) {
        const idArray = ids.split(',').map((id) => id.trim()).filter(Boolean);
        query = { _id: { $in: idArray } };
      }
      botList = await Chatbot.find(query)
        .sort({ createdAt: -1 })
        .limit(50)
        .select('-apiKeys')
        .lean();
    }

    return NextResponse.json({
      success: true,
      defaults: {
        chatProvider: process.env.DEFAULT_CHAT_PROVIDER || 'openai',
        chatModel: process.env.DEFAULT_CHAT_MODEL || 'gpt-4o-mini',
        embedProvider: process.env.DEFAULT_EMBED_PROVIDER || 'openai',
        embedModel: process.env.DEFAULT_EMBED_MODEL || 'text-embedding-3-small',
      },
      bots: botList.map((b: any) => ({
        id: b._id.toString(),
        name: b.name,
        siteUrl: b.siteUrl,
        primaryColor: b.primaryColor,
        position: b.position,
        chatModel: b.chatModel,
        createdAt: b.createdAt,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch chatbots' },
      { status: 500 }
    );
  }
}
