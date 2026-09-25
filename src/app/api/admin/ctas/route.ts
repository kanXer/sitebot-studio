import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { CtaSubmission, Chatbot } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { isAdminEmail } from '@/lib/auth/adminAuth';

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

    let ctas: any[] = [];
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
  } catch (error: any) {
    console.error('Error fetching admin CTA submissions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch CTA submissions' },
      { status: 500 }
    );
  }
}