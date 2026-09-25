import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { UserProfile, UsageRecord } from '@/lib/models';
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

    let profiles: any[] = [];
    if (isUsingMemoryDb()) {
      profiles = MemoryDb.findAllUserProfiles().map((p) => ({
        email: p.email,
        name: p.name,
        companyName: p.companyName,
        phone: p.phone,
        plan: p.plan,
        planExpiresAt: p.planExpiresAt,
        botLimit: p.botLimit,
        tokenQuota: p.tokenQuota,
        chatQuota: p.chatQuota,
        usage: p.usage || {},
        createdAt: p.createdAt,
      }));
    } else {
      const users = await UserProfile.find().sort({ createdAt: -1 }).limit(500).lean();
      profiles = users.map((u) => ({
        email: u.email,
        name: u.name,
        companyName: u.companyName,
        phone: u.phone,
        plan: u.plan || 'free',
        planExpiresAt: u.planExpiresAt,
        botLimit: u.botLimit,
        tokenQuota: u.tokenQuota,
        chatQuota: u.chatQuota,
        usage: u.usage || {},
        createdAt: u.createdAt,
      }));
    }

    // Attach aggregated monthly usage
    const aggregated = new Map<string, any>();
    if (isUsingMemoryDb()) {
      for (const rec of MemoryDb.findUsageRecords()) {
        const cur = aggregated.get(rec.email) || {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          chats: 0,
          leads: 0,
        };
        cur.inputTokens += rec.inputTokens;
        cur.outputTokens += rec.outputTokens;
        cur.totalTokens += rec.totalTokens;
        cur.chats += rec.chats;
        cur.leads += rec.leads;
        aggregated.set(rec.email, cur);
      }
    } else {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const recs = await UsageRecord.find({ date: { $gte: monthStart.toISOString().slice(0, 10) } }).lean();
      for (const rec of recs) {
        const cur = aggregated.get(rec.email) || {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          chats: 0,
          leads: 0,
        };
        cur.inputTokens += rec.inputTokens;
        cur.outputTokens += rec.outputTokens;
        cur.totalTokens += rec.totalTokens;
        cur.chats += rec.chats;
        cur.leads += rec.leads;
        aggregated.set(rec.email, cur);
      }
    }

    const users = profiles.map((u) => {
      const usg: any = aggregated.get(u.email) || {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        chats: 0,
        leads: 0,
      };
      return {
        ...u,
        usage: {
          ...(u.usage || {}),
          monthInputTokens: usg.inputTokens,
          monthOutputTokens: usg.outputTokens,
          monthTotalTokens: usg.totalTokens,
          monthChats: usg.chats,
          monthLeads: usg.leads,
        },
        quotaPercent: {
          tokens: u.tokenQuota
            ? Math.min(100, Math.round(((u.usage?.inputTokens || 0) + (u.usage?.outputTokens || 0)) / u.tokenQuota * 100))
            : 0,
          chats: u.chatQuota
            ? Math.min(100, Math.round(((u.usage?.chats || 0) / u.chatQuota) * 100))
            : 0,
        },
      };
    });

    const exportMode = searchParams.get('export') === 'csv';
    if (exportMode) {
      const csvRows = [
        [
          'email',
          'name',
          'company',
          'phone',
          'plan',
          'bots',
          'tokenQuota',
          'monthTokens',
          'chats',
          'monthChats',
          'leads',
          'monthLeads',
          'createdAt',
        ].join(','),
        ...users.map((u) =>
          [
            u.email,
            `"${String(u.name || '').replace(/"/g, '""')}"`,
            `"${String(u.companyName || '').replace(/"/g, '""')}"`,
            `"${String(u.phone || '')}"`,
            u.plan,
            u.botCount ?? '',
            u.tokenQuota,
            u.usage.monthTotalTokens,
            u.usage.chats,
            u.usage.monthChats,
            u.usage.leads,
            u.usage.monthLeads,
            u.createdAt ? new Date(u.createdAt).toISOString() : '',
          ].join(',')
        ),
      ].join('\n');

      return new NextResponse(csvRows, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="sitebot-users-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      total: users.length,
      users,
    });
  } catch (error: any) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}