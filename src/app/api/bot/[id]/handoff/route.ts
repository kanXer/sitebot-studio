import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Chatbot, Conversation } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { appendConversationMessage } from '@/lib/ai/handoff';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Dashboard agent endpoint to list conversations for this bot
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';

    // Verify bot
    let bot: any;
    if (isUsingMemoryDb()) {
      bot = MemoryDb.findChatbotById(id);
    } else {
      if (mongoose.Types.ObjectId.isValid(id)) {
        bot = await Chatbot.findById(id).lean();
      }
      if (!bot) {
        bot = await Chatbot.findOne({ slug: String(id || '').toLowerCase().trim() }).lean();
      }
    }

    if (!bot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    const botIdStr = (bot._id || bot.id).toString();

    let conversations: any[] = [];
    if (isUsingMemoryDb()) {
      conversations = MemoryDb.findConversationsByBot(botIdStr, status);
    } else {
      const query: any = { botId: new mongoose.Types.ObjectId(bot._id) };
      if (status && status !== 'all') {
        query.status = status;
      }
      conversations = await Conversation.find(query)
        .sort({ lastMessageAt: -1 })
        .limit(50)
        .lean();
    }

    return NextResponse.json({
      success: true,
      conversations: conversations.map((c) => ({
        id: c._id.toString(),
        sessionId: c.sessionId,
        status: c.status,
        handoffReason: c.handoffReason,
        visitor: c.visitor || { name: 'Visitor' },
        assignedAgent: c.assignedAgent || null,
        messageCount: c.messages ? c.messages.length : 0,
        messages: c.messages || [],
        lastMessageAt: c.lastMessageAt,
        createdAt: c.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Fetch bot conversations error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

/**
 * Dashboard agent action endpoint: accept, reply, resolve
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { action, sessionId, agentName = 'Support Agent', agentEmail = '', message = '' } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // Verify bot
    let bot: any;
    if (isUsingMemoryDb()) {
      bot = MemoryDb.findChatbotById(id);
    } else {
      if (mongoose.Types.ObjectId.isValid(id)) {
        bot = await Chatbot.findById(id).lean();
      }
      if (!bot) {
        bot = await Chatbot.findOne({ slug: String(id || '').toLowerCase().trim() }).lean();
      }
    }

    if (!bot) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    const botIdStr = (bot._id || bot.id).toString();
    const botObjectId = !isUsingMemoryDb() ? new mongoose.Types.ObjectId(bot._id) : null;

    if (action === 'accept') {
      // Assign human agent and set status to agent_active
      if (isUsingMemoryDb()) {
        MemoryDb.assignConversationAgent(botIdStr, sessionId, {
          name: agentName,
          email: agentEmail,
        });
      } else {
        await Conversation.findOneAndUpdate(
          { botId: botObjectId, sessionId },
          {
            $set: {
              status: 'agent_active',
              assignedAgent: { name: agentName, email: agentEmail },
              lastMessageAt: new Date(),
            },
          }
        );
      }

      await appendConversationMessage(botIdStr, sessionId, {
        role: 'system',
        content: `${agentName} has joined the chat and is now assisting you.`,
      });

      return NextResponse.json({
        success: true,
        message: `Assigned conversation to ${agentName}`,
      });
    }

    if (action === 'reply') {
      if (!message || !message.trim()) {
        return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
      }

      // Append agent message
      await appendConversationMessage(botIdStr, sessionId, {
        role: 'agent',
        content: message.trim(),
        senderName: agentName,
      });

      // Ensure conversation status is agent_active
      if (isUsingMemoryDb()) {
        MemoryDb.updateConversationStatus(botIdStr, sessionId, 'agent_active');
      } else {
        await Conversation.findOneAndUpdate(
          { botId: botObjectId, sessionId },
          {
            $set: {
              status: 'agent_active',
              lastMessageAt: new Date(),
            },
          }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Agent reply dispatched successfully',
      });
    }

    if (action === 'resolve') {
      if (isUsingMemoryDb()) {
        MemoryDb.updateConversationStatus(botIdStr, sessionId, 'resolved');
      } else {
        await Conversation.findOneAndUpdate(
          { botId: botObjectId, sessionId },
          {
            $set: {
              status: 'resolved',
              lastMessageAt: new Date(),
            },
          }
        );
      }

      await appendConversationMessage(botIdStr, sessionId, {
        role: 'system',
        content: 'This live session has been closed by the support agent. Automated AI assistance has been restored.',
      });

      return NextResponse.json({
        success: true,
        message: 'Conversation resolved and returned to AI bot',
      });
    }

    return NextResponse.json(
      { error: `Unknown action: "${action}". Supported actions: accept, reply, resolve.` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Agent action failure:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process agent action' },
      { status: 500 }
    );
  }
}
