import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import {
  ingestAndBuildBot,
  generateBotConfig,
  BotConfigSchema,
  BotConfig,
} from '@/lib/bot-builder';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-email, x-user-id',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  return NextResponse.json(
    {
      endpoint: '/api/bot/build',
      description:
        'Automated chatbot generation from raw scraped website data with AI Meta-Analysis, vector store semantic indexing, and strict RAG guardrails.',
      schema: {
        scrapedContent: 'string (raw website text or markdown, required)',
        siteUrl: 'string (URL of the scraped website, required)',
        botConfig: 'BotConfig (optional override matching Zod schema)',
        ownerId: 'string (optional owner UID)',
        ownerEmail: 'string (optional owner email)',
        primaryColor: 'string (optional hex color)',
        chatProvider: "'gemini' | 'openrouter' | 'openai' | 'nvidia' (optional)",
      },
    },
    { headers: CORS_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json().catch(() => ({}));

    const {
      scrapedContent,
      siteUrl,
      botConfig,
      ownerId,
      ownerEmail,
      ownerName,
      primaryColor,
      position,
      chatProvider,
      apiKeys,
      options,
    } = body;

    if (!scrapedContent || typeof scrapedContent !== 'string' || !scrapedContent.trim()) {
      return NextResponse.json(
        { error: 'scrapedContent is required and must be non-empty text or markdown.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!siteUrl || typeof siteUrl !== 'string' || !siteUrl.trim()) {
      return NextResponse.json(
        { error: 'siteUrl is required (e.g. "https://example.com").' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Optional user identity from headers
    const resolvedOwnerEmail = req.headers.get('x-user-email') || ownerEmail || '';
    const resolvedOwnerId = req.headers.get('x-user-id') || ownerId || '';
    const resolvedOwnerName = req.headers.get('x-user-name') || ownerName || '';

    // Validate custom botConfig if supplied
    let validatedConfig: BotConfig | undefined;
    if (botConfig) {
      const parsed = BotConfigSchema.safeParse(botConfig);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid botConfig provided', details: parsed.error.issues },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      validatedConfig = parsed.data;
    }

    const result = await ingestAndBuildBot({
      scrapedContent,
      siteUrl,
      botConfig: validatedConfig,
      ownerId: resolvedOwnerId,
      ownerEmail: resolvedOwnerEmail,
      ownerName: resolvedOwnerName,
      primaryColor,
      position,
      chatProvider,
      apiKeys,
      options,
    });

    return NextResponse.json(
      {
        success: true,
        botId: result.botId,
        bot: {
          id: result.botId,
          name: result.bot.name,
          siteUrl: result.bot.siteUrl,
          primaryColor: result.bot.primaryColor,
          greeting: result.bot.greeting,
          suggestedQuestions: result.bot.suggestedQuestions,
          guardrails: result.bot.guardrails,
          handoff: result.bot.handoff,
          status: result.bot.status,
        },
        botConfig: result.botConfig,
        chunksCount: result.chunksCount,
        vectorStore: result.vectorStore,
      },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[BuildRoute] Ingest and build failed:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to ingest and build chatbot' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
