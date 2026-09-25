import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { CtaSubmission, Chatbot } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { sendLeadNotifications } from '@/lib/notifications';
import { recordUsage } from '@/lib/usage';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json().catch(() => ({}));

    const {
      botId = '',
      name = '',
      email = '',
      phone = '',
      message = '',
      campaign = 'default',
      page = '',
      source = 'website_cta',
    } = body;

    if (!name && !email && !phone) {
      return NextResponse.json(
        {
          error:
            'Please provide at least your name (an email or phone number also helps us contact you).',
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Resolve owning bot/user
    let ownerBot: any = null;
    if (botId) {
      ownerBot = isUsingMemoryDb()
        ? MemoryDb.findChatbotById(botId)
        : await Chatbot.findById(botId).lean();
    } else if (body.siteUrl) {
      const url = String(body.siteUrl);
      ownerBot = isUsingMemoryDb()
        ? MemoryDb.findChatbots().find((b) => b.siteUrl === url || b.siteUrl === url.replace(/\/$/, ''))
        : await Chatbot.findOne({
            $or: [{ siteUrl: url }, { siteUrl: url.replace(/\/$/, '') }],
          }).lean();
    }

    const ownerId = ownerBot?.ownerId || body.ownerId || '';
    const ownerEmail = ownerBot?.ownerEmail || body.ownerEmail || '';

    let submission: any;
    if (isUsingMemoryDb()) {
      submission = MemoryDb.createCtaSubmission({
        botId: ownerBot?._id || botId,
        campaign,
        page,
        name,
        email,
        phone,
        message,
        ownerId,
        ownerEmail,
        source,
      });
    } else {
      submission = await CtaSubmission.create({
        botId: ownerBot?._id?.toString() || botId,
        campaign,
        page,
        name,
        email,
        phone,
        message,
        ownerId,
        ownerEmail,
        source,
      });
    }

    // Fire notifications in background (don't block response)
    if (ownerEmail) {
      const leadPayload = {
        name,
        email,
        phone,
        message,
        campaign,
        page,
        botId: ownerBot?._id?.toString() || botId,
        ownerId,
        ownerEmail,
        source,
      };
      sendLeadNotifications({ bot: ownerBot, lead: leadPayload, ownerEmail }).catch((err) =>
        console.warn('[CTA] Notification failed:', err)
      );
      recordUsage(
        { email: ownerEmail, userId: ownerId },
        { leads: true, chats: false }
      ).catch(() => {});
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Thank you! Your details have been received.',
        submissionId: submission._id,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('CTA submission failure:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}