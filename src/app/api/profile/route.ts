import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateProfile, updateProfile, countUserBots, quotaPercent } from '@/lib/usage';
import { getPlanInfo } from '@/lib/plans';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email =
      req.headers.get('x-user-email') || searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    const profile = await getOrCreateProfile({
      email,
      userId: req.headers.get('x-user-id') || undefined,
      name: req.headers.get('x-user-name') || undefined,
      avatar: req.headers.get('x-user-avatar') || undefined,
    });
    if (!profile) {
      return NextResponse.json(
        { error: 'Profile could not be loaded' },
        { status: 500 }
      );
    }

    const botCount = await countUserBots(profile.email);
    const plan = getPlanInfo(profile.plan);
    const usage = profile.usage || {};
    const percent = quotaPercent(profile);

    return NextResponse.json({
      success: true,
      profile: {
        email: profile.email,
        userId: profile.userId,
        name: profile.name,
        avatar: profile.avatar,
        companyName: profile.companyName,
        phone: profile.phone,
        address: profile.address || {},
        payment: profile.payment || {},
        plan: profile.plan || 'free',
        planExpiresAt: profile.planExpiresAt,
        botLimit: Number(profile.botLimit) || plan.botLimit,
        tokenQuota: Number(profile.tokenQuota) || plan.tokenQuota,
        chatQuota: Number(profile.chatQuota) || plan.chatQuota,
        notifications: profile.notifications || {},
        usage: {
          inputTokens: usage.inputTokens || 0,
          outputTokens: usage.outputTokens || 0,
          totalTokens: (usage.inputTokens || 0) + (usage.outputTokens || 0),
          chats: usage.chats || 0,
          leads: usage.leads || 0,
        },
        quotaPercent: percent,
        botCount,
      },
      plan: {
        id: plan.id,
        label: plan.label,
        monthlyPrice: plan.monthlyPrice,
        features: plan.features,
      },
    });
  } catch (error: any) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email =
      req.headers.get('x-user-email') || searchParams.get('email');
    if (!email) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const clean: any = {};

    if (body.name !== undefined) clean.name = String(body.name).trim();
    if (body.avatar !== undefined) clean.avatar = String(body.avatar).trim();
    if (body.companyName !== undefined) clean.companyName = String(body.companyName).trim();
    if (body.phone !== undefined) clean.phone = String(body.phone).trim();
    if (body.address !== undefined && typeof body.address === 'object') {
      clean.address = {
        street: String(body.address.street || '').trim(),
        city: String(body.address.city || '').trim(),
        state: String(body.address.state || '').trim(),
        country: String(body.address.country || '').trim(),
        zip: String(body.address.zip || '').trim(),
      };
    }
    if (body.payment !== undefined && typeof body.payment === 'object') {
      clean.payment = {
        paypalEmail: String(body.payment.paypalEmail || '').trim(),
        payerId: String(body.payment.payerId || '').trim(),
      };
    }
    if (body.notifications !== undefined && typeof body.notifications === 'object') {
      const n = body.notifications;
      clean.notifications = {
        email: {
          enabled: Boolean(n.email?.enabled),
          to: String(n.email?.to || '').trim(),
        },
        whatsapp: {
          enabled: Boolean(n.whatsapp?.enabled),
          number: String(n.whatsapp?.number || '').trim(),
        },
        telegram: {
          enabled: Boolean(n.telegram?.enabled),
          chatId: String(n.telegram?.chatId || '').trim(),
          botToken: String(n.telegram?.botToken || '').trim(),
        },
      };
    }

    const profile = await updateProfile(email, clean);
    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update profile' },
      { status: 500 }
    );
  }
}