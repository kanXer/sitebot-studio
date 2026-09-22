import crypto from 'crypto';

/**
 * In-Memory Database Fallback for SiteBot Studio
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
  suggestedQuestions: string[];
  phone?: string;
  whatsapp?: string;
  email?: string;
  auditUrl?: string;
  pricingUrl?: string;
  customVectorDb?: {
    enabled: boolean;
    provider: string;
    url: string;
    apiKey: string;
    collectionName?: string;
  };
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

// Global in-memory collections surviving hot reloads
declare global {
  // eslint-disable-next-line no-var
  var __memoryChatbots: Map<string, MemoryChatbot> | undefined;
  // eslint-disable-next-line no-var
  var __memoryCrawledPages: Map<string, MemoryCrawledPage> | undefined;
  // eslint-disable-next-line no-var
  var __memoryDocumentChunks: Map<string, MemoryDocumentChunk> | undefined;
}

function generateObjectId(): string {
  return crypto.randomBytes(12).toString('hex');
}

export const memoryStore = {
  chatbots: global.__memoryChatbots || new Map<string, MemoryChatbot>(),
  crawledPages: global.__memoryCrawledPages || new Map<string, MemoryCrawledPage>(),
  documentChunks: global.__memoryDocumentChunks || new Map<string, MemoryDocumentChunk>(),
};

global.__memoryChatbots = memoryStore.chatbots;
global.__memoryCrawledPages = memoryStore.crawledPages;
global.__memoryDocumentChunks = memoryStore.documentChunks;

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
      chatProvider: data.chatProvider || 'gemini',
      chatModel: data.chatModel || 'gemini-1.5-flash',
      embedProvider: data.embedProvider || 'gemini',
      embedModel: data.embedModel || 'text-embedding-004',
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
      createdAt: now,
      updatedAt: now,
    };
    memoryStore.chatbots.set(id, bot);
    return bot;
  },

  findChatbots(ids?: string[]): MemoryChatbot[] {
    const all = Array.from(memoryStore.chatbots.values());
    if (ids && ids.length > 0) {
      return all.filter((b) => ids.includes(b._id));
    }
    return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  findChatbotById(id: string): MemoryChatbot | null {
    return memoryStore.chatbots.get(id) || null;
  },

  updateChatbot(id: string, updateData: any): MemoryChatbot | null {
    const bot = memoryStore.chatbots.get(id);
    if (!bot) return null;
    const updated = {
      ...bot,
      ...updateData,
      updatedAt: new Date(),
    };
    memoryStore.chatbots.set(id, updated);
    return updated;
  },

  deleteChatbot(id: string): boolean {
    const deleted = memoryStore.chatbots.delete(id);
    // Cascade delete related pages and chunks
    for (const [pageId, p] of memoryStore.crawledPages.entries()) {
      if (p.chatbotId === id) memoryStore.crawledPages.delete(pageId);
    }
    for (const [chunkId, c] of memoryStore.documentChunks.entries()) {
      if (c.chatbotId === id) memoryStore.documentChunks.delete(chunkId);
    }
    return deleted;
  },

  // Crawled Pages
  upsertCrawledPage(chatbotId: string, url: string, data: any): MemoryCrawledPage {
    for (const [pageId, p] of memoryStore.crawledPages.entries()) {
      if (p.chatbotId === chatbotId && p.url === url) {
        const updated = { ...p, ...data, updatedAt: new Date() };
        memoryStore.crawledPages.set(pageId, updated);
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
    return page;
  },

  findCrawledPages(chatbotId: string): MemoryCrawledPage[] {
    return Array.from(memoryStore.crawledPages.values())
      .filter((p) => p.chatbotId === chatbotId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  countCrawledPages(chatbotId: string, status?: string): number {
    return Array.from(memoryStore.crawledPages.values()).filter((p) => {
      if (p.chatbotId !== chatbotId) return false;
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

  countDocumentChunks(chatbotId: string): number {
    return Array.from(memoryStore.documentChunks.values()).filter(
      (c) => c.chatbotId === chatbotId
    ).length;
  },

  deleteDocumentChunk(chatbotId: string, chunkId: string): boolean {
    const chunk = memoryStore.documentChunks.get(chunkId);
    if (chunk && chunk.chatbotId === chatbotId) {
      return memoryStore.documentChunks.delete(chunkId);
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
    return count;
  },
};
