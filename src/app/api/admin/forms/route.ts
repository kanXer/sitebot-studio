import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { BotForm, Chatbot } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { isAdminEmail } from '@/lib/auth/adminAuth';

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

    let forms: any[] = [];
    if (isUsingMemoryDb()) {
      const allForms = MemoryDb.findBotForms(botId || undefined);
      forms = allForms.map((f) => {
        const bot = MemoryDb.findChatbotById(f.botId);
        return {
          id: f._id,
          botId: f.botId,
          botName: bot?.name || 'Unknown Bot',
          siteUrl: bot?.siteUrl || '',
          formType: f.formType,
          title: f.title,
          targetUrl: f.targetUrl,
          fieldsSchema: f.fieldsSchema,
          submitEndpoint: f.submitEndpoint || '',
          submitMethod: f.submitMethod || 'POST',
          isActive: f.isActive,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        };
      });
    } else {
      const query: any = {};
      if (botId) query.botId = botId;

      const allForms = await BotForm.find(query).sort({ createdAt: -1 }).lean();
      const botIds = Array.from(new Set(allForms.map((f) => f.botId)));
      const bots = await Chatbot.find({ _id: { $in: botIds } })
        .select('name siteUrl')
        .lean();
      const botMap = new Map(bots.map((b) => [b._id.toString(), b]));

      forms = allForms.map((f) => {
        const bot = botMap.get(f.botId.toString());
        return {
          id: f._id.toString(),
          botId: f.botId.toString(),
          botName: bot?.name || 'Unknown Bot',
          siteUrl: bot?.siteUrl || '',
          formType: f.formType,
          title: f.title,
          targetUrl: f.targetUrl,
          fieldsSchema: f.fieldsSchema,
          submitEndpoint: f.submitEndpoint || '',
          submitMethod: f.submitMethod || 'POST',
          isActive: f.isActive,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        };
      });
    }

    return NextResponse.json({
      success: true,
      forms,
    });
  } catch (error: any) {
    console.error('Error fetching admin forms:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch forms' },
      { status: 500 }
    );
  }
}
