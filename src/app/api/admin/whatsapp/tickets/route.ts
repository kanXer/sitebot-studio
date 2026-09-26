import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { isAdminEmail } from '@/lib/auth/adminAuth';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { ChatTicket } from '@/lib/models/ChatTicket';
import { Conversation } from '@/lib/models/Conversation';
import { appendConversationMessage } from '@/lib/ai/handoff';

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

    await connectToDatabase();
    if (isUsingMemoryDb()) {
      return NextResponse.json({ success: true, tickets: [] });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const query: Record<string, any> = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const tickets = await ChatTicket.find(query)
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({
      success: true,
      tickets: tickets.map((t) => ({
        id: t._id.toString(),
        ticketId: t.ticketId,
        botId: t.botId,
        botName: t.botName,
        sessionId: t.sessionId,
        visitor: t.visitor,
        status: t.status,
        lastUserMessage: t.lastUserMessage,
        lastAdminReply: t.lastAdminReply,
        messages: t.messages || [],
        closedAt: t.closedAt,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching tickets:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch tickets' },
      { status: 500 }
    );
  }
}

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
    const ticketId = typeof body.ticketId === 'string' ? body.ticketId.trim() : '';
    const action = typeof body.action === 'string' ? body.action : 'reply';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const adminName = typeof body.adminName === 'string' ? body.adminName.trim() : 'Admin';

    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId is required' }, { status: 400 });
    }

    await connectToDatabase();
    const ticket = await ChatTicket.findOne({ ticketId });
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (action === 'close') {
      ticket.status = 'closed';
      ticket.closedAt = new Date();
      ticket.messages.push({
        id: crypto.randomUUID(),
        role: 'system',
        senderName: 'System',
        content: `Ticket closed by ${adminName}. AI assistant resumed.`,
        timestamp: new Date(),
      });
      await ticket.save();

      // Resolve conversation
      if (!isUsingMemoryDb() && ticket.sessionId) {
        await Conversation.findOneAndUpdate(
          { sessionId: ticket.sessionId },
          { $set: { status: 'resolved', lastMessageAt: new Date() } }
        );
      }

      await appendConversationMessage(String(ticket.botId), ticket.sessionId, {
        role: 'system',
        content: 'Support agent closed this ticket. AI assistant resumed.',
      });

      return NextResponse.json({
        success: true,
        message: `Ticket #${ticketId} closed successfully`,
      });
    }

    if (action === 'reply') {
      if (!message) {
        return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
      }

      ticket.status = 'admin_replied';
      ticket.lastAdminReply = message;
      ticket.messages.push({
        id: crypto.randomUUID(),
        role: 'agent',
        senderName: adminName,
        content: message,
        timestamp: new Date(),
      });
      await ticket.save();

      // Relay to visitor widget
      await appendConversationMessage(String(ticket.botId), ticket.sessionId, {
        role: 'agent',
        senderName: adminName,
        content: message,
      });

      if (!isUsingMemoryDb() && ticket.sessionId) {
        await Conversation.findOneAndUpdate(
          { sessionId: ticket.sessionId },
          { $set: { status: 'agent_active', lastMessageAt: new Date() } }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Reply relayed to visitor on ticket #${ticketId}`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error handling ticket action:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to perform ticket action' },
      { status: 500 }
    );
  }
}
