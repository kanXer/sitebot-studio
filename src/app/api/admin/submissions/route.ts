import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
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

/**
 * Delete form submissions (leads captured from detected website forms).
 * Supports a single id, a botId scope, or ?all=1 to clear the lot.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminEmail = req.headers.get('x-user-email') || searchParams.get('email');
    const isAuthorized = await isAdminEmail(adminEmail);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required.' },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const id = searchParams.get('id');
    const botId = (searchParams.get('botId') || '').trim();
    const wantsAll = searchParams.get('all') === '1' || searchParams.get('all') === 'true';

    if (!id && !wantsAll && !botId) {
      return NextResponse.json({ error: 'Provide id, botId, or all=1' }, { status: 400 });
    }

    if (isUsingMemoryDb()) {
      if (id) {
        const deleted = MemoryDb.deleteFormSubmission(id);
        if (!deleted) {
          return NextResponse.json({ error: 'Form submission not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, deleted: 1, message: 'Form submission deleted' });
      }
      const deleted = MemoryDb.deleteAllFormSubmissions(botId || undefined);
      return NextResponse.json({
        success: true,
        deleted,
        message: `Deleted ${deleted} form submission(s).`,
      });
    }

    if (id) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: 'Invalid form submission ID' }, { status: 400 });
      }
      const res = await FormSubmission.findByIdAndDelete(id);
      if (!res) {
        return NextResponse.json({ error: 'Form submission not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, deleted: 1, message: 'Form submission deleted' });
    }

    // botId scope has to resolve through BotForm, since FormSubmission stores formId.
    let query: Record<string, any> = {};
    if (botId) {
      const forms = await BotForm.find({ botId }).select('_id').lean();
      query = { formId: { $in: forms.map((f: any) => f._id) } };
    }
    const res = await FormSubmission.deleteMany(query);
    return NextResponse.json({
      success: true,
      deleted: res.deletedCount || 0,
      message: `Deleted ${res.deletedCount || 0} form submission(s).`,
    });
  } catch (error) {
    console.error('Error deleting form submissions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete form submissions' },
      { status: 500 }
    );
  }
}
