import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { FormSubmission, BotForm, Chatbot, CtaSubmission } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email =
      req.headers.get('x-user-email') ||
      searchParams.get('email') ||
      req.headers.get('x-user-id') ||
      searchParams.get('userId');

    if (!email) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    await connectToDatabase();
    const cleanEmail = email.toLowerCase().trim();

    let chatLeads: any[] = [];

    if (isUsingMemoryDb()) {
      const bots = MemoryDb.findChatbots().filter(
        (b) => b.ownerEmail?.toLowerCase() === cleanEmail || b.ownerId === email
      );
      const botIds = new Set(bots.map((b) => b._id));
      const submissions = MemoryDb.findFormSubmissions();
      for (const s of submissions) {
        const form = MemoryDb.findBotFormById(s.formId);
        const bot = form ? MemoryDb.findChatbotById(form.botId) : null;
        if (bot && botIds.has(bot._id)) {
          chatLeads.push({
            id: s._id,
            kind: 'chat',
            source: 'chat',
            botId: bot._id,
            botName: bot.name || '',
            siteUrl: bot.siteUrl || '',
            data: s.data || {},
            status: s.status,
            createdAt: s.createdAt,
          });
        }
      }
    } else {
      const bots = await Chatbot.find({
        $or: [{ ownerEmail: cleanEmail }, { ownerId: email }],
      })
        .select('_id name siteUrl')
        .lean();
      const botMap = new Map(bots.map((b) => [b._id.toString(), b]));
      const botIds = bots.map((b) => b._id);

      const forms = await BotForm.find({ botId: { $in: botIds } })
        .select('_id botId formType targetUrl')
        .lean();
      const formMap = new Map<string, any>(forms.map((f) => [f._id.toString(), f]));
      const formIds = forms.map((f) => f._id.toString());

      const subs = await FormSubmission.find({ formId: { $in: formIds } })
        .sort({ createdAt: -1 })
        .limit(300)
        .lean();
      chatLeads = subs.map((s) => {
        const form = formMap.get(s.formId.toString());
        const bot = form ? botMap.get(form.botId.toString()) : undefined;
        return {
          id: s._id.toString(),
          kind: 'chat',
          source: 'chat',
          botId: bot?._id?.toString() || '',
          botName: bot?.name || '',
          siteUrl: bot?.siteUrl || '',
          data: s.data || {},
          status: s.status,
          createdAt: s.createdAt,
        };
      });
    }

    let ctaLeads: any[] = [];
    if (isUsingMemoryDb()) {
      ctaLeads = MemoryDb.findCtaSubmissions(cleanEmail).map((c) => ({
        id: c._id,
        kind: 'cta',
        source: c.source || 'website_cta',
        botId: c.botId,
        campaign: c.campaign,
        page: c.page,
        name: c.name,
        email: c.email,
        phone: c.phone,
        message: c.message,
        createdAt: c.createdAt,
      }));
    } else {
      const ctas = await CtaSubmission.find({ ownerEmail: cleanEmail })
        .sort({ createdAt: -1 })
        .limit(300)
        .lean();
      ctaLeads = ctas.map((c) => ({
        id: c._id.toString(),
        kind: 'cta',
        source: c.source || 'website_cta',
        botId: c.botId,
        campaign: c.campaign,
        page: c.page,
        name: c.name,
        email: c.email,
        phone: c.phone,
        message: c.message,
        createdAt: c.createdAt,
      }));
    }

    const leads = [...ctaLeads, ...chatLeads].sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ success: true, leads, total: leads.length });
  } catch (error: any) {
    console.error('Error fetching leads:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}