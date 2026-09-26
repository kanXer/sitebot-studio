import { NextRequest } from 'next/server';
import { isAdminEmail } from '@/lib/auth/adminAuth';
import { startPairingStream } from '@/lib/whatsapp/baileysManager';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Live WhatsApp QR Pairing SSE Stream for Vercel & Production.
 * Keeps the serverless function actively streaming chunks so Vercel
 * never freezes the container while the user scans the QR code.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const emailFromQuery = url.searchParams.get('email');
    const userEmail = req.headers.get('x-user-email') || emailFromQuery;

    const isAuthorized = await isAdminEmail(userEmail);
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin privileges required' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const forceNew = url.searchParams.get('forceNew') === 'true';

    return startPairingStream({
      forceNew,
      abortSignal: req.signal,
    });
  } catch (error: any) {
    console.error('Error in WhatsApp pairing stream route:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to initialize pairing stream' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
