import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Chatbot, UserProfile, FormSubmission, CtaSubmission, Conversation, AdminUser } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { isAdminEmail } from '@/lib/auth/adminAuth';

export interface ActivityEvent {
  id: string;
  category: 'bot' | 'user' | 'lead' | 'billing' | 'admin' | 'chat' | 'system';
  type: string;
  title: string;
  description: string;
  actor: string;
  target?: string;
  targetUrl?: string;
  timestamp: string;
  badge: 'info' | 'success' | 'warning' | 'primary' | 'danger';
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminEmail = req.headers.get('x-user-email') || searchParams.get('email');
    const isAuthorized = await isAdminEmail(adminEmail);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    const category = searchParams.get('category') || 'all';
    const search = (searchParams.get('search') || '').toLowerCase().trim();
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 100)));

    await connectToDatabase();

    const events: ActivityEvent[] = [];

    if (isUsingMemoryDb()) {
      // 1. Chatbots
      const bots = MemoryDb.findChatbots();
      for (const b of bots) {
        events.push({
          id: `bot_create_${b._id}`,
          category: 'bot',
          type: 'bot_created',
          title: `Chatbot Deployed: ${b.name}`,
          description: `Trained on ${b.siteUrl} with ${b.chatProvider} (${b.chatModel}). Status: ${b.status || 'active'}.`,
          actor: b.ownerEmail || 'admin',
          target: b.name,
          targetUrl: `/bot/${b._id}`,
          timestamp: new Date(b.createdAt).toISOString(),
          badge: 'primary',
        });
      }

      // 2. Users
      const users = MemoryDb.findAllUserProfiles();
      for (const u of users) {
        events.push({
          id: `user_reg_${u.email}`,
          category: 'user',
          type: 'user_registered',
          title: `New User Joined: ${u.name || u.email.split('@')[0]}`,
          description: `Plan: ${u.plan?.toUpperCase() || 'FREE'} • Company: ${u.companyName || 'Not specified'} • Quota: ${u.tokenQuota?.toLocaleString() || 25000} tokens.`,
          actor: u.email,
          target: u.companyName || u.name,
          timestamp: new Date(u.createdAt).toISOString(),
          badge: u.plan === 'pro' ? 'success' : 'info',
        });

        if (u.plan === 'pro') {
          events.push({
            id: `plan_pro_${u.email}`,
            category: 'billing',
            type: 'pro_upgrade',
            title: `Pro Subscription Active: ${u.email}`,
            description: `Unlocked 10 chatbots, 2.5M tokens/mo, and omnichannel leads.`,
            actor: u.email,
            target: '$9/mo Pro Plan',
            timestamp: new Date(u.updatedAt || u.createdAt).toISOString(),
            badge: 'success',
          });
        }
      }

      // 3. Form Submissions
      const forms = MemoryDb.findFormSubmissions();
      for (const f of forms) {
        const contactVal = f.formData?.email || f.formData?.phone || f.formData?.name || 'Visitor';
        events.push({
          id: `sub_${f._id}`,
          category: 'lead',
          type: 'form_lead',
          title: `Lead Captured: ${contactVal}`,
          description: `Captured from form on ${f.pageUrl || 'website'} via chatbot.`,
          actor: String(contactVal),
          target: f.pageUrl,
          timestamp: new Date(f.createdAt).toISOString(),
          badge: 'success',
        });
      }

      // 4. CTA Submissions
      const ctas = MemoryDb.findCtaSubmissions();
      for (const c of ctas) {
        events.push({
          id: `cta_${c._id}`,
          category: 'lead',
          type: 'cta_lead',
          title: `CTA Action: ${c.name || c.email}`,
          description: `Campaign: "${c.campaign || 'Default'}" • Phone: ${c.phone || 'N/A'}.`,
          actor: c.email || c.name || 'Visitor',
          target: c.campaign,
          timestamp: new Date(c.createdAt).toISOString(),
          badge: 'success',
        });
      }

      // 5. Conversations
      const convs = MemoryDb.findAllConversations(50);
      for (const c of convs) {
        const visitorName = c.visitor?.name || c.visitor?.email || 'Website Visitor';
        events.push({
          id: `conv_${c._id}`,
          category: 'chat',
          type: 'conversation',
          title: `Live Session with ${visitorName}`,
          description: `${c.messages?.length || 0} messages exchanged. Status: ${c.status}.`,
          actor: visitorName,
          target: c.botId,
          timestamp: new Date(c.lastMessageAt || c.createdAt).toISOString(),
          badge: c.status === 'waiting_agent' ? 'warning' : 'info',
        });
      }
    } else {
      // MongoDB queries in parallel
      const [bots, users, forms, ctas, convs, admins] = await Promise.all([
        Chatbot.find().sort({ createdAt: -1 }).limit(100).lean(),
        UserProfile.find().sort({ createdAt: -1 }).limit(100).lean(),
        FormSubmission.find().sort({ createdAt: -1 }).limit(100).lean(),
        CtaSubmission.find().sort({ createdAt: -1 }).limit(100).lean(),
        Conversation.find().sort({ lastMessageAt: -1 }).limit(100).lean(),
        AdminUser.find().sort({ createdAt: -1 }).limit(20).lean(),
      ]);

      // Chatbots
      for (const b of bots) {
        events.push({
          id: `bot_create_${b._id}`,
          category: 'bot',
          type: 'bot_created',
          title: `Chatbot Deployed: ${b.name}`,
          description: `Trained on ${b.siteUrl} with ${b.chatProvider} (${b.chatModel}). Status: ${b.status || 'active'}.`,
          actor: b.ownerEmail || 'admin',
          target: b.name,
          targetUrl: `/bot/${b._id}`,
          timestamp: new Date(b.createdAt).toISOString(),
          badge: 'primary',
        });
      }

      // Users
      for (const u of users) {
        events.push({
          id: `user_reg_${u.email}`,
          category: 'user',
          type: 'user_registered',
          title: `New User Joined: ${u.name || u.email.split('@')[0]}`,
          description: `Plan: ${u.plan?.toUpperCase() || 'FREE'} • Company: ${u.companyName || 'Not specified'} • Quota: ${u.tokenQuota?.toLocaleString() || 25000} tokens.`,
          actor: u.email,
          target: u.companyName || u.name,
          timestamp: new Date(u.createdAt).toISOString(),
          badge: u.plan === 'pro' ? 'success' : 'info',
        });

        if (u.plan === 'pro') {
          events.push({
            id: `plan_pro_${u.email}`,
            category: 'billing',
            type: 'pro_upgrade',
            title: `Pro Subscription Active: ${u.email}`,
            description: `Unlocked 10 chatbots, 2.5M tokens/mo, and omnichannel leads.`,
            actor: u.email,
            target: '$9/mo Pro Plan',
            timestamp: new Date(u.updatedAt || u.createdAt).toISOString(),
            badge: 'success',
          });
        }
      }

      // Form Submissions
      for (const f of forms) {
        const contactVal = f.formData?.email || f.formData?.phone || f.formData?.name || 'Visitor';
        events.push({
          id: `sub_${f._id}`,
          category: 'lead',
          type: 'form_lead',
          title: `Lead Captured: ${contactVal}`,
          description: `Captured from form on ${f.pageUrl || 'website'} via chatbot.`,
          actor: String(contactVal),
          target: f.pageUrl,
          timestamp: new Date(f.createdAt).toISOString(),
          badge: 'success',
        });
      }

      // CTA Submissions
      for (const c of ctas) {
        events.push({
          id: `cta_${c._id}`,
          category: 'lead',
          type: 'cta_lead',
          title: `CTA Action: ${c.name || c.email}`,
          description: `Campaign: "${c.campaign || 'Default'}" • Phone: ${c.phone || 'N/A'}.`,
          actor: c.email || c.name || 'Visitor',
          target: c.campaign,
          timestamp: new Date(c.createdAt).toISOString(),
          badge: 'success',
        });
      }

      // Conversations
      for (const c of convs) {
        const visitorName = c.visitor?.name || c.visitor?.email || 'Website Visitor';
        events.push({
          id: `conv_${c._id}`,
          category: 'chat',
          type: 'conversation',
          title: `Live Session with ${visitorName}`,
          description: `${c.messages?.length || 0} messages exchanged. Status: ${c.status}.`,
          actor: visitorName,
          target: String(c.botId),
          timestamp: new Date(c.lastMessageAt || c.createdAt).toISOString(),
          badge: c.status === 'waiting_agent' ? 'warning' : 'info',
        });
      }

      // Admins
      for (const a of admins) {
        events.push({
          id: `adm_${a._id}`,
          category: 'admin',
          type: 'admin_added',
          title: `Staff Access Granted: ${a.email}`,
          description: `Role: ${a.role?.toUpperCase() || 'ADMIN'} • Assigned by: ${a.assignedBy || 'Super Admin'}.`,
          actor: a.assignedBy || 'Super Admin',
          target: a.email,
          timestamp: new Date(a.createdAt).toISOString(),
          badge: 'warning',
        });
      }
    }

    // Sort by timestamp descending
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    let filtered = events;
    if (category !== 'all') {
      filtered = filtered.filter((e) => e.category === category);
    }

    if (search) {
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(search) ||
          e.description.toLowerCase().includes(search) ||
          e.actor.toLowerCase().includes(search) ||
          (e.target && e.target.toLowerCase().includes(search))
      );
    }

    return NextResponse.json({
      success: true,
      total: filtered.length,
      events: filtered.slice(0, limit),
    });
  } catch (error) {
    console.error('Error fetching admin activity feed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch activity feed' },
      { status: 500 }
    );
  }
}

