import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Chatbot, CrawledPage, DocumentChunk, BotForm, FormSubmission, AdminUser } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { isAdminEmail, getSuperAdminEmails } from '@/lib/auth/adminAuth';
import { isQdrantConfigured } from '@/lib/vector/qdrant';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userEmail = req.headers.get('x-user-email') || searchParams.get('email');

    // Admin authorization check
    const isAuthorized = await isAdminEmail(userEmail);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required.' },
        { status: 403 }
      );
    }

    await connectToDatabase();

    let totalBots = 0;
    let activeBots = 0;
    let disabledBots = 0;
    let totalPages = 0;
    let totalChunks = 0;
    let totalForms = 0;
    let totalSubmissions = 0;
    let totalDbAdmins = 0;

    if (isUsingMemoryDb()) {
      const bots = MemoryDb.findChatbots();
      totalBots = bots.length;
      activeBots = bots.filter((b) => b.status !== 'disabled').length;
      disabledBots = bots.filter((b) => b.status === 'disabled').length;

      totalPages = MemoryDb.countCrawledPages();
      totalChunks = MemoryDb.countDocumentChunks();
      totalForms = MemoryDb.findBotForms().length;
      totalSubmissions = MemoryDb.findFormSubmissions().length;
      totalDbAdmins = MemoryDb.findAllAdmins().length;
    } else {
      [
        totalBots,
        activeBots,
        disabledBots,
        totalPages,
        totalChunks,
        totalForms,
        totalSubmissions,
        totalDbAdmins,
      ] = await Promise.all([
        Chatbot.countDocuments(),
        Chatbot.countDocuments({ status: { $ne: 'disabled' } }),
        Chatbot.countDocuments({ status: 'disabled' }),
        CrawledPage.countDocuments(),
        DocumentChunk.countDocuments(),
        BotForm.countDocuments(),
        FormSubmission.countDocuments(),
        AdminUser.countDocuments(),
      ]);
    }

    const superAdminEmails = getSuperAdminEmails();
    const totalAdmins = superAdminEmails.length + totalDbAdmins;

    const systemHealth = {
      database: isUsingMemoryDb() ? 'In-Memory Fallback' : 'MongoDB Atlas Connected',
      isMemoryDb: isUsingMemoryDb(),
      vectorDatabase: isQdrantConfigured() ? 'Qdrant Cloud / Online' : 'Local / Not Configured',
      chatProvider: process.env.DEFAULT_CHAT_PROVIDER || 'nvidia',
      chatModel: process.env.DEFAULT_CHAT_MODEL || 'meta/muse-glimmer-30b',
      embedProvider: process.env.DEFAULT_EMBED_PROVIDER || 'nvidia',
      superAdminConfigured: superAdminEmails.length > 0,
      superAdminEmail: superAdminEmails[0] || 'admin@sitebotstudio.com',
    };

    return NextResponse.json({
      success: true,
      stats: {
        totalBots,
        activeBots,
        disabledBots,
        totalPages,
        totalChunks,
        totalForms,
        totalSubmissions,
        totalAdmins,
      },
      systemHealth,
    });
  } catch (error) {
    console.error('Error fetching admin statistics:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch admin stats' },
      { status: 500 }
    );
  }
}
