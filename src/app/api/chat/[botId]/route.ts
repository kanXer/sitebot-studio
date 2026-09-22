import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Chatbot } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { searchSimilarChunks } from '@/lib/ai/vectorSearch';
import {
  buildAugmentedSystemPrompt,
  streamGeminiChat,
  streamOpenAICompatibleChat,
  ChatMessage,
} from '@/lib/ai/chat';
import { isOriginAllowed } from '@/lib/security';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

interface RouteParams {
  params: Promise<{ botId: string }>;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-SiteBot-Preview',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { botId } = await params;

    let bot: any;
    if (isUsingMemoryDb()) {
      bot = MemoryDb.findChatbotById(botId);
    } else if (mongoose.Types.ObjectId.isValid(botId)) {
      bot = await Chatbot.findById(botId).lean();
    } else {
      bot = await Chatbot.findOne({ slug: String(botId || '').toLowerCase() }).lean();
    }

    if (!bot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const previewHeader = req.headers.get('x-sitebot-preview');
    const referer = req.headers.get('referer') || '';
    const origin = req.headers.get('origin') || '';
    const host = req.headers.get('host') || '';

    const isStudioPreview =
      previewHeader === 'true' ||
      referer.includes('/bot/') ||
      referer.includes('/demo/') ||
      Boolean(origin && host && origin.includes(host));

    if (!isOriginAllowed(bot, origin || null, { isStudioPreview })) {
      return NextResponse.json(
        {
          error:
            'Request blocked: origin is not allowed for this chatbot. Add the origin to Allowed Origins in Chatbot Settings.',
        },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        id: bot._id.toString(),
        slug: bot.slug || '',
        name: bot.name,
        siteUrl: bot.siteUrl,
        primaryColor: bot.primaryColor || '#BE123C',
        position: bot.position || 'bottom-right',
        greeting: bot.greeting || "Namaste! 👋 I'm Friday, your AI growth strategist. How can I help you grow today?",
        suggestedQuestions: bot.suggestedQuestions || [
          'What services do you offer?',
          'View Pricing Plans',
          'Audit my website',
        ],
        phone: bot.phone || '',
        phoneRaw: (bot.phone || '').replace(/[^\d+]/g, ''),
        whatsapp: bot.whatsapp || '',
        email: bot.email || '',
        auditUrl: bot.auditUrl || '',
        pricingUrl: bot.pricingUrl || '',
        launcherStyle: bot.launcherStyle || 'standard',
        customLinks: bot.customLinks || [],
      },
      { headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch public bot profile' },
      { status: 500, headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { botId } = await params;

    let bot: any;
    if (isUsingMemoryDb()) {
      bot = MemoryDb.findChatbotById(botId);
    } else if (mongoose.Types.ObjectId.isValid(botId)) {
      bot = await Chatbot.findById(botId).lean();
    } else {
      bot = await Chatbot.findOne({ slug: String(botId || '').toLowerCase() }).lean();
    }

    if (!bot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Determine if this is an internal Studio preview vs production external embed
    const previewHeader = req.headers.get('x-sitebot-preview');
    const referer = req.headers.get('referer') || '';
    const origin = req.headers.get('origin') || '';
    const host = req.headers.get('host') || '';

    const isStudioPreview =
      previewHeader === 'true' ||
      referer.includes('/bot/') ||
      referer.includes('/demo/') ||
      Boolean(origin && host && origin.includes(host));

    // CORS allow-list: only the saved website and configured origins can call the bot
    if (!isOriginAllowed(bot, origin || null, { isStudioPreview })) {
      return NextResponse.json(
        {
          error:
            'Request blocked: origin is not allowed for this chatbot. Add the origin to Allowed Origins in Chatbot Settings.',
        },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // Per-bot rate limiting
    if (bot.rateLimit?.enabled) {
      const rateResult = checkRateLimit(
        `${getClientIp(req)}|${botId}`,
        bot.rateLimit.maxRequests || 20,
        bot.rateLimit.windowMs || 60000
      );
      if (!rateResult.allowed) {
        return NextResponse.json(
          {
            error: 'Too many requests. Please wait a moment and try again.',
          },
          {
            status: 429,
            headers: {
              ...CORS_HEADERS,
              'Retry-After': String(Math.ceil(rateResult.retryAfterMs / 1000)),
            },
          }
        );
      }
    }

    const body = await req.json();
    const { message, history = [] } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'Message cannot be empty' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const isRealKey = (key?: string) => Boolean(key && key.trim() && !key.toLowerCase().includes('dummy'));

    // Bot-configured keys (BYOK)
    const botGeminiKey = isRealKey(bot.apiKeys?.gemini) ? bot.apiKeys.gemini : '';
    const botOpenrouterKey = isRealKey(bot.apiKeys?.openrouter) ? bot.apiKeys.openrouter : '';
    const botOpenaiKey = isRealKey(bot.apiKeys?.openai) ? bot.apiKeys.openai : '';
    const botNvidiaKey = isRealKey(bot.apiKeys?.nvidia) ? bot.apiKeys.nvidia : '';

    const hasBotKey = Boolean(
      botGeminiKey || botOpenrouterKey || botOpenaiKey || botNvidiaKey
    );
    const hasMasterKey = Boolean(
      isRealKey(process.env.NVIDIA_API_KEY) ||
      isRealKey(process.env.OPENAI_API_KEY) ||
      isRealKey(process.env.GEMINI_API_KEY) ||
      isRealKey(process.env.OPENROUTER_API_KEY)
    );

    if (!isStudioPreview && !hasBotKey && !hasMasterKey) {
      return NextResponse.json(
        {
          error:
            'This chatbot is currently in preview mode. To embed this widget on a production website, please configure your own API key in SiteBot Studio settings.',
        },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // Resolve active keys
    const geminiKey = botGeminiKey || (isRealKey(process.env.GEMINI_API_KEY) ? process.env.GEMINI_API_KEY : '');
    const openrouterKey = botOpenrouterKey || (isRealKey(process.env.OPENROUTER_API_KEY) ? process.env.OPENROUTER_API_KEY : '');
    const openaiKey = botOpenaiKey || (isRealKey(process.env.OPENAI_API_KEY) ? process.env.OPENAI_API_KEY : '');
    const nvidiaKey = botNvidiaKey || (isRealKey(process.env.NVIDIA_API_KEY) ? process.env.NVIDIA_API_KEY : '');

    const embedProvider = bot.embedProvider || 'nvidia';
    const embedKey =
      embedProvider === 'nvidia'
        ? nvidiaKey
        : embedProvider === 'openai'
        ? openaiKey
        : geminiKey;

    if (!embedKey) {
      return NextResponse.json(
        {
          error: `No API key configured for ${embedProvider} embeddings. Please set your key in Studio Settings.`,
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 1. Generate query embedding
    let queryEmbedding: number[] = [];
    try {
      queryEmbedding = await generateEmbedding(
        message.trim(),
        embedProvider,
        embedKey,
        bot.embedModel
      );
    } catch (embedError: any) {
      console.error('Embedding generation failed:', embedError);
      return NextResponse.json(
        {
          error: `Vector embedding generation failed: ${embedError.message}`,
        },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // 2. Query Qdrant (using custom database if configured)
    const qdrantConfig = bot.customVectorDb?.enabled ? bot.customVectorDb : undefined;
    const topChunks = await searchSimilarChunks(bot._id, queryEmbedding, 4, qdrantConfig);

    // 3. Construct Augmented Prompt
    const { prompt: systemPromptWithContext, sources } = buildAugmentedSystemPrompt(
      bot.systemPrompt,
      bot.siteUrl,
      topChunks,
      {
        phone: bot.phone || '',
        whatsapp: bot.whatsapp || '',
        email: bot.email || '',
      }
    );

    // Resolve chat provider with graceful fallback
    let chatProvider = bot.chatProvider || 'nvidia';
    if (chatProvider === 'openai' && !openaiKey && nvidiaKey) {
      chatProvider = 'nvidia';
    } else if (chatProvider === 'openrouter' && !openrouterKey && nvidiaKey) {
      chatProvider = 'nvidia';
    } else if (chatProvider === 'gemini' && !geminiKey && nvidiaKey) {
      chatProvider = 'nvidia';
    }

    const resolvedNvidiaModel =
      (!bot.chatModel ||
       bot.chatModel === 'meta/llama-3.1-8b-instruct' ||
       bot.chatModel === 'meta/llama-3.3-70b-instruct' ||
       bot.chatModel === 'meta/llama-3.2-3b-instruct' ||
       bot.chatModel === 'meta/llama-3.2-1b-instruct' ||
       bot.chatModel === 'meta/muse-glimmer-30b')
        ? 'meta/llama-3.2-11b-vision-instruct'
        : bot.chatModel;

    // 4. Stream response using SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(`event: sources\ndata: ${JSON.stringify(sources)}\n\n`)
        );

        const streamCallbacks = {
          onToken(token: string) {
            controller.enqueue(
              encoder.encode(`event: token\ndata: ${JSON.stringify({ token })}\n\n`)
            );
          },
          onDone() {
            controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
            controller.close();
          },
          onError(err: Error) {
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`
              )
            );
            controller.close();
          },
        };

        try {
          if (chatProvider === 'openrouter' && openrouterKey) {
            await streamOpenAICompatibleChat(
              'https://openrouter.ai/api/v1/chat/completions',
              openrouterKey,
              bot.chatModel || 'meta-llama/llama-3-8b-instruct:free',
              systemPromptWithContext,
              history as ChatMessage[],
              message,
              streamCallbacks
            );
          } else if (chatProvider === 'openai' && openaiKey) {
            await streamOpenAICompatibleChat(
              'https://api.openai.com/v1/chat/completions',
              openaiKey,
              bot.chatModel || 'gpt-4o-mini',
              systemPromptWithContext,
              history as ChatMessage[],
              message,
              streamCallbacks
            );
          } else if (chatProvider === 'nvidia' && nvidiaKey) {
            await streamOpenAICompatibleChat(
              'https://integrate.api.nvidia.com/v1/chat/completions',
              nvidiaKey,
              resolvedNvidiaModel,
              systemPromptWithContext,
              history as ChatMessage[],
              message,
              streamCallbacks
            );
          } else if (geminiKey) {
            await streamGeminiChat(
              geminiKey,
              bot.chatModel || 'gemini-1.5-flash',
              systemPromptWithContext,
              history as ChatMessage[],
              message,
              streamCallbacks
            );
          } else {
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({
                  error: 'An active API key is required to generate chat responses.',
                })}\n\n`
              )
            );
            controller.close();
          }
        } catch (streamErr: any) {
          console.error('Chat stream execution error:', streamErr);
          try {
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({
                  error: streamErr.message || 'Stream generation failed',
                })}\n\n`
              )
            );
            controller.close();
          } catch {}
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        ...CORS_HEADERS,
      },
    });
  } catch (error: any) {
    console.error('Chat API general failure:', error);
    return NextResponse.json(
      { error: error.message || 'Internal chat server error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
