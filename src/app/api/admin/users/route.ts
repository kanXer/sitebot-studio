import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { UserProfile, UsageRecord } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { isAdminEmail } from '@/lib/auth/adminAuth';

interface AdminUsage {
  inputTokens?: number;
  outputTokens?: number;
  chats?: number;
  leads?: number;
}

interface AdminUserProfile {
  email: string;
  name?: string;
  companyName?: string;
  phone?: string;
  plan?: string;
  planExpiresAt?: Date;
  botLimit?: number;
  tokenQuota?: number;
  chatQuota?: number;
  usage: AdminUsage;
  botCount?: number;
  createdAt: Date;
}

interface MonthlyUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  chats: number;
  leads: number;
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

    let profiles: AdminUserProfile[] = [];
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
    const aggregated = new Map<string, MonthlyUsage>();
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
      const usg: MonthlyUsage = aggregated.get(u.email) || {
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
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const adminEmail = req.headers.get('x-user-email');
    const isAuthorized = await isAdminEmail(adminEmail);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const body = await req.json();
    const targetEmail = (body.email || '').toLowerCase().trim();
    if (!targetEmail) {
      return NextResponse.json({ error: 'Target email is required' }, { status: 400 });
    }

    await connectToDatabase();

    const updateData: any = {};
    if (body.plan) {
      updateData.plan = body.plan;
      if (body.plan === 'pro') {
        updateData.botLimit = 10;
        updateData.tokenQuota = 2500000;
        updateData.chatQuota = 50000;
        updateData.planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      } else {
        updateData.botLimit = 1;
        updateData.tokenQuota = 25000;
        updateData.chatQuota = 50;
      }
    }
    if (typeof body.botLimit === 'number') updateData.botLimit = body.botLimit;
    if (typeof body.tokenQuota === 'number') updateData.tokenQuota = body.tokenQuota;
    if (typeof body.chatQuota === 'number') updateData.chatQuota = body.chatQuota;
    if (body.resetUsage) {
      updateData.usage = { inputTokens: 0, outputTokens: 0, chats: 0, leads: 0 };
    }

    if (isUsingMemoryDb()) {
      MemoryDb.updateUserProfile(targetEmail, updateData);
    } else {
      await UserProfile.updateOne({ email: targetEmail }, { $set: updateData }, { upsert: true });
    }

    return NextResponse.json({
      success: true,
      message: `User ${targetEmail} updated successfully.`,
      updated: updateData,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminEmail = req.headers.get('x-user-email') || searchParams.get('adminEmail');
    const isAuthorized = await isAdminEmail(adminEmail);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const targetEmail = (searchParams.get('email') || '').toLowerCase().trim();
    if (!targetEmail) {
      return NextResponse.json({ error: 'Target email is required' }, { status: 400 });
    }

    await connectToDatabase();

    if (!isUsingMemoryDb()) {
      await UserProfile.deleteOne({ email: targetEmail });
    }

    return NextResponse.json({
      success: true,
      message: `User ${targetEmail} removed from platform.`,
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete user' },
      { status: 500 }
    );
  }
}