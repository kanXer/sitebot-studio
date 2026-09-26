import { NextRequest, NextResponse } from 'next/server';
import {
  getWebhookVerifyToken,
  handleMetaIncomingWebhook,
} from '@/lib/whatsapp/metaCloudManager';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Hub-Signature-256',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * GET /api/whatsapp/webhook
 * Meta WhatsApp Webhook Verification Challenge.
 * Used when you click "Verify and save" in the Meta App Developer Console.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const expectedToken = getWebhookVerifyToken();

    if (mode === 'subscribe' && token === expectedToken) {
      console.log('[Meta Webhook] Successfully verified subscription challenge');
      return new NextResponse(challenge || '', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          ...CORS_HEADERS,
        },
      });
    }

    console.warn(
      `[Meta Webhook] Verification failed. Expected token: "${expectedToken}", received: "${token}"`
    );
    return NextResponse.json(
      { error: 'Forbidden: Invalid verification token or mode' },
      { status: 403, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('[Meta Webhook] Error during verification:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error during verification' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

/**
 * POST /api/whatsapp/webhook
 * Inbound events from Meta WhatsApp Cloud API (messages, status updates, deliveries).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Check if it's a WhatsApp Business Account webhook event
    if (body?.object === 'whatsapp_business_account') {
      // Process incoming message in the request context
      const result = await handleMetaIncomingWebhook(body);
      return NextResponse.json(
        { status: 'ok', processed: result.processed, results: result.results },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Always acknowledge unhandled Meta webhook events with 200 OK so Meta doesn't disable the webhook
    return NextResponse.json({ status: 'ok' }, { status: 200, headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[Meta Webhook] Error processing incoming payload:', error);
    // Return 200 even on error to prevent Meta from retrying broken payloads endlessly
    return NextResponse.json(
      { status: 'ok', error: error?.message || 'Internal processing error' },
      { status: 200, headers: CORS_HEADERS }
    );
  }
}