/**
 * Clear the audit stream.
 *
 * The activity feed is not a stored log: it is projected from live collections
 * (bots, users, submissions, CTAs, conversations, staff). So there is no
 * per-row audit record to delete -- deleting a row here means deleting the
 * record it was derived from. This endpoint therefore clears those sources and
 * reports exactly what was removed, so the action is not a silent black hole.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminEmail = req.headers.get('x-user-email') || searchParams.get('email');
    const isAuthorized = await isAdminEmail(adminEmail);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 403 });
    }

    // Guard against a stray click wiping the audit trail.
    if (searchParams.get('confirm') !== 'CLEAR_AUDIT_SOURCE_DATA') {
      return NextResponse.json(
        {
          error:
            'This clears live data because the audit stream is derived from it. ' +
            'Resend with confirm=CLEAR_AUDIT_SOURCE_DATA to proceed.',
        },
        { status: 400 }
      );
    }

    await connectToDatabase();

    if (isUsingMemoryDb()) {
      const counts = MemoryDb.clearAllActivitySourceData();
      return NextResponse.json({
        success: true,
        cleared: counts,
        message: 'Cleared audit source records (memory mode).',
      });
    }

    const [conversations, ctaSubmissions, formSubmissions, userProfiles] = await Promise.all([
      Conversation.deleteMany({}),
      CtaSubmission.deleteMany({}),
      FormSubmission.deleteMany({}),
      UserProfile.deleteMany({}),
    ]);

    const cleared = {
      conversations: conversations.deletedCount || 0,
      ctaSubmissions: ctaSubmissions.deletedCount || 0,
      formSubmissions: formSubmissions.deletedCount || 0,
      userProfiles: userProfiles.deletedCount || 0,
    };

    return NextResponse.json({
      success: true,
      cleared,
      message:
        'Cleared conversations, CTA leads, form submissions and user profiles. ' +
        'Chatbots, staff and settings were left untouched.',
    });
  } catch (error) {
    console.error('Error clearing audit source data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear audit stream' },
      { status: 500 }
    );
  }
}
