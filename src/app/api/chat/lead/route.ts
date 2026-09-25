import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Chatbot, BotForm, FormSubmission } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { sendLeadNotifications } from '@/lib/notifications';
import { recordUsage } from '@/lib/usage';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-SiteBot-Preview',
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
      sessionId = `sess-${Date.now()}`,
      data = {},
    } = body;

    if (!email && !phone && !message) {
      return NextResponse.json(
        { error: 'At least an email, phone number, or message is required to submit a lead.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let resolvedBotId = botId;
    if (!resolvedBotId) {
      // Pick first active bot as default
      if (isUsingMemoryDb()) {
        const all = MemoryDb.findAllChatbots();
        if (all.length > 0) resolvedBotId = all[0]._id;
      } else {
        const bot = await Chatbot.findOne().lean();
        if (bot) resolvedBotId = bot._id.toString();
      }
    }

    if (!resolvedBotId) {
      return NextResponse.json(
        { error: 'No active chatbot available for lead attachment.' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    let formId = '';
    if (isUsingMemoryDb()) {
      let forms = MemoryDb.findBotForms(resolvedBotId);
      let targetForm = forms.find((f) => f.formType === 'LEAD_GENERATION');
      if (!targetForm) {
        targetForm = MemoryDb.createBotForm({
          botId: resolvedBotId,
          formType: 'LEAD_GENERATION',
          title: `Default Lead Capture`,
          targetUrl: 'https://sitebotstudio.app',
          fieldsSchema: [],
          isActive: true,
        });
      }
      formId = targetForm ? targetForm._id : '';
    } else {
      const botObjId = new mongoose.Types.ObjectId(resolvedBotId);
      let targetForm = await BotForm.findOne({ botId: botObjId, formType: 'LEAD_GENERATION' });
      if (!targetForm) {
        targetForm = await BotForm.create({
          botId: botObjId,
          formType: 'LEAD_GENERATION',
          title: `Default Lead Capture`,
          targetUrl: 'https://sitebotstudio.app',
          fieldsSchema: [],
          isActive: true,
        });
      }
      formId = targetForm._id.toString();
    }

    const submissionData = {
      name: name || data.name || '',
      email: email || data.email || '',
      phone: phone || data.phone || '',
      message: message || data.message || '',
      ...data,
      source: 'casual_chat_extraction',
      capturedAt: new Date().toISOString(),
    };

    let submission: any;
    if (isUsingMemoryDb()) {
      submission = MemoryDb.createFormSubmission({
        formId,
        sessionId,
        data: submissionData,
        status: 'completed',
      });
    } else {
      submission = await FormSubmission.create({
        formId,
        sessionId,
        data: submissionData,
        status: 'completed',
      });
    }

    // Fire owner notifications + track usage (fire-and-forget)
    const ownerBot: any = isUsingMemoryDb()
      ? MemoryDb.findChatbotById(resolvedBotId)
      : await Chatbot.findById(resolvedBotId).select('ownerId ownerEmail name siteUrl handoff notifications').lean();

    if (ownerBot?.ownerEmail) {
      sendLeadNotifications({
        bot: ownerBot,
        lead: {
          name: submissionData.name || '',
          email: submissionData.email || '',
          phone: submissionData.phone || '',
          message: submissionData.message || '',
          campaign: 'Casual Chat Extraction',
          page: ownerBot.siteUrl || '',
          botId: resolvedBotId,
          ownerId: ownerBot.ownerId || '',
          ownerEmail: ownerBot.ownerEmail,
          source: 'casual_chat_extraction',
        },
        ownerEmail: ownerBot.ownerEmail,
      }).catch((err) => console.warn('[Lead] Notification failed:', err));

      recordUsage(
        { email: ownerBot.ownerEmail, userId: ownerBot.ownerId },
        { leads: true }
      ).catch(() => {});

      if (isUsingMemoryDb()) {
        MemoryDb.incrementChatbotLeadCount(resolvedBotId);
      } else {
        try {
          await Chatbot.updateOne(
            { _id: resolvedBotId },
            { $inc: { 'usage.leads': 1 } }
          );
        } catch {}
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Lead captured successfully',
        submissionId: submission._id,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('Lead submission failure:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to capture lead' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
