import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Chatbot, BotForm, FormSubmission } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { appendConversationMessage } from '@/lib/ai/handoff';
import { sendLeadNotifications } from '@/lib/notifications';
import { recordUsage } from '@/lib/usage';

interface RouteParams {
  params: Promise<{ botId: string }>;
}

type ObjectIdLike = { toString(): string };

interface LeadBot {
  _id: ObjectIdLike;
  name: string;
  siteUrl: string;
  ownerEmail?: string;
  ownerId?: string;
}

interface LeadSubmission {
  _id: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (isRecord(error) && typeof error.message === 'string' && error.message) {
    return error.message;
  }
  return fallback;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-SiteBot-Preview',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { botId } = await params;
    const rawBody: unknown = await req.json().catch(() => ({}));
    const body = isRecord(rawBody) ? rawBody : {};
    const name = typeof body.name === 'string' ? body.name : '';
    const email = typeof body.email === 'string' ? body.email : '';
    const phone = typeof body.phone === 'string' ? body.phone : '';
    const message = typeof body.message === 'string' ? body.message : '';
    const formType =
      typeof body.formType === 'string' ? body.formType : 'LEAD_GENERATION';
    const sessionId =
      typeof body.sessionId === 'string'
        ? body.sessionId
        : `sess-${Date.now()}`;
    const data = isRecord(body.data) ? body.data : {};

    if (!name || !email || !phone) {
      return NextResponse.json(
        { error: 'Name, email address, and phone number are all required to submit a lead.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Resolve bot
    let bot: LeadBot | null;
    if (isUsingMemoryDb()) {
      bot = MemoryDb.findChatbotById(botId);
    } else if (mongoose.Types.ObjectId.isValid(botId)) {
      bot = await Chatbot.findById(botId).lean();
    } else {
      bot = await Chatbot.findOne({ slug: String(botId || '').toLowerCase() }).lean();
    }

    if (!bot) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const resolvedBotId = bot._id.toString();

    // 1. Locate or create default bot form
    let formId = '';
    if (isUsingMemoryDb()) {
      const forms = MemoryDb.findBotForms(resolvedBotId);
      let targetForm = forms.find((f) => f.formType === formType || f.formType === 'LEAD_GENERATION');
      if (!targetForm) {
        targetForm = MemoryDb.createBotForm({
          botId: resolvedBotId,
          formType: 'LEAD_GENERATION',
          title: `${bot.name} Lead Capture`,
          targetUrl: bot.siteUrl,
          fieldsSchema: [
            { key: 'name', label: 'Full Name', type: 'string', required: false, selector: 'input[name="name"]' },
            { key: 'email', label: 'Email Address', type: 'string', required: true, selector: 'input[name="email"]' },
            { key: 'phone', label: 'Phone Number', type: 'string', required: false, selector: 'input[name="phone"]' },
            { key: 'message', label: 'Requirement / Message', type: 'string', required: false, selector: 'textarea' },
          ],
          isActive: true,
        });
      }
      formId = targetForm ? targetForm._id : '';
    } else {
      const botObjId = new mongoose.Types.ObjectId(resolvedBotId);
      let targetForm = await BotForm.findOne({
        botId: botObjId,
        formType: { $in: [formType, 'LEAD_GENERATION'] },
      });

      if (!targetForm) {
        targetForm = await BotForm.create({
          botId: botObjId,
          formType: 'LEAD_GENERATION',
          title: `${bot.name} Lead Capture`,
          targetUrl: bot.siteUrl,
          fieldsSchema: [
            { key: 'name', label: 'Full Name', type: 'string', required: false, selector: 'input[name="name"]' },
            { key: 'email', label: 'Email Address', type: 'string', required: true, selector: 'input[name="email"]' },
            { key: 'phone', label: 'Phone Number', type: 'string', required: false, selector: 'input[name="phone"]' },
            { key: 'message', label: 'Requirement / Message', type: 'string', required: false, selector: 'textarea' },
          ],
          isActive: true,
        });
      }
      formId = targetForm._id.toString();
    }

    // 2. Prepare payload
    const submissionData: Record<string, unknown> = {
      name: name || (typeof data.name === 'string' ? data.name : ''),
      email: email || (typeof data.email === 'string' ? data.email : ''),
      phone: phone || (typeof data.phone === 'string' ? data.phone : ''),
      message: message || (typeof data.message === 'string' ? data.message : ''),
      ...data,
      source: 'live_chat_widget',
      capturedAt: new Date().toISOString(),
    };
    const submissionName =
      typeof submissionData.name === 'string' ? submissionData.name : '';
    const submissionEmail =
      typeof submissionData.email === 'string' ? submissionData.email : '';
    const submissionPhone =
      typeof submissionData.phone === 'string' ? submissionData.phone : '';
    const submissionMessage =
      typeof submissionData.message === 'string' ? submissionData.message : '';

    // 3. Store submission
    let submission: LeadSubmission;
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

    // 4. Log system notice to conversation transcript
    try {
      await appendConversationMessage(resolvedBotId, sessionId, {
        role: 'system',
        content: `Lead captured: ${submissionName || 'Visitor'} (${submissionEmail || submissionPhone || 'No direct contact'})`,
      });
    } catch {
      // non-fatal
    }

    // 5. Fire owner notifications + track usage (fire-and-forget)
    if (bot.ownerEmail) {
      sendLeadNotifications({
        bot,
        lead: {
          name: submissionName,
          email: submissionEmail,
          phone: submissionPhone,
          message: submissionMessage,
          campaign: 'Live Chat Widget',
          page: bot.siteUrl || '',
          botId: resolvedBotId,
          ownerId: bot.ownerId || '',
          ownerEmail: bot.ownerEmail,
          source: 'live_chat_widget',
        },
        ownerEmail: bot.ownerEmail,
      }).catch((err) => console.warn('[Lead] Notification failed:', err));

      recordUsage(
        { email: bot.ownerEmail, userId: bot.ownerId },
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
        message: 'Lead captured successfully! Our team will contact you soon.',
        submissionId: submission._id,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error: unknown) {
    console.error('Lead capture failed:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to capture lead') },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
