import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * In-Memory Database Fallback for Rivafy Studio
 * Provides seamless local operation when MongoDB Atlas credentials are not yet configured.
 */

export interface MemoryChatbot {
  _id: string;
  id: string;
  name: string;
  siteUrl: string;
  systemPrompt: string;
  primaryColor: string;
  position: 'bottom-right' | 'bottom-left';
  launcherStyle?: 'standard' | 'minimal' | 'pill' | 'chat';
  chatProvider: string;
  chatModel: string;
  embedProvider: string;
  embedModel: string;
  apiKeys: {
    gemini?: string;
    openrouter?: string;
    openai?: string;
    nvidia?: string;
  };
  greeting: string;
  roleTitle?: string;
  suggestedQuestions: string[];
  phone?: string;
  whatsapp?: string;
  email?: string;
  auditUrl?: string;
  pricingUrl?: string;
  customLinks?: Array<{ label: string; url: string }>;
  slug?: string;
  allowedOrigins?: string[];
  rateLimit?: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
  };
  customVectorDb?: {
    enabled: boolean;
    provider: string;
    url: string;
    apiKey: string;
    collectionName?: string;
  };
  guardrails?: {
    enabled: boolean;
    strictRAG: boolean;
    promptInjectionDefense: boolean;
    domainScopeEnforcement: boolean;
    piiMasking: boolean;
    similarityThreshold: number;
    fallbackMessage?: string;
  };
  handoff?: {
    enabled: boolean;
    autoDetect: boolean;
    notifyEmail?: string;
    agentName?: string;
    offlineMessage?: string;
  };
  metaPrompt?: string;
  aiLimit?: {
    enabled: boolean;
    maxTokens: number;
  };
  usage?: {
    inputTokens: number;
    outputTokens: number;
    chats: number;
    leads: number;
  };
  notifications?: {
    email: { enabled: boolean; to: string };
    whatsapp: { enabled: boolean; number: string };
    telegram: { enabled: boolean; chatId: string; botToken: string };
  };
  ownerId?: string;
  ownerEmail?: string;
  ownerName?: string;
  planTier?: 'free' | 'individual' | 'enterprise';
  status?: 'active' | 'disabled';
  botConfig?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryCrawledPage {
  _id: string;
  chatbotId: string;
  url: string;
  title: string;
  status: 'queued' | 'indexing' | 'indexed' | 'failed';
  chunkCount: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryDocumentChunk {
  _id: string;
  chatbotId: string;
  pageUrl: string;
  content: string;
  embedding: number[];
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryBotForm {
  _id: string;
  botId: string;
  formType: string;
  title: string;
  targetUrl: string;
  fieldsSchema: any[];
  submitEndpoint?: string;
  submitMethod?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryFormSubmission {
  _id: string;
  formId: string;
  sessionId: string;
  data: Record<string, unknown>;
  status: 'in_progress' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryAdminUser {
  _id: string;
  id: string;
  email: string;
  role: 'super_admin' | 'admin';
  addedBy: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryConversation {
  _id: string;
  botId: string;
  sessionId: string;
  visitor: {
    name?: string;
    email?: string;
    phone?: string;
    ip?: string;
  };
  status: 'bot' | 'waiting_agent' | 'agent_active' | 'resolved';
  handoffReason?: string;
  assignedAgent?: {
    id?: string;
    name?: string;
    email?: string;
  };
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'agent' | 'system';
    senderName?: string;
    content: string;
    timestamp: Date;
  }>;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryUserProfile {
  _id: string;
  userId: string;
  email: string;
  name: string;
  avatar: string;
  companyName: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    zip: string;
  };
  payment: {
    paypalEmail: string;
    payerId: string;
  };
  occupation?: string;
  useCase?: string;
  projectName?: string;
  profileCompleted?: boolean;
  plan: 'free' | 'pro';
  planExpiresAt?: Date;
  botLimit: number;
  tokenQuota: number;
  chatQuota: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    chats: number;
    leads: number;
  };
  notifications: {
    email: { enabled: boolean; to: string };
    whatsapp: { enabled: boolean; number: string };
    telegram: { enabled: boolean; chatId: string; botToken: string };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryCtaSubmission {
  _id: string;
  botId: string;
  campaign: string;
  page: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  ownerId: string;
  ownerEmail: string;
  source: string;
  forwarded: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryUsageRecord {
  _id: string;
  email: string;
  botId: string;
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  chats: number;
  leads: number;
  createdAt: Date;
  updatedAt: Date;
}

// Global in-memory collections surviving hot reloads
declare global {
   
  var __memoryChatbots: Map<string, MemoryChatbot> | undefined;
   
  var __memoryCrawledPages: Map<string, MemoryCrawledPage> | undefined;
   
  var __memoryDocumentChunks: Map<string, MemoryDocumentChunk> | undefined;
   
  var __memoryBotForms: Map<string, MemoryBotForm> | undefined;
   
  var __memoryFormSubmissions: Map<string, MemoryFormSubmission> | undefined;
   
  var __memoryAdminUsers: Map<string, MemoryAdminUser> | undefined;
   
  var __memoryConversations: Map<string, MemoryConversation> | undefined;
   
  var __memoryUserProfiles: Map<string, MemoryUserProfile> | undefined;
   
  var __memoryCtaSubmissions: Map<string, MemoryCtaSubmission> | undefined;
   
  var __memoryUsageRecords: Map<string, MemoryUsageRecord> | undefined;
}

function generateObjectId(): string {
  return crypto.randomBytes(12).toString('hex');
}

const DB_FILE = path.join(process.cwd(), '.sitebot-db.json');

let saveTimeout: NodeJS.Timeout | null = null;
export function persistMemoryDb(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const bots = Array.from(new Map(Array.from(memoryStore.chatbots.values()).map((b) => [b._id, b])).values());
      const users = Array.from(new Map(Array.from(memoryStore.adminUsers.values()).map((u) => [u._id, u])).values());
      const profiles = Array.from(new Map(Array.from(memoryStore.userProfiles.values()).map((p) => [p.email.toLowerCase(), p])).values());
      const data = {
        chatbots: bots,
        crawledPages: Array.from(memoryStore.crawledPages.values()),
        documentChunks: Array.from(memoryStore.documentChunks.values()),
        botForms: Array.from(memoryStore.botForms.values()),
        formSubmissions: Array.from(memoryStore.formSubmissions.values()),
        adminUsers: users,
        conversations: Array.from(memoryStore.conversations.values()),
        userProfiles: profiles,
        ctaSubmissions: Array.from(memoryStore.ctaSubmissions.values()),
        usageRecords: Array.from(memoryStore.usageRecords.values()),
        systemSettings: (global as any).__memorySystemSettings || null,
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[MemoryDb] Failed to persist data to disk:', err);
    }
  }, 50);
}

function loadFromDisk(): void {
  try {
    if (!fs.existsSync(DB_FILE)) return;
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    if (!content.trim()) return;
    const data = JSON.parse(content);
    if (data.systemSettings) {
      (global as any).__memorySystemSettings = data.systemSettings;
    }
    if (Array.isArray(data.chatbots)) {
      for (const b of data.chatbots) {
        b.createdAt = new Date(b.createdAt);
        b.updatedAt = new Date(b.updatedAt);
        memoryStore.chatbots.set(b._id, b);
        if (b.id) memoryStore.chatbots.set(b.id, b);
      }
    }
    if (Array.isArray(data.crawledPages)) {
      for (const p of data.crawledPages) {
        p.createdAt = new Date(p.createdAt);
        p.updatedAt = new Date(p.updatedAt);
        memoryStore.crawledPages.set(p._id, p);
      }
    }
    if (Array.isArray(data.documentChunks)) {
      for (const c of data.documentChunks) {
        c.createdAt = new Date(c.createdAt);
        c.updatedAt = new Date(c.updatedAt);
        memoryStore.documentChunks.set(c._id, c);
      }
    }
    if (Array.isArray(data.botForms)) {
      for (const f of data.botForms) {
        f.createdAt = new Date(f.createdAt);
        f.updatedAt = new Date(f.updatedAt);
        memoryStore.botForms.set(f._id, f);
      }
    }
    if (Array.isArray(data.formSubmissions)) {
      for (const s of data.formSubmissions) {
        s.createdAt = new Date(s.createdAt);
        s.updatedAt = new Date(s.updatedAt);
        memoryStore.formSubmissions.set(s._id, s);
      }
    }
    if (Array.isArray(data.adminUsers)) {
      for (const u of data.adminUsers) {
        u.createdAt = new Date(u.createdAt);
        u.updatedAt = new Date(u.updatedAt);
        memoryStore.adminUsers.set(u._id, u);
        if (u.email) memoryStore.adminUsers.set(u.email.toLowerCase(), u);
      }
    }
    if (Array.isArray(data.conversations)) {
      for (const c of data.conversations) {
        c.createdAt = new Date(c.createdAt);
        c.updatedAt = new Date(c.updatedAt);
        c.lastMessageAt = new Date(c.lastMessageAt);
        memoryStore.conversations.set(c._id, c);
      }
    }
    if (Array.isArray(data.userProfiles)) {
      for (const p of data.userProfiles) {
        p.createdAt = new Date(p.createdAt);
        p.updatedAt = new Date(p.updatedAt);
        if (p.planExpiresAt) p.planExpiresAt = new Date(p.planExpiresAt);
        memoryStore.userProfiles.set(p.email.toLowerCase(), p);
        if (p.userId) memoryStore.userProfiles.set(p.userId, p);
      }
    }
    if (Array.isArray(data.ctaSubmissions)) {
      for (const s of data.ctaSubmissions) {
        s.createdAt = new Date(s.createdAt);
        s.updatedAt = new Date(s.updatedAt);
        memoryStore.ctaSubmissions.set(s._id, s);
      }
    }
    if (Array.isArray(data.usageRecords)) {
      for (const r of data.usageRecords) {
        r.createdAt = new Date(r.createdAt);
        r.updatedAt = new Date(r.updatedAt);
        memoryStore.usageRecords.set(r._id, r);
      }
    }
  } catch (err) {
    console.warn('[MemoryDb] Error loading from disk fallback:', err);
  }
}

export const memoryStore = {
  chatbots: global.__memoryChatbots || new Map<string, MemoryChatbot>(),
  crawledPages: global.__memoryCrawledPages || new Map<string, MemoryCrawledPage>(),
  documentChunks: global.__memoryDocumentChunks || new Map<string, MemoryDocumentChunk>(),
  botForms: global.__memoryBotForms || new Map<string, MemoryBotForm>(),
  formSubmissions: global.__memoryFormSubmissions || new Map<string, MemoryFormSubmission>(),
  adminUsers: global.__memoryAdminUsers || new Map<string, MemoryAdminUser>(),
  conversations: global.__memoryConversations || new Map<string, MemoryConversation>(),
  userProfiles: global.__memoryUserProfiles || new Map<string, MemoryUserProfile>(),
  ctaSubmissions: global.__memoryCtaSubmissions || new Map<string, MemoryCtaSubmission>(),
  usageRecords: global.__memoryUsageRecords || new Map<string, MemoryUsageRecord>(),
};

global.__memoryChatbots = memoryStore.chatbots;
global.__memoryCrawledPages = memoryStore.crawledPages;
global.__memoryDocumentChunks = memoryStore.documentChunks;
global.__memoryBotForms = memoryStore.botForms;
global.__memoryFormSubmissions = memoryStore.formSubmissions;
global.__memoryAdminUsers = memoryStore.adminUsers;
global.__memoryConversations = memoryStore.conversations;
global.__memoryUserProfiles = memoryStore.userProfiles;
global.__memoryCtaSubmissions = memoryStore.ctaSubmissions;
global.__memoryUsageRecords = memoryStore.usageRecords;

// Load persisted records on startup if map is empty
if (memoryStore.chatbots.size === 0) {
  loadFromDisk();
}

export const MemoryDb = {
  // Chatbots
  createChatbot(data: any): MemoryChatbot {
    const id = generateObjectId();
    const now = new Date();
    const bot: MemoryChatbot = {
      _id: id,
      id,
      name: data.name,
      siteUrl: data.siteUrl,
      systemPrompt:
        data.systemPrompt ||
        'You are an intelligent, helpful, and friendly AI assistant for this website. Answer questions accurately and concisely based strictly on the provided context.',
      primaryColor: data.primaryColor || '#6366f1',
      position: data.position || 'bottom-right',
      launcherStyle: data.launcherStyle || 'standard',
      chatProvider: data.chatProvider || 'nvidia',
      chatModel: data.chatModel || 'meta/muse-glimmer-30b',
      embedProvider: data.embedProvider || 'nvidia',
      embedModel: data.embedModel || 'nvidia/llama-nemotron-embed-vl-1b-v2',
      apiKeys: data.apiKeys || {},
      greeting: data.greeting || 'Hi there! 👋 How can I help you today?',
      suggestedQuestions: data.suggestedQuestions || [
        'What services or products do you offer?',
        'How do I get started?',
        'What are your key features and pricing?',
      ],
      phone: data.phone || '+91 96962 62007',
      whatsapp: data.whatsapp || '919696262007',
      email: data.email || 'hello@nexusdigitalmarketing.shop',
      auditUrl: data.auditUrl || '',
      pricingUrl: data.pricingUrl || '/pricing',
      customLinks: data.customLinks || [],
      slug: data.slug || undefined,
      allowedOrigins: data.allowedOrigins || [],
      rateLimit: data.rateLimit || { enabled: false, maxRequests: 20, windowMs: 60000 },
      customVectorDb: data.customVectorDb,
      guardrails: data.guardrails,
      handoff: data.handoff,
      metaPrompt: data.metaPrompt || '',
      aiLimit: data.aiLimit || { enabled: false, maxTokens: 400 },
      usage: data.usage || { inputTokens: 0, outputTokens: 0, chats: 0, leads: 0 },
      notifications: data.notifications || {
        email: { enabled: false, to: '' },
        whatsapp: { enabled: false, number: '' },
        telegram: { enabled: false, chatId: '', botToken: '' },
      },
      ownerId: data.ownerId || '',
      ownerEmail: data.ownerEmail ? String(data.ownerEmail).toLowerCase().trim() : '',
      ownerName: data.ownerName || '',
      status: data.status || 'active',
      planTier: data.planTier || 'free',
      botConfig: data.botConfig || null,
      createdAt: now,
      updatedAt: now,
    };
    memoryStore.chatbots.set(id, bot);
    memoryStore.chatbots.set(bot._id, bot);
    persistMemoryDb();
    return bot;
  },

  findChatbots(ids?: string[]): MemoryChatbot[] {
    const unique = Array.from(new Map(Array.from(memoryStore.chatbots.values()).map((b) => [b._id, b])).values());
    if (ids && ids.length > 0) {
      return unique.filter((b) => ids.includes(b._id) || (b.id && ids.includes(b.id)) || (b.slug && ids.includes(b.slug)));
    }
    return unique.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  findAllChatbots(): MemoryChatbot[] {
    return this.findChatbots();
  },

  findChatbotById(id: string): MemoryChatbot | null {
    if (!id) return null;
    const direct = memoryStore.chatbots.get(id);
    if (direct) return direct;
    for (const b of memoryStore.chatbots.values()) {
      if (
        b._id === id ||
        b.id === id ||
        (b.slug && b.slug.toLowerCase() === id.toLowerCase().trim())
      ) {
        return b;
      }
    }
    return null;
  },

  updateChatbot(id: string, updateData: any): MemoryChatbot | null {
    const bot = this.findChatbotById(id);
    if (!bot) return null;
    const updated = {
      ...bot,
      ...updateData,
      updatedAt: new Date(),
    };
    memoryStore.chatbots.set(bot._id, updated);
    if (bot.id) memoryStore.chatbots.set(bot.id, updated);
    persistMemoryDb();
    return updated;
  },

  deleteChatbot(id: string): boolean {
    const bot = this.findChatbotById(id);
    if (!bot) return false;
    const targetId = bot._id;
    const deleted = memoryStore.chatbots.delete(targetId);
    if (bot.id) memoryStore.chatbots.delete(bot.id);
    // Cascade delete related pages and chunks
    for (const [pageId, p] of memoryStore.crawledPages.entries()) {
      if (p.chatbotId === targetId || p.chatbotId === id) memoryStore.crawledPages.delete(pageId);
    }
    for (const [chunkId, c] of memoryStore.documentChunks.entries()) {
      if (c.chatbotId === targetId || c.chatbotId === id) memoryStore.documentChunks.delete(chunkId);
    }
    for (const [formId, f] of memoryStore.botForms.entries()) {
      if (f.botId === targetId || f.botId === id) {
        memoryStore.botForms.delete(formId);
        for (const [subId, s] of memoryStore.formSubmissions.entries()) {
          if (s.formId === formId) memoryStore.formSubmissions.delete(subId);
        }
      }
    }
    persistMemoryDb();
    return deleted;
  },

  // Crawled Pages
  upsertCrawledPage(chatbotId: string, url: string, data: any): MemoryCrawledPage {
    for (const [pageId, p] of memoryStore.crawledPages.entries()) {
      if (p.chatbotId === chatbotId && p.url === url) {
        const updated = { ...p, ...data, updatedAt: new Date() };
        memoryStore.crawledPages.set(pageId, updated);
        persistMemoryDb();
        return updated;
      }
    }
    const id = generateObjectId();
    const page: MemoryCrawledPage = {
      _id: id,
      chatbotId,
      url,
      title: data.title || '',
      status: data.status || 'queued',
      chunkCount: data.chunkCount || 0,
      error: data.error || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.crawledPages.set(id, page);
    persistMemoryDb();
    return page;
  },

  findCrawledPages(chatbotId: string): MemoryCrawledPage[] {
    return Array.from(memoryStore.crawledPages.values())
      .filter((p) => p.chatbotId === chatbotId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  countCrawledPages(chatbotId?: string, status?: string): number {
    return Array.from(memoryStore.crawledPages.values()).filter((p) => {
      if (chatbotId && p.chatbotId !== chatbotId) return false;
      if (status && p.status !== status) return false;
      return true;
    }).length;
  },

  deleteCrawledPage(chatbotId: string, pageId: string): boolean {
    const page = memoryStore.crawledPages.get(pageId);
    if (page && page.chatbotId === chatbotId) {
      memoryStore.crawledPages.delete(pageId);
      // Delete chunks for this page
      for (const [chunkId, c] of memoryStore.documentChunks.entries()) {
        if (c.chatbotId === chatbotId && c.pageUrl === page.url) {
          memoryStore.documentChunks.delete(chunkId);
        }
      }
      persistMemoryDb();
      return true;
    }
    return false;
  },

  // Document Chunks
  insertDocumentChunks(chunks: any[]): MemoryDocumentChunk[] {
    const created: MemoryDocumentChunk[] = [];
    for (const c of chunks) {
      const id = generateObjectId();
      const doc: MemoryDocumentChunk = {
        _id: id,
        chatbotId: c.chatbotId?.toString() || c.chatbotId,
        pageUrl: c.pageUrl,
        content: c.content,
        embedding: c.embedding || [],
        metadata: c.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryStore.documentChunks.set(id, doc);
      created.push(doc);
    }
    persistMemoryDb();
    return created;
  },

  findDocumentChunks(chatbotId: string, pageUrl?: string): MemoryDocumentChunk[] {
    return Array.from(memoryStore.documentChunks.values())
      .filter((c) => {
        if (c.chatbotId !== chatbotId) return false;
        if (pageUrl && c.pageUrl !== pageUrl) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  countDocumentChunks(chatbotId?: string): number {
    if (!chatbotId) return memoryStore.documentChunks.size;
    return Array.from(memoryStore.documentChunks.values()).filter(
      (c) => c.chatbotId === chatbotId
    ).length;
  },

  deleteDocumentChunk(chatbotId: string, chunkId: string): boolean {
    const chunk = memoryStore.documentChunks.get(chunkId);
    if (chunk && chunk.chatbotId === chatbotId) {
      const res = memoryStore.documentChunks.delete(chunkId);
      persistMemoryDb();
      return res;
    }
    return false;
  },

  deleteDocumentChunksForBot(chatbotId: string): number {
    let count = 0;
    for (const [id, c] of memoryStore.documentChunks.entries()) {
      if (c.chatbotId === chatbotId) {
        memoryStore.documentChunks.delete(id);
        count++;
      }
    }
    if (count > 0) persistMemoryDb();
    return count;
  },

  // Bot Forms
  upsertBotForm(
    chatbotId: string,
    data: { formType: string; title: string; targetUrl: string; fieldsSchema: any[]; submitEndpoint?: string; submitMethod?: string } & { _id?: string }
  ): MemoryBotForm {
    const existingId = data._id;
    const formTypeLower = (data.formType || 'OTHER').toLowerCase();
    const isReplace =
      typeof existingId === 'string' &&
      (existingId === 'replace_all' || existingId === 'replace-all');

    let existing: MemoryBotForm | null = null;
    for (const [, f] of memoryStore.botForms.entries()) {
      if (f.botId !== chatbotId) continue;
      if (!isReplace && existingId && f._id !== existingId) continue;
      if (isReplace && f.formType.toLowerCase() !== formTypeLower) continue;
      existing = f;
      break;
    }

    if (existing) {
      const updated: MemoryBotForm = {
        ...existing,
        formType: data.formType,
        title: data.title,
        targetUrl: data.targetUrl,
        fieldsSchema: data.fieldsSchema,
        submitEndpoint: data.submitEndpoint || existing.submitEndpoint,
        submitMethod: data.submitMethod || existing.submitMethod || 'POST',
        isActive: true,
        updatedAt: new Date(),
      };
      memoryStore.botForms.set(existing._id, updated);
      persistMemoryDb();
      return updated;
    }

    const id = existingId && existingId !== 'replace_all' && existingId !== 'replace-all' ? existingId : generateObjectId();
    const form: MemoryBotForm = {
      _id: id,
      botId: chatbotId,
      formType: data.formType,
      title: data.title,
      targetUrl: data.targetUrl,
      fieldsSchema: data.fieldsSchema || [],
      submitEndpoint: data.submitEndpoint || '',
      submitMethod: data.submitMethod || 'POST',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.botForms.set(id, form);
    persistMemoryDb();
    return form;
  },

  findBotForms(chatbotId?: string, activeOnly = false): MemoryBotForm[] {
    return Array.from(memoryStore.botForms.values())
      .filter((f) => (!chatbotId || f.botId === chatbotId) && (!activeOnly || f.isActive))
      .sort((a, b) => a.createdAt.getTime() - a.createdAt.getTime());
  },

  createBotForm(data: any): MemoryBotForm {
    return this.upsertBotForm(data.botId || '', data);
  },

  findBotFormById(formId: string): MemoryBotForm | null {
    return memoryStore.botForms.get(formId) || null;
  },

  deleteBotFormsForBot(chatbotId: string): number {
    let count = 0;
    for (const [id, f] of memoryStore.botForms.entries()) {
      if (f.botId === chatbotId) {
        memoryStore.botForms.delete(id);
        for (const [subId, s] of memoryStore.formSubmissions.entries()) {
          if (s.formId === id) memoryStore.formSubmissions.delete(subId);
        }
        count++;
      }
    }
    if (count > 0) persistMemoryDb();
    return count;
  },

  // Form Submissions
  createFormSubmission(data: { formId: string; sessionId: string; data: Record<string, unknown>; status: 'in_progress' | 'completed' }): MemoryFormSubmission {
    const id = generateObjectId();
    const sub: MemoryFormSubmission = {
      _id: id,
      formId: data.formId,
      sessionId: data.sessionId,
      data: data.data || {},
      status: data.status || 'in_progress',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.formSubmissions.set(id, sub);
    persistMemoryDb();
    return sub;
  },

  findInProgressSubmission(sessionId: string, formId: string): MemoryFormSubmission | null {
    for (const [, s] of memoryStore.formSubmissions.entries()) {
      if (s.sessionId === sessionId && s.formId === formId && s.status === 'in_progress') {
        return s;
      }
    }
    return null;
  },

  findFormSubmissionById(submissionId: string): MemoryFormSubmission | null {
    return memoryStore.formSubmissions.get(submissionId) || null;
  },

  deleteFormSubmission(submissionId: string): boolean {
    const res = memoryStore.formSubmissions.delete(submissionId);
    persistMemoryDb();
    return res;
  },

  updateFormSubmission(submissionId: string, updateData: Partial<{ data: Record<string, unknown>; status: 'in_progress' | 'completed' }>): MemoryFormSubmission | null {
    const sub = memoryStore.formSubmissions.get(submissionId);
    if (!sub) return null;
    const updated = {
      ...sub,
      ...updateData,
      updatedAt: new Date(),
    };
    memoryStore.formSubmissions.set(submissionId, updated);
    persistMemoryDb();
    return updated;
  },

  findFormSubmissions(formId?: string, sessionId?: string): MemoryFormSubmission[] {
    return Array.from(memoryStore.formSubmissions.values())
      .filter((s) => {
        if (formId && s.formId !== formId) return false;
        if (sessionId && s.sessionId !== sessionId) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  // Admin Users
  findAdminByEmail(email: string): MemoryAdminUser | null {
    const clean = String(email || '').toLowerCase().trim();
    for (const [, admin] of memoryStore.adminUsers.entries()) {
      if (admin.email.toLowerCase().trim() === clean) {
        return admin;
      }
    }
    return null;
  },

  findAllAdmins(): MemoryAdminUser[] {
    return Array.from(memoryStore.adminUsers.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  },

  createAdmin(data: { email: string; role?: 'super_admin' | 'admin'; addedBy?: string; name?: string }): MemoryAdminUser {
    const id = generateObjectId();
    const cleanEmail = String(data.email || '').toLowerCase().trim();
    const admin: MemoryAdminUser = {
      _id: id,
      id,
      email: cleanEmail,
      role: data.role || 'admin',
      addedBy: data.addedBy ? String(data.addedBy).toLowerCase().trim() : 'super_admin',
      name: data.name || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.adminUsers.set(id, admin);
    persistMemoryDb();
    return admin;
  },

  deleteAdmin(email: string): boolean {
    const clean = String(email || '').toLowerCase().trim();
    for (const [id, admin] of memoryStore.adminUsers.entries()) {
      if (admin.email.toLowerCase().trim() === clean) {
        const res = memoryStore.adminUsers.delete(id);
        persistMemoryDb();
        return res;
      }
    }
    return false;
  },

  // Conversations & Live Handoff
  findConversation(botId: string, sessionId: string): MemoryConversation | null {
    for (const [, conv] of memoryStore.conversations.entries()) {
      if (conv.botId === botId && conv.sessionId === sessionId) {
        return conv;
      }
    }
    return null;
  },

  findConversationsByBot(botId: string, status?: string): MemoryConversation[] {
    return Array.from(memoryStore.conversations.values())
      .filter((c) => {
        if (c.botId !== botId) return false;
        if (status && status !== 'all' && c.status !== status) return false;
        return true;
      })
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  },

  findAllConversations(limit = 100): MemoryConversation[] {
    return Array.from(memoryStore.conversations.values())
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
      .slice(0, limit);
  },

  createConversation(data: {
    botId: string;
    sessionId: string;
    visitor?: { name?: string; email?: string; phone?: string; ip?: string };
    status?: 'bot' | 'waiting_agent' | 'agent_active' | 'resolved';
  }): MemoryConversation {
    const id = generateObjectId();
    const conv: MemoryConversation = {
      _id: id,
      botId: data.botId,
      sessionId: data.sessionId,
      visitor: data.visitor || { name: 'Visitor' },
      status: data.status || 'bot',
      messages: [],
      lastMessageAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.conversations.set(id, conv);
    persistMemoryDb();
    return conv;
  },

  updateConversationStatus(
    botId: string,
    sessionId: string,
    status: 'bot' | 'waiting_agent' | 'agent_active' | 'resolved',
    handoffReason?: string
  ): MemoryConversation | null {
    let conv = this.findConversation(botId, sessionId);
    if (!conv) {
      conv = this.createConversation({ botId, sessionId, status });
    }
    conv.status = status;
    if (handoffReason !== undefined) {
      conv.handoffReason = handoffReason;
    }
    conv.lastMessageAt = new Date();
    conv.updatedAt = new Date();
    persistMemoryDb();
    return conv;
  },

  addConversationMessage(
    botId: string,
    sessionId: string,
    message: {
      id?: string;
      role: 'user' | 'assistant' | 'agent' | 'system';
      senderName?: string;
      content: string;
      timestamp?: Date;
    }
  ): MemoryConversation {
    let conv = this.findConversation(botId, sessionId);
    if (!conv) {
      conv = this.createConversation({ botId, sessionId });
    }
    conv.messages.push({
      id: message.id || generateObjectId(),
      role: message.role,
      senderName: message.senderName || '',
      content: message.content,
      timestamp: message.timestamp || new Date(),
    });
    conv.lastMessageAt = new Date();
    conv.updatedAt = new Date();
    persistMemoryDb();
    return conv;
  },

  assignConversationAgent(
    botId: string,
    sessionId: string,
    agent: { id?: string; name: string; email: string }
  ): MemoryConversation | null {
    const conv = this.findConversation(botId, sessionId);
    if (!conv) return null;
    conv.assignedAgent = agent;
    conv.status = 'agent_active';
    conv.updatedAt = new Date();
    persistMemoryDb();
    return conv;
  },

  incrementChatbotUsage(
    botId: string,
    delta: { inputTokens?: number; outputTokens?: number; chats?: boolean }
  ): MemoryChatbot | null {
    const bot = memoryStore.chatbots.get(botId);
    if (!bot) return null;
    const u = bot.usage || { inputTokens: 0, outputTokens: 0, chats: 0, leads: 0 };
    u.inputTokens = (u.inputTokens || 0) + (delta.inputTokens || 0);
    u.outputTokens = (u.outputTokens || 0) + (delta.outputTokens || 0);
    if (delta.chats) u.chats = (u.chats || 0) + 1;
    bot.usage = u;
    bot.updatedAt = new Date();
    memoryStore.chatbots.set(botId, bot);
    persistMemoryDb();
    return bot;
  },

  incrementChatbotLeadCount(botId: string): MemoryChatbot | null {
    const bot = memoryStore.chatbots.get(botId);
    if (!bot) return null;
    const u = bot.usage || { inputTokens: 0, outputTokens: 0, chats: 0, leads: 0 };
    u.leads = (u.leads || 0) + 1;
    bot.usage = u;
    bot.updatedAt = new Date();
    memoryStore.chatbots.set(botId, bot);
    persistMemoryDb();
    return bot;
  },

  // User Profiles
  findUserProfileByEmail(email: string): MemoryUserProfile | null {
    const clean = String(email || '').toLowerCase().trim();
    for (const [, p] of memoryStore.userProfiles.entries()) {
      if (p.email.toLowerCase().trim() === clean) return p;
    }
    return null;
  },

  findUserProfileById(id: string): MemoryUserProfile | null {
    return memoryStore.userProfiles.get(id) || null;
  },

  createUserProfile(data: any): MemoryUserProfile {
    const id = generateObjectId();
    const cleanEmail = String(data.email || '').toLowerCase().trim();
    const profile: MemoryUserProfile = {
      _id: id,
      userId: data.userId || '',
      email: cleanEmail,
      name: data.name || '',
      avatar: data.avatar || '',
      companyName: data.companyName || '',
      phone: data.phone || '',
      address: {
        street: data.address?.street || '',
        city: data.address?.city || '',
        state: data.address?.state || '',
        country: data.address?.country || '',
        zip: data.address?.zip || '',
      },
      payment: {
        paypalEmail: data.payment?.paypalEmail || '',
        payerId: data.payment?.payerId || '',
      },
      occupation: data.occupation || '',
      useCase: data.useCase || '',
      projectName: data.projectName || '',
      profileCompleted: Boolean(data.profileCompleted),
      plan: data.plan || 'free',
      planExpiresAt: data.planExpiresAt ? new Date(data.planExpiresAt) : undefined,
      botLimit:
        data.botLimit !== undefined && data.botLimit !== null
          ? Number(data.botLimit)
          : data.plan === 'pro'
          ? 10
          : 1,
      tokenQuota:
        data.tokenQuota !== undefined && data.tokenQuota !== null
          ? Number(data.tokenQuota)
          : data.plan === 'pro'
          ? 2500000
          : 25000,
      chatQuota:
        data.chatQuota !== undefined && data.chatQuota !== null
          ? Number(data.chatQuota)
          : data.plan === 'pro'
          ? 50000
          : 50,
      usage: {
        inputTokens: data.usage?.inputTokens || 0,
        outputTokens: data.usage?.outputTokens || 0,
        chats: data.usage?.chats || 0,
        leads: data.usage?.leads || 0,
      },
      notifications: {
        email: {
          enabled: Boolean(data.notifications?.email?.enabled),
          to: data.notifications?.email?.to || '',
        },
        whatsapp: {
          enabled: Boolean(data.notifications?.whatsapp?.enabled),
          number: data.notifications?.whatsapp?.number || '',
        },
        telegram: {
          enabled: Boolean(data.notifications?.telegram?.enabled),
          chatId: data.notifications?.telegram?.chatId || '',
          botToken: data.notifications?.telegram?.botToken || '',
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.userProfiles.set(id, profile);
    persistMemoryDb();
    return profile;
  },

  updateUserProfile(email: string, updateData: any): MemoryUserProfile | null {
    const existing = this.findUserProfileByEmail(email);
    if (!existing) return null;
    const merged = {
      ...existing,
      ...updateData,
      address: { ...existing.address, ...(updateData.address || {}) },
      payment: { ...existing.payment, ...(updateData.payment || {}) },
      usage: { ...existing.usage, ...(updateData.usage || {}) },
      notifications: {
        email: { ...existing.notifications.email, ...(updateData.notifications?.email || {}) },
        whatsapp: { ...existing.notifications.whatsapp, ...(updateData.notifications?.whatsapp || {}) },
        telegram: { ...existing.notifications.telegram, ...(updateData.notifications?.telegram || {}) },
      },
      updatedAt: new Date(),
    };
    memoryStore.userProfiles.set(existing._id, merged);
    persistMemoryDb();
    return merged;
  },

  findAllUserProfiles(): MemoryUserProfile[] {
    return Array.from(memoryStore.userProfiles.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  },

  incrementProfileUsage(
    email: string,
    delta: { inputTokens?: number; outputTokens?: number; chats?: boolean; leads?: boolean }
  ): MemoryUserProfile | null {
    const p = this.findUserProfileByEmail(email);
    if (!p) return null;
    const u = p.usage || { inputTokens: 0, outputTokens: 0, chats: 0, leads: 0 };
    u.inputTokens = (u.inputTokens || 0) + (delta.inputTokens || 0);
    u.outputTokens = (u.outputTokens || 0) + (delta.outputTokens || 0);
    if (delta.chats) u.chats = (u.chats || 0) + 1;
    if (delta.leads) u.leads = (u.leads || 0) + 1;
    p.usage = u;
    p.updatedAt = new Date();
    memoryStore.userProfiles.set(p._id, p);
    persistMemoryDb();
    return p;
  },

  // CTA Submissions
  createCtaSubmission(data: any): MemoryCtaSubmission {
    const id = generateObjectId();
    const cta: MemoryCtaSubmission = {
      _id: id,
      botId: data.botId || '',
      campaign: data.campaign || 'default',
      page: data.page || '',
      name: data.name || '',
      email: data.email || '',
      phone: data.phone || '',
      message: data.message || '',
      ownerId: data.ownerId || '',
      ownerEmail: data.ownerEmail ? String(data.ownerEmail).toLowerCase().trim() : '',
      source: data.source || 'website_cta',
      forwarded: Boolean(data.forwarded),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.ctaSubmissions.set(id, cta);
    persistMemoryDb();
    return cta;
  },

  findCtaSubmissions(playerEmail?: string): MemoryCtaSubmission[] {
    const list = Array.from(memoryStore.ctaSubmissions.values());
    const clean = playerEmail ? String(playerEmail).toLowerCase().trim() : '';
    const filtered = clean
      ? list.filter((c) => c.ownerEmail === clean || c.ownerEmail === '')
      : list;
    return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  findAllCtaSubmissions(): MemoryCtaSubmission[] {
    return Array.from(memoryStore.ctaSubmissions.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  },

  // ---------------------------------------------------------------------
  // Admin delete helpers
  //
  // The admin panel's delete actions previously reported success while doing
  // nothing in memory-DB mode, because only the Mongo branches were wired up.
  // These give every admin DELETE route a working memory-mode counterpart.
  // ---------------------------------------------------------------------

  findConversationBySession(botId: string, sessionId: string): MemoryConversation | null {
    return (
      Array.from(memoryStore.conversations.values()).find(
        (c) => c.botId === botId && c.sessionId === sessionId
      ) || null
    );
  },

  deleteConversationById(id: string): boolean {
    let deleted = memoryStore.conversations.delete(id);
    if (!deleted) {
      for (const [key, conv] of memoryStore.conversations.entries()) {
        if (conv._id === id) {
          memoryStore.conversations.delete(key);
          deleted = true;
          break;
        }
      }
    }
    persistMemoryDb();
    return deleted;
  },

  deleteAllConversations(botId?: string): number {
    let count = 0;
    for (const [key, conv] of memoryStore.conversations.entries()) {
      if (botId && conv.botId !== botId) continue;
      memoryStore.conversations.delete(key);
      count++;
    }
    persistMemoryDb();
    return count;
  },

  deleteUserProfileByEmail(email: string): boolean {
    const target = (email || '').toLowerCase().trim();
    let deleted = false;
    for (const [key, profile] of memoryStore.userProfiles.entries()) {
      if ((profile.email || '').toLowerCase().trim() === target) {
        memoryStore.userProfiles.delete(key);
        deleted = true;
      }
    }
    persistMemoryDb();
    return deleted;
  },

  deleteCtaSubmissionById(id: string): boolean {
    const res = memoryStore.ctaSubmissions.delete(id);
    persistMemoryDb();
    return res;
  },

  deleteAllCtaSubmissions(botId?: string): number {
    let count = 0;
    for (const [key, cta] of memoryStore.ctaSubmissions.entries()) {
      if (botId && cta.botId !== botId) continue;
      memoryStore.ctaSubmissions.delete(key);
      count++;
    }
    persistMemoryDb();
    return count;
  },

  deleteAllFormSubmissions(botId?: string): number {
    const formIdsForBot = botId
      ? new Set(
          Array.from(memoryStore.botForms.values())
            .filter((f) => f.botId === botId)
            .map((f) => f._id)
        )
      : null;

    let count = 0;
    for (const [key, sub] of memoryStore.formSubmissions.entries()) {
      if (formIdsForBot && !formIdsForBot.has(sub.formId)) continue;
      memoryStore.formSubmissions.delete(key);
      count++;
    }
    persistMemoryDb();
    return count;
  },

  /**
   * Wipes every record the admin audit stream is derived from. The activity
   * feed is a projection over live collections rather than a stored log, so
   * "clearing the audit stream" means clearing its source data.
   */
  clearAllActivitySourceData(): Record<string, number> {
    const counts = {
      conversations: memoryStore.conversations.size,
      ctaSubmissions: memoryStore.ctaSubmissions.size,
      formSubmissions: memoryStore.formSubmissions.size,
      userProfiles: memoryStore.userProfiles.size,
    };
    memoryStore.conversations.clear();
    memoryStore.ctaSubmissions.clear();
    memoryStore.formSubmissions.clear();
    memoryStore.userProfiles.clear();
    persistMemoryDb();
    return counts;
  },

  // Usage Records
  upsertUsageRecord(
    email: string,
    botId: string,
    date: string,
    delta: { inputTokens?: number; outputTokens?: number; chats?: boolean; leads?: boolean }
  ): MemoryUsageRecord {
    const clean = String(email || '').toLowerCase().trim();
    let rec: MemoryUsageRecord | null = null;
    for (const [, r] of memoryStore.usageRecords.entries()) {
      if (r.email === clean && r.date === date && (r.botId === botId || !botId)) {
        rec = r;
        break;
      }
    }
    if (!rec) {
      const id = generateObjectId();
      rec = {
        _id: id,
        email: clean,
        botId: botId || '',
        date,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        chats: 0,
        leads: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryStore.usageRecords.set(id, rec);
    }
    rec.inputTokens += delta.inputTokens || 0;
    rec.outputTokens += delta.outputTokens || 0;
    rec.totalTokens = rec.inputTokens + rec.outputTokens;
    if (delta.chats) rec.chats += 1;
    if (delta.leads) rec.leads += 1;
    rec.updatedAt = new Date();
    persistMemoryDb();
    return rec;
  },

  findUsageRecords(email?: string): MemoryUsageRecord[] {
    const all = Array.from(memoryStore.usageRecords.values());
    const clean = email ? String(email).toLowerCase().trim() : '';
    const list = clean ? all.filter((r) => r.email === clean) : all;
    return list.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.getTime() - a.createdAt.getTime());
  },

  getSystemSettings(): any {
    return (global as any).__memorySystemSettings || null;
  },

  updateSystemSettings(data: any): any {
    const existing = (global as any).__memorySystemSettings || {
      defaultChatProvider: 'nvidia',
      defaultChatModel: 'meta/muse-glimmer-30b',
      defaultEmbedProvider: 'nvidia',
      defaultEmbedModel: 'nvidia/llama-nemotron-embed-vl-1b-v2',
      freePlan: { botLimit: 1, tokenQuota: 25000, chatQuota: 50, monthlyPrice: 0 },
      proPlan: { botLimit: 10, tokenQuota: 2500000, chatQuota: 50000, monthlyPrice: 9 },
      byokBypassQuota: true,
    };
    const merged = {
      ...existing,
      ...data,
      freePlan: { ...existing.freePlan, ...(data.freePlan || {}) },
      proPlan: { ...existing.proPlan, ...(data.proPlan || {}) },
      byokBypassQuota: data.byokBypassQuota !== undefined ? Boolean(data.byokBypassQuota) : existing.byokBypassQuota,
    };
    (global as any).__memorySystemSettings = merged;
    persistMemoryDb();
    return merged;
  },
};
