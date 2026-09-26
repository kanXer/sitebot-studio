import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/auth/adminAuth';
import { sendWhatsAppMessage } from '@/lib/whatsapp/baileysManager';

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
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!phone) {
      return NextResponse.json(
        { error: 'Recipient phone number is required (with country code, e.g. +919876543210)' },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: 'Message content cannot be empty' },
        { status: 400 }
      );
    }

    const result = await sendWhatsAppMessage(phone, message);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'Failed to dispatch WhatsApp message' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Message dispatched successfully to ${phone}`,
    });
  } catch (error: any) {
    console.error('Error sending test WhatsApp message:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to send WhatsApp message' },
      { status: 500 }
    );
  }
}
