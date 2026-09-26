import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/auth/adminAuth';
import { getWhatsAppStatus } from '@/lib/whatsapp/baileysManager';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { ChatTicket } from '@/lib/models/ChatTicket';

export async function GET(req: NextRequest) {
  try {
    const userEmail = req.headers.get('x-user-email');
    const isAuthorized = await isAdminEmail(userEmail);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin privileges required' },
        { status: 403 }
      );
    }

    const meta = await getWhatsAppStatus();

    let openTickets = 0;
    try {
      await connectToDatabase();
      if (!isUsingMemoryDb()) {
        openTickets = await ChatTicket.countDocuments({
          status: { $in: ['open', 'waiting_admin', 'admin_replied'] },
        });
      }
    } catch {
      // non-fatal
    }

    return NextResponse.json({
      success: true,
      status: meta.status || 'disconnected',
      qrCode: meta.qrCode || '',
      phoneNumber: meta.phoneNumber || '',
      pushName: meta.pushName || '',
      jid: meta.jid || '',
      lastConnectedAt: meta.lastConnectedAt || null,
      openTickets,
    });
  } catch (error: any) {
    console.error('Error in WhatsApp status route:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to retrieve WhatsApp status' },
      { status: 500 }
    );
  }
}
