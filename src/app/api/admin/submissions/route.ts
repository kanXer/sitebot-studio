import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { FormSubmission, BotForm, Chatbot } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { isAdminEmail } from '@/lib/auth/adminAuth';

interface AdminSubmissionSummary {
  id: string;
  formId: string;
  botId: string;
  botName: string;
  siteUrl: string;
  formType: string;
  targetUrl: string;
  sessionId: string;
  data: Record<string, unknown>;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userEmail = req.headers.get('x-user-email') || searchParams.get('email');
    const botId = searchParams.get('botId');

    const isAuthorized = await isAdminEmail(userEmail);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required.' },
        { status: 403 }
      );
    }

    await connectToDatabase();

    let submissions: AdminSubmissionSummary[] = [];
    if (isUsingMemoryDb()) {
      const subs = MemoryDb.findFormSubmissions();
      submissions = subs.map((s) => {
        const form = MemoryDb.findBotFormById(s.formId);
        const bot = form ? MemoryDb.findChatbotById(form.botId) : null;
        return {
          id: s._id,
          formId: s.formId,
          botId: bot?._id || '',
          botName: bot?.name || 'Unknown Bot',
          siteUrl: bot?.siteUrl || '',
          formType: form?.formType || 'OTHER',
          targetUrl: form?.targetUrl || '',
          sessionId: s.sessionId,
          data: s.data || {},
          status: s.status,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        };
      });
      if (botId) {
        submissions = submissions.filter((s) => s.botId === botId);
      }
    } else {
      const subs = await FormSubmission.find()
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

      // Gather form IDs
      const formIds = Array.from(new Set(subs.map((s) => s.formId)));
      const forms = await BotForm.find({ _id: { $in: formIds } }).lean();
      const formMap = new Map(forms.map((f) => [f._id.toString(), f]));

      const botIds = Array.from(new Set(forms.map((f) => f.botId)));
      const bots = await Chatbot.find({ _id: { $in: botIds } })
        .select('name siteUrl')
        .lean();
      const botMap = new Map(bots.map((b) => [b._id.toString(), b]));

      submissions = subs.map((s) => {
        const form = formMap.get(s.formId);
        const bot = form ? botMap.get(form.botId.toString()) : null;
        return {
          id: s._id.toString(),
          formId: s.formId,
          botId: bot?._id?.toString() || '',
          botName: bot?.name || 'Unknown Bot',
          siteUrl: bot?.siteUrl || '',
          formType: form?.formType || 'OTHER',
          targetUrl: form?.targetUrl || '',
          sessionId: s.sessionId,
          data: s.data || {},
          status: s.status,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        };
      });

      if (botId) {
        submissions = submissions.filter((s) => s.botId === botId);
      }
    }

    return NextResponse.json({
      success: true,
      submissions,
    });
  } catch (error) {
    console.error('Error fetching admin form submissions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch form submissions' },
      { status: 500 }
    );
  }
}
