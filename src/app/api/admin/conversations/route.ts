import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Conversation, Chatbot } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { isAdminEmail } from '@/lib/auth/adminAuth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminEmail = req.headers.get('x-user-email') || searchParams.get('email');
    const isAuthorized = await isAdminEmail(adminEmail);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const botIdFilter = searchParams.get('botId') || 'all';
    const statusFilter = searchParams.get('status') || 'all';
    const search = (searchParams.get('search') || '').toLowerCase().trim();
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 100)));

    await connectToDatabase();

    let conversations: any[] = [];
    const botNameMap = new Map<string, string>();

    if (isUsingMemoryDb()) {
      // Build bot name cache
      for (const b of MemoryDb.findChatbots()) {
        botNameMap.set(b._id.toString(), b.name);
      }

      let allConvs = MemoryDb.findAllConversations(500);

      if (botIdFilter !== 'all') {
        allConvs = allConvs.filter((c) => c.botId === botIdFilter);
      }
      if (statusFilter !== 'all') {
        allConvs = allConvs.filter((c) => c.status === statusFilter);
      }

      conversations = allConvs.map((c) => ({
        id: c._id.toString(),
        botId: c.botId,
        botName: botNameMap.get(c.botId) || 'Unknown Bot',
        sessionId: c.sessionId,
        visitor: c.visitor || { name: 'Visitor' },
        status: c.status || 'bot',
        handoffReason: c.handoffReason || '',
        assignedAgent: c.assignedAgent,
        messagesCount: c.messages?.length || 0,
        lastMessage: c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1] : null,
        messages: c.messages || [],
        lastMessageAt: c.lastMessageAt || c.createdAt,
        createdAt: c.createdAt,
      }));
    } else {
      const bots = await Chatbot.find().select('_id name').lean();
      for (const b of bots) {
        botNameMap.set(b._id.toString(), b.name);
      }

      const query: any = {};
      if (botIdFilter !== 'all') {
        query.botId = botIdFilter;
      }
      if (statusFilter !== 'all') {
        query.status = statusFilter;
      }

      const dbConvs = await Conversation.find(query)
        .sort({ lastMessageAt: -1 })
        .limit(limit)
        .lean();

      conversations = dbConvs.map((c: any) => ({
        id: c._id.toString(),
        botId: c.botId ? c.botId.toString() : '',
        botName: botNameMap.get(c.botId?.toString()) || 'Unknown Bot',
        sessionId: c.sessionId,
        visitor: c.visitor || { name: 'Visitor' },
        status: c.status || 'bot',
        handoffReason: c.handoffReason || '',
        assignedAgent: c.assignedAgent,
        messagesCount: c.messages?.length || 0,
        lastMessage: c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1] : null,
        messages: c.messages || [],
        lastMessageAt: c.lastMessageAt || c.createdAt,
        createdAt: c.createdAt,
      }));
    }

    if (search) {
      conversations = conversations.filter((c) => {
        const botMatch = c.botName.toLowerCase().includes(search);
        const visitorMatch =
          (c.visitor?.name || '').toLowerCase().includes(search) ||
          (c.visitor?.email || '').toLowerCase().includes(search) ||
          (c.visitor?.phone || '').toLowerCase().includes(search);
        const msgMatch = (c.messages || []).some((m: any) =>
          (m.content || '').toLowerCase().includes(search)
        );
        return botMatch || visitorMatch || msgMatch;
      });
    }

    return NextResponse.json({
      success: true,
      total: conversations.length,
      conversations: conversations.slice(0, limit),
    });
  } catch (error) {
    console.error('Error fetching admin conversations:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminEmail = req.headers.get('x-user-email') || searchParams.get('email');
    const isAuthorized = await isAdminEmail(adminEmail);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectToDatabase();

    // Bulk clear, optionally scoped to one bot.
    const botIdFilter = (searchParams.get('botId') || '').trim();

    if (searchParams.get('all') === '1' || searchParams.get('all') === 'true') {
      let removed = 0;
      if (isUsingMemoryDb()) {
        removed = MemoryDb.deleteAllConversations(botIdFilter || undefined);
      } else {
        const query = botIdFilter ? { botId: botIdFilter } : {};
        const res = await Conversation.deleteMany(query);
        removed = res.deletedCount || 0;
      }
      return NextResponse.json({
        success: true,
        message: `Deleted ${removed} conversation(s).`,
        deleted: removed,
      });
    }

    const convId = searchParams.get('id');
    if (!convId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    let deleted = false;
    if (isUsingMemoryDb()) {
      // This used to be a silent no-op in memory mode: the API replied
      // "Conversation deleted" while the record stayed in the store.
      deleted = MemoryDb.deleteConversationById(convId);
    } else {
      const res = await Conversation.findByIdAndDelete(convId);
      deleted = Boolean(res);
    }

    if (!deleted) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Conversation deleted', deleted: 1 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
  }
}
