import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import {
  Chatbot,
  CrawledPage,
  DocumentChunk,
  BotForm,
  FormSubmission,
  AdminUser,
  UserProfile,
  CtaSubmission,
  Conversation,
  UsageRecord,
} from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { isAdminEmail, getSuperAdminEmails } from '@/lib/auth/adminAuth';
import { isQdrantConfigured } from '@/lib/vector/qdrant';
import { getSystemSettings } from '@/lib/systemSettings';

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
    let totalUsers = 0;
    let proUsers = 0;
    let freeUsers = 0;
    let onboardedUsers = 0;
    let totalCtas = 0;
    let totalConversations = 0;
    let activeConversations = 0;
    let agentHandoffs = 0;
    let totalTokensUsed = 0;
    let totalChats = 0;
    let byokBots = 0;

    const occupations: Record<string, number> = {
      Developer: 0,
      Student: 0,
      'Agency Owner': 0,
      'Business Owner': 0,
      Marketer: 0,
      Freelancer: 0,
      Other: 0,
    };

    const providers: Record<string, number> = {
      openai: 0,
      gemini: 0,
      nvidia: 0,
      openrouter: 0,
    };

    if (isUsingMemoryDb()) {
      const bots = MemoryDb.findChatbots();
      totalBots = bots.length;
      activeBots = bots.filter((b) => b.status !== 'disabled').length;
      disabledBots = bots.filter((b) => b.status === 'disabled').length;

      for (const b of bots) {
        const prov = (b.chatProvider || 'openai').toLowerCase();
        providers[prov] = (providers[prov] || 0) + 1;
        if (b.apiKeys && (b.apiKeys.gemini || b.apiKeys.openai || b.apiKeys.nvidia || b.apiKeys.openrouter)) {
          byokBots++;
        }
      }

      totalPages = MemoryDb.countCrawledPages();
      totalChunks = MemoryDb.countDocumentChunks();
      totalForms = MemoryDb.findBotForms().length;
      totalSubmissions = MemoryDb.findFormSubmissions().length;
      totalCtas = MemoryDb.findCtaSubmissions().length;
      totalDbAdmins = MemoryDb.findAllAdmins().length;

      const userProfiles = MemoryDb.findAllUserProfiles();
      totalUsers = userProfiles.length;
      proUsers = userProfiles.filter((u) => u.plan === 'pro').length;
      freeUsers = userProfiles.filter((u) => u.plan !== 'pro').length;
      onboardedUsers = userProfiles.filter((u) => u.profileCompleted !== false).length;

      for (const u of userProfiles) {
        const occ = u.occupation || 'Other';
        occupations[occ] = (occupations[occ] || 0) + 1;
        totalTokensUsed += (u.usage?.inputTokens || 0) + (u.usage?.outputTokens || 0);
        totalChats += u.usage?.chats || 0;
      }

      const convs = MemoryDb.findAllConversations(1000);
      totalConversations = convs.length;
      activeConversations = convs.filter((c) => c.status !== 'resolved').length;
      agentHandoffs = convs.filter((c) => c.status === 'waiting_agent' || c.status === 'agent_active').length;
    } else {
      const [
        bTotal,
        bActive,
        bDisabled,
        allBots,
        pTotal,
        cTotal,
        fTotal,
        sTotal,
        ctaTotal,
        aTotal,
        uProfiles,
        convCount,
        convActiveCount,
        convHandoffCount,
      ] = await Promise.all([
        Chatbot.countDocuments(),
        Chatbot.countDocuments({ status: { $ne: 'disabled' } }),
        Chatbot.countDocuments({ status: 'disabled' }),
        Chatbot.find().select('chatProvider apiKeys').lean(),
        CrawledPage.countDocuments(),
        DocumentChunk.countDocuments(),
        BotForm.countDocuments(),
        FormSubmission.countDocuments(),
        CtaSubmission.countDocuments(),
        AdminUser.countDocuments(),
        UserProfile.find().lean(),
        Conversation.countDocuments(),
        Conversation.countDocuments({ status: { $ne: 'resolved' } }),
        Conversation.countDocuments({ status: { $in: ['waiting_agent', 'agent_active'] } }),
      ]);

      totalBots = bTotal;
      activeBots = bActive;
      disabledBots = bDisabled;
      totalPages = pTotal;
      totalChunks = cTotal;
      totalForms = fTotal;
      totalSubmissions = sTotal;
      totalCtas = ctaTotal;
      totalDbAdmins = aTotal;
      totalConversations = convCount;
      activeConversations = convActiveCount;
      agentHandoffs = convHandoffCount;

      for (const b of allBots as any[]) {
        const prov = (b.chatProvider || 'openai').toLowerCase();
        providers[prov] = (providers[prov] || 0) + 1;
        if (b.apiKeys && (b.apiKeys.gemini || b.apiKeys.openai || b.apiKeys.nvidia || b.apiKeys.openrouter)) {
          byokBots++;
        }
      }

      totalUsers = uProfiles.length;
      for (const u of uProfiles as any[]) {
        if (u.plan === 'pro') proUsers++;
        else freeUsers++;
        if (u.profileCompleted !== false) onboardedUsers++;

        const occ = u.occupation || 'Other';
        occupations[occ] = (occupations[occ] || 0) + 1;
        totalTokensUsed += (u.usage?.inputTokens || 0) + (u.usage?.outputTokens || 0);
        totalChats += u.usage?.chats || 0;
      }
    }

    const superAdminEmails = getSuperAdminEmails();
    const totalAdmins = superAdminEmails.length + totalDbAdmins;

    const settings = await getSystemSettings();
    const proPrice = settings.proPlan?.monthlyPrice || 9;
    const estimatedMRR = proUsers * proPrice;
    const estimatedARR = estimatedMRR * 12;

    const systemHealth = {
      database: isUsingMemoryDb() ? 'In-Memory Fallback' : 'MongoDB Atlas Connected',
      isMemoryDb: isUsingMemoryDb(),
      vectorDatabase: isQdrantConfigured() ? 'Qdrant Cloud / Online' : 'Local / In-Memory',
      chatProvider: settings.defaultChatProvider,
      chatModel: settings.defaultChatModel,
      embedProvider: settings.defaultEmbedProvider,
      embedModel: settings.defaultEmbedModel,
      superAdminConfigured: superAdminEmails.length > 0,
      superAdminEmail: superAdminEmails[0] || 'admin@sitebotstudio.com',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      hasOpenaiKey: Boolean(process.env.OPENAI_API_KEY),
      hasNvidiaKey: Boolean(process.env.NVIDIA_API_KEY),
      hasOpenrouterKey: Boolean(process.env.OPENROUTER_API_KEY),
      hasPaypalConfig: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    };

    return NextResponse.json({
      success: true,
      stats: {
        totalBots,
        activeBots,
        disabledBots,
        byokBots,
        systemBots: totalBots - byokBots,
        totalPages,
        totalChunks,
        totalForms,
        totalSubmissions,
        totalCtas,
        totalLeadsAll: totalSubmissions + totalCtas,
        totalAdmins,
        totalUsers,
        proUsers,
        freeUsers,
        onboardedUsers,
        occupations,
        providers,
        totalConversations,
        activeConversations,
        agentHandoffs,
        totalTokensUsed,
        totalChats,
        financials: {
          estimatedMRR,
          estimatedARR,
          activeSubscribers: proUsers,
          proPrice,
        },
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
