import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { CtaSubmission, Chatbot } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { isAdminEmail } from '@/lib/auth/adminAuth';

interface AdminCtaSummary {
  id: string;
  botId?: string;
  botName: string;
  campaign: string;
  page: string;
  name: string;
  email?: string;
  phone?: string;
  message?: string;
  ownerEmail?: string;
  source: string;
  createdAt: Date;
}

export async function GET(req: NextRequest) {
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

    let ctas: AdminCtaSummary[] = [];
    if (isUsingMemoryDb()) {
      ctas = MemoryDb.findAllCtaSubmissions().map((c) => {
        const bot = c.botId ? MemoryDb.findChatbotById(c.botId) : null;
        return {
          id: c._id,
          botId: c.botId,
          botName: bot?.name || '',
          campaign: c.campaign,
          page: c.page,
          name: c.name,
          email: c.email,
          phone: c.phone,
          message: c.message,
          ownerEmail: c.ownerEmail,
          source: c.source,
          createdAt: c.createdAt,
        };
      });
    } else {
      const subs = await CtaSubmission.find().sort({ createdAt: -1 }).limit(500).lean();
      const botIdStrings = Array.from(
        new Set(subs.map((s) => s.botId || '').filter(Boolean))
      );
      const botIds = botIdStrings
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      const bots = await Chatbot.find({ _id: { $in: botIds } }).select('name').lean();
      const botMap = new Map(bots.map((b) => [b._id.toString(), b.name || '']));
      ctas = subs.map((c) => ({
        id: c._id.toString(),
        botId: c.botId,
        botName: botMap.get(c.botId || '') || '',
        campaign: c.campaign,
        page: c.page,
        name: c.name,
        email: c.email,
        phone: c.phone,
        message: c.message,
        ownerEmail: c.ownerEmail,
        source: c.source,
        createdAt: c.createdAt,
      }));
    }

    const exportMode = searchParams.get('export') === 'csv';
    if (exportMode) {
      const csvRows = [
        ['createdAt', 'ownerEmail', 'botName', 'campaign', 'page', 'name', 'email', 'phone', 'message', 'source'].join(','),
        ...ctas.map((c) =>
          [
            new Date(c.createdAt).toISOString(),
            `"${String(c.ownerEmail || '')}"`,
            `"${String(c.botName || '').replace(/"/g, '""')}"`,
            `"${String(c.campaign || '').replace(/"/g, '""')}"`,
            `"${String(c.page || '').replace(/"/g, '""')}"`,
            `"${String(c.name || '').replace(/"/g, '""')}"`,
            `"${String(c.email || '')}"`,
            `"${String(c.phone || '')}"`,
            `"${String(c.message || '').replace(/"/g, '""')}"`,
            `"${String(c.source || '')}"`,
          ].join(',')
        ),
      ].join('\n');
      return new NextResponse(csvRows, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="sitebot-ctas-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      total: ctas.length,
      ctas,
    });
  } catch (error) {
    console.error('Error fetching admin CTA submissions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch CTA submissions' },
      { status: 500 }
    );
  }
}
/**
 * Delete CTA submissions (leads captured from call-to-action buttons).
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
        const deleted = MemoryDb.deleteCtaSubmissionById(id);
        if (!deleted) {
          return NextResponse.json({ error: 'CTA submission not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, deleted: 1, message: 'CTA submission deleted' });
      }
      const deleted = MemoryDb.deleteAllCtaSubmissions(botId || undefined);
      return NextResponse.json({ success: true, deleted, message: `Deleted ${deleted} CTA submission(s).` });
    }

    if (id) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: 'Invalid CTA submission ID' }, { status: 400 });
      }
      const res = await CtaSubmission.findByIdAndDelete(id);
      if (!res) {
        return NextResponse.json({ error: 'CTA submission not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, deleted: 1, message: 'CTA submission deleted' });
    }

    const query = botId ? { botId } : {};
    const res = await CtaSubmission.deleteMany(query);
    return NextResponse.json({
      success: true,
      deleted: res.deletedCount || 0,
      message: `Deleted ${res.deletedCount || 0} CTA submission(s).`,
    });
  } catch (error) {
    console.error('Error deleting CTA submissions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete CTA submissions' },
      { status: 500 }
    );
  }
}
