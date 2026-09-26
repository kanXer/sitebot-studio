import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/auth/adminAuth';
import { logoutWhatsApp } from '@/lib/whatsapp/baileysManager';

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

    const result = await logoutWhatsApp();

    return NextResponse.json({
      success: result.success,
      message: 'WhatsApp session terminated and auth data cleared from MongoDB',
    });
  } catch (error: any) {
    console.error('Error logging out WhatsApp:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to logout WhatsApp session' },
      { status: 500 }
    );
  }
}
