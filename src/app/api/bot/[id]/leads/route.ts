import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Chatbot, BotForm, FormSubmission } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface BotRecord {
  _id: string | mongoose.Types.ObjectId;
  name: string;
}

interface PopulatedForm {
  _id: string | mongoose.Types.ObjectId;
  title?: string;
  formType?: string;
  targetUrl?: string;
}

interface SubmissionRecord {
  _id: string | mongoose.Types.ObjectId;
  formId: string | PopulatedForm;
  sessionId: string;
  data: Record<string, unknown>;
  status: string;
  createdAt: Date;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format');

    // Verify bot
    let bot: BotRecord | null;
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

    const botIdStr = bot._id.toString();

    let formIds: string[] = [];
    if (isUsingMemoryDb()) {
      const forms = MemoryDb.findBotForms(botIdStr);
      formIds = forms.map((f) => f._id);
    } else {
      const forms = await BotForm.find({ botId: new mongoose.Types.ObjectId(bot._id) }).select('_id').lean();
      formIds = forms.map((f) => f._id.toString());
    }

    let submissions: SubmissionRecord[] = [];
    if (formIds.length > 0) {
      if (isUsingMemoryDb()) {
        submissions = Array.from(MemoryDb.findFormSubmissions()).filter((s) => formIds.includes(s.formId));
      } else {
        submissions = await FormSubmission.find({ formId: { $in: formIds } })
          .populate('formId', 'title formType targetUrl')
          .sort({ createdAt: -1 })
          .limit(200)
          .lean();
      }
    }

    // Support CSV download
    if (format === 'csv') {
      const headers = ['Submission ID', 'Date', 'Name', 'Email', 'Phone', 'Message', 'Status'];
      const rows = submissions.map((s) => {
        const d = s.data || {};
        const name = typeof d.name === 'string' ? d.name : '';
        const email = typeof d.email === 'string' ? d.email : '';
        const phone = typeof d.phone === 'string' ? d.phone : '';
        const message = typeof d.message === 'string' ? d.message : '';
        return [
          `"${s._id}"`,
          `"${new Date(s.createdAt).toISOString()}"`,
          `"${name.replace(/"/g, '""')}"`,
          `"${email.replace(/"/g, '""')}"`,
          `"${phone.replace(/"/g, '""')}"`,
          `"${message.replace(/"/g, '""')}"`,
          `"${s.status}"`,
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="leads-${bot.name.replace(/[^a-z0-9]/gi, '_')}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      botName: bot.name,
      totalLeads: submissions.length,
      submissions: submissions.map((s) => {
        const populatedForm = typeof s.formId === 'object' && s.formId !== null ? s.formId : null;
        return {
          id: s._id.toString(),
          formId: populatedForm ? populatedForm._id.toString() : s.formId,
          formTitle: populatedForm ? populatedForm.title : 'Lead Form',
          sessionId: s.sessionId,
          data: s.data || {},
          status: s.status,
          createdAt: s.createdAt,
        };
      }),
    });
  } catch (error: any) {
    console.error('Fetch bot leads error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch bot leads' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, _context: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const submissionId = searchParams.get('submissionId');

    if (!submissionId) {
      return NextResponse.json({ error: 'submissionId is required' }, { status: 400 });
    }

    if (isUsingMemoryDb()) {
      MemoryDb.deleteFormSubmission(submissionId);
    } else {
      await FormSubmission.findByIdAndDelete(submissionId);
    }

    return NextResponse.json({ success: true, message: 'Submission deleted' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete submission' },
      { status: 500 }
    );
  }
}
