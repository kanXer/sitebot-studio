import { NextRequest, NextResponse } from 'next/server';
import { generateBotConfig } from '@/lib/bot-builder';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  return NextResponse.json(
    {
      endpoint: '/api/bot/generate',
      description:
        'AI Meta-Analysis pass that dynamically derives bot identity, tone, contextual lead triggers, qualifying questions, and guardrails from raw scraped website content.',
      schema: {
        scrapedContent: 'string (raw website text or markdown, required)',
        options: {
          provider: "'gemini' | 'openrouter' | 'openai' | 'anthropic' (optional)",
          model: 'string (optional model override)',
          apiKey: 'string (optional BYOK key)',
          temperature: 'number (optional, default 0.2)',
        },
      },
      outputSchema: {
        bot_name: 'string',
        company_name: 'string',
        tone: 'string',
        core_value_prop: 'string',
        lead_triggers: 'string[]',
        qualification_questions: {
          ask_for_email: 'string',
          ask_for_phone: 'string',
        },
        guardrails: 'string[]',
        support_email: 'string',
        phone: 'string',
      },
    },
    { headers: CORS_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { scrapedContent, options } = body;

    if (!scrapedContent || typeof scrapedContent !== 'string' || !scrapedContent.trim()) {
      return NextResponse.json(
        { error: 'scrapedContent is required and must be non-empty text or markdown.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const botConfig = await generateBotConfig(scrapedContent, options);

    return NextResponse.json(
      {
        success: true,
        botConfig,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[GenerateRoute] AI Meta-Analysis failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate bot configuration' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
