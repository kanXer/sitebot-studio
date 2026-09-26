import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/auth/adminAuth';
import { initializeWhatsApp } from '@/lib/whatsapp/baileysManager';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const userEmail = req.headers.get('x-user-email');
    const isAuthorized = await isAdminEmail(userEmail);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin privileges required' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const forceNew = Boolean(body.forceNew);

    const result = await initializeWhatsApp({ forceNew });

    return NextResponse.json({
      success: true,
      status: result.status,
      qrCode: result.qrCode || '',
      phoneNumber: result.phoneNumber || '',
    });
  } catch (error: any) {
    console.error('Error initializing WhatsApp Baileys socket:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to initialize WhatsApp connection' },
      { status: 500 }
    );
  }
}
