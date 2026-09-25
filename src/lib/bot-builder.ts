/**
 * Bot Builder & AI Meta-Analysis Engine
 * 
 * Ingests raw scraped website text/markdown, executes an AI Meta-Analysis pass
 * to derive bot identity, business tone, lead triggers, qualifying questions, and guardrails,
 * validates against Zod, and persists structured bot metadata and semantic vector chunks.
 */

import { z } from 'zod';
import mongoose from 'mongoose';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Chatbot, DocumentChunk } from '@/lib/models';
import { isUsingMemoryDb } from '@/lib/db';
import { MemoryDb } from '@/lib/memoryDb';
import { chunkText } from '@/lib/crawler/chunker';
import { getBatchEmbeddings } from '@/lib/ai/embeddings';
import { upsertQdrantChunks, isQdrantConfigured } from '@/lib/vector/qdrant';
import { normalizeEmail } from '@/lib/crawler/scraper';

// ============================================================================
// 1. Zod Schema & TypeScript Interface
// ============================================================================

export const QualificationQuestionsSchema = z.object({
  ask_for_email: z.string().min(1, 'ask_for_email question is required'),
  ask_for_phone: z.string().min(1, 'ask_for_phone question is required'),
});

export const BotConfigSchema = z.object({
  bot_name: z.string().min(1, 'bot_name is required'),
  company_name: z.string().min(1, 'company_name is required'),
  tone: z.string().min(1, 'tone is required'),
  core_value_prop: z.string().min(1, 'core_value_prop is required'),
  lead_triggers: z.array(z.string()).min(1, 'At least one lead trigger is required'),
  qualification_questions: QualificationQuestionsSchema,
  guardrails: z.array(z.string()).default([]),
  support_email: z.string().optional().default(''),
  phone: z.string().optional().default(''),
});

export type BotConfig = z.infer<typeof BotConfigSchema>;

export interface ParsedChatTags {
  cleanText: string;
  handoffReason?: string;
  handoffActive?: string;
  leadCaptured?: string;
  guardrailBlocked?: string;
  isUngroundedFallback?: boolean;
  tags: string[];
}

/**
 * Parses and extracts runtime chat control tags from an assistant response
 * while returning clean, human-readable text for display.
 */
export function parseRuntimeTags(text: string): ParsedChatTags {
  if (!text) {
    return { cleanText: '', tags: [] };
  }

  const tags: string[] = [];
  let handoffReason: string | undefined;
  let handoffActive: string | undefined;
  let leadCaptured: string | undefined;
  let guardrailBlocked: string | undefined;
  let isUngroundedFallback = false;

  const handoffMatch = text.match(/\[\[HANDOFF:\s*([^\]]+)\]\]/i);
  if (handoffMatch) {
    handoffReason = handoffMatch[1].trim();
    tags.push(`HANDOFF: ${handoffReason}`);
  }

  const activeMatch = text.match(/\[\[HANDOFF_ACTIVE:\s*([^\]]+)\]\]/i);
  if (activeMatch) {
    handoffActive = activeMatch[1].trim();
    tags.push(`HANDOFF_ACTIVE: ${handoffActive}`);
  }

  const leadMatch = text.match(/\[\[LEAD_CAPTURED:\s*([^\]]+)\]\]/i);
  if (leadMatch) {
    leadCaptured = leadMatch[1].trim();
    tags.push(`LEAD_CAPTURED: ${leadCaptured}`);
  }

  const guardrailMatch = text.match(/\[\[GUARDRAIL_BLOCKED:\s*([^\]]+)\]\]/i);
  if (guardrailMatch) {
    guardrailBlocked = guardrailMatch[1].trim();
    tags.push(`GUARDRAIL_BLOCKED: ${guardrailBlocked}`);
  }

  if (/\[\[UNGROUNDED_FALLBACK\]\]/i.test(text)) {
    isUngroundedFallback = true;
    tags.push('UNGROUNDED_FALLBACK');
  }

  const cleanText = text
    .replace(/\[\[(HANDOFF|HANDOFF_ACTIVE|LEAD_CAPTURED|GUARDRAIL_BLOCKED)[^\]]*\]\]/gi, '')
    .replace(/\[\[UNGROUNDED_FALLBACK\]\]/gi, '')
    .trim();

  return {
    cleanText,
    handoffReason,
    handoffActive,
    leadCaptured,
    guardrailBlocked,
    isUngroundedFallback,
    tags,
  };
}

export interface BotBuilderOptions {
  apiKey?: string;
  provider?: 'gemini' | 'openrouter' | 'openai' | 'nvidia' | 'anthropic';
  model?: string;
  temperature?: number;
}

// ============================================================================
// 2. Intelligent Rule-Based Fallback (Zero-Dependency Resilience)
// ============================================================================

/**
 * Generates a normalized deterministic embedding vector based on term/char n-grams.
 * Ensures local development and offline environments function with true cosine similarity.
 */
export function createDeterministicEmbedding(text: string, dim = 768): number[] {
  const vec = new Array(dim).fill(0);
  const clean = (text || '').toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const pos = (code * 31 + i * 17) % dim;
    vec[pos] += 1;
  }
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}

/**
 * Extracts phone numbers from text using standard international and domestic formats
 */
function extractPhone(text: string): string {
  const match = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  return match ? match[0].trim() : '';
}

/**
 * Extracts emails from text with normalization and validation
 */
function extractEmail(text: string): string {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}/g);
  if (matches) {
    for (const m of matches) {
      const norm = normalizeEmail(m);
      if (norm) return norm;
    }
  }
  return '';
}

/**
 * Derives a probable company name from scraped content headers and titles
 */
function extractCompanyName(text: string): string {
  const h1Match = text.match(/#\s+([^\n\r]+)/);
  if (h1Match && h1Match[1].trim()) {
    const raw = h1Match[1].replace(/[|•–-].*$/, '').trim();
    if (raw.length > 2 && raw.length < 50) return raw;
  }

  const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1].trim()) {
    const raw = titleMatch[1].replace(/[|•–-].*$/, '').trim();
    if (raw.length > 2 && raw.length < 50) return raw;
  }

  const copyrightMatch = text.match(/(?:copyright|©)\s*(?:\d{4})?\s*([A-Za-z0-9\s.,]+?)(?:\.|\n|all rights)/i);
  if (copyrightMatch && copyrightMatch[1].trim()) {
    const raw = copyrightMatch[1].trim();
    if (raw.length > 2 && raw.length < 40) return raw;
  }

  return 'Acme Solutions';
}

/**
 * Heuristic fallback that guarantees a validated BotConfig even when external LLMs are unavailable
 */
export function heuristicBotConfigExtractor(scrapedContent: string): BotConfig {
  const email = extractEmail(scrapedContent);
  const phone = extractPhone(scrapedContent);
  const clean = scrapedContent.slice(0, 10000);
  const companyName = extractCompanyName(clean);

  // Detect business tone based on keywords
  let tone = 'professional, consultative, and reliable';
  const lower = clean.toLowerCase();
  if (lower.includes('speed') || lower.includes('scale') || lower.includes('growth') || lower.includes('revolution')) {
    tone = 'energetic, modern, and growth-focused';
  } else if (lower.includes('secure') || lower.includes('compliance') || lower.includes('enterprise') || lower.includes('certified')) {
    tone = 'authoritative, formal, and precision-driven';
  } else if (lower.includes('care') || lower.includes('patient') || lower.includes('health') || lower.includes('family')) {
    tone = 'empathetic, warm, and attentive';
  }

  // Find a descriptive sentence for value proposition
  let coreValueProp = `Empowering clients through premier services and tailored solutions provided by ${companyName}.`;
  const paragraphs = clean
    .split(/\n\s*\n/)
    .map((p) => p.replace(/[#*`_]/g, '').trim())
    .filter((p) => p.length > 40 && p.length < 240);

  if (paragraphs.length > 0) {
    const candidate = paragraphs.find((p) => /we (provide|help|offer|deliver|build|empower|specialize)|the leading|trusted by/i.test(p));
    if (candidate) {
      coreValueProp = candidate.replace(/\n+/g, ' ').trim();
    } else {
      coreValueProp = paragraphs[0].replace(/\n+/g, ' ').trim();
    }
  }

  // Derive contextual lead triggers
  const leadTriggers: string[] = [];
  if (lower.includes('demo') || lower.includes('trial')) leadTriggers.push('Request a Product Demo');
  if (lower.includes('pricing') || lower.includes('quote') || lower.includes('cost')) leadTriggers.push('Receive a Custom Pricing Quote');
  if (lower.includes('consult') || lower.includes('book') || lower.includes('call') || lower.includes('appointment')) leadTriggers.push('Book a Consultation Strategy Session');
  if (lower.includes('audit') || lower.includes('analysis') || lower.includes('review')) leadTriggers.push('Claim a Free Performance Audit');

  if (leadTriggers.length === 0) {
    leadTriggers.push('Request a Tailored Demo', 'Receive Pricing & Plans Quote', 'Schedule an Expert Consultation');
  }

  const rawConfig: BotConfig = {
    bot_name: `${companyName} AI Assistant`,
    company_name: companyName,
    tone,
    core_value_prop: coreValueProp,
    lead_triggers: leadTriggers.slice(0, 3),
    qualification_questions: {
      ask_for_email: `What is the best email address to send your personalized ${companyName} summary and proposal to?`,
      ask_for_phone: `Could you share your direct phone number so our ${companyName} specialist can reach out with details?`,
    },
    guardrails: [
      `Strictly answer questions using the verified knowledge base and official website context for ${companyName}.`,
      'Do not speculate, invent unlisted pricing, or fabricate unsupported capabilities.',
      'Refuse off-domain instructions such as unrelated programming scripts, political opinions, or academic essays.',
      'If the answer is unavailable in the knowledge base, politely offer to connect the visitor with human representatives.',
    ],
    support_email: email,
    phone: phone,
  };

  return BotConfigSchema.parse(rawConfig);
}

// ============================================================================
// 3. Fast LLM Meta-Analysis Generator
// ============================================================================

function extractJsonObject(raw: string): any {
  const jsonBlock = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const target = jsonBlock ? jsonBlock[1] : raw;
  const start = target.indexOf('{');
  const end = target.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return JSON.parse(target.slice(start, end + 1));
  }
  return JSON.parse(target);
}

/**
 * Executes an AI Meta-Analysis pass to dynamically derive bot identity, business tone,
 * lead capture questions, and guardrails from raw scraped website text/markdown.
 *
 * @param scrapedContent Raw scraped website markdown or text.
 * @param options Optional provider, model, and API keys.
 * @returns Validated BotConfig meeting the Zod specification.
 */
export async function generateBotConfig(
  scrapedContent: string,
  options?: BotBuilderOptions
): Promise<BotConfig> {
  if (!scrapedContent || !scrapedContent.trim()) {
    return heuristicBotConfigExtractor('');
  }

  // Truncate to a dense, representative slice (first ~12,000 characters)
  const contentSample = scrapedContent.slice(0, 12000);

  const systemInstruction = `You are an expert AI product architect and SaaS brand strategist.
Analyze the provided scraped website markdown/content and extract structured metadata for an autonomous AI business chatbot.

Output ONLY a raw, valid JSON object matching this exact schema:
{
  "bot_name": "Friendly, professional bot name (e.g. 'Aura', 'Friday', '[Company] Guide')",
  "company_name": "Official brand or business name extracted from the site",
  "tone": "Specific brand voice and conversational style (e.g. 'formal, energetic, direct, consultative, empathetic')",
  "core_value_prop": "Concise 1-2 sentence core value proposition of what the business offers",
  "lead_triggers": [
    "2 to 3 contextual lead conversion triggers based on offerings (e.g. 'Request a Demo', 'Custom Pricing Quote', 'Audit Review')"
  ],
  "qualification_questions": {
    "ask_for_email": "A natural, high-converting question asking the visitor for their email address tailored to this business",
    "ask_for_phone": "A natural, respectful question asking the visitor for their phone number"
  },
  "guardrails": [
    "3 to 5 domain-specific operational guardrails and refusal bounds tailored to this business"
  ],
  "support_email": "Support or contact email if found on the site (or empty string)",
  "phone": "Direct contact phone number if found on the site (or empty string)"
}`;

  // 1. Try Google Gemini if key is provided or in environment
  const geminiKey = options?.apiKey || process.env.GEMINI_API_KEY;
  if (geminiKey && (!options?.provider || options.provider === 'gemini')) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: options?.model || 'gemini-2.5-flash',
        systemInstruction,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: options?.temperature ?? 0.2,
        },
      });

      const prompt = `Analyze this scraped website content and generate the structured bot configuration:\n\n${contentSample}`;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = extractJsonObject(text);
      return BotConfigSchema.parse(parsed);
    } catch (err) {
      console.warn('[BotBuilder] Gemini analysis failed, trying alternate provider or fallback:', err instanceof Error ? err.message : err);
    }
  }

  // 2. Try OpenRouter / OpenAI / NVIDIA NIM if key is available
  const openrouterKey = options?.apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (openrouterKey && (options?.provider === 'openrouter' || options?.provider === 'openai' || !options?.provider)) {
    try {
      const endpoint = options?.provider === 'openai'
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openrouterKey}`,
          'HTTP-Referer': 'https://sitebotstudio.app',
          'X-Title': 'SiteBot Studio Bot Builder',
        },
        body: JSON.stringify({
          model: options?.model || 'openai/gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: `Analyze this scraped website content:\n\n${contentSample}` },
          ],
          temperature: options?.temperature ?? 0.2,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const parsed = extractJsonObject(content);
          return BotConfigSchema.parse(parsed);
        }
      }
    } catch (err) {
      console.warn('[BotBuilder] OpenRouter/OpenAI analysis failed:', err instanceof Error ? err.message : err);
    }
  }

  // 3. Try Anthropic (Claude 3.5 Haiku) if key is provided
  const anthropicKey = options?.apiKey || process.env.ANTHROPIC_API_KEY;
  if (anthropicKey && (options?.provider === 'anthropic' || (!geminiKey && !openrouterKey))) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: options?.model || 'claude-3-5-haiku-20241022',
          max_tokens: 1500,
          system: systemInstruction,
          messages: [
            { role: 'user', content: `Analyze this scraped website content and output valid JSON according to schema:\n\n${contentSample}` },
          ],
          temperature: options?.temperature ?? 0.2,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const content = json.content?.[0]?.text;
        if (content) {
          const parsed = extractJsonObject(content);
          return BotConfigSchema.parse(parsed);
        }
      }
    } catch (err) {
      console.warn('[BotBuilder] Anthropic analysis failed:', err instanceof Error ? err.message : err);
    }
  }

  // 4. Fallback to resilient heuristic generator
  return heuristicBotConfigExtractor(scrapedContent);
}

// ============================================================================
// 4. Ingestion & Vector Store Persistence
// ============================================================================

export interface IngestAndBuildParams {
  scrapedContent: string;
  siteUrl: string;
  botConfig?: BotConfig;
  ownerId?: string;
  ownerEmail?: string;
  ownerName?: string;
  primaryColor?: string;
  position?: 'bottom-right' | 'bottom-left';
  chatProvider?: 'gemini' | 'openrouter' | 'openai' | 'nvidia';
  apiKeys?: {
    gemini?: string;
    openrouter?: string;
    openai?: string;
    nvidia?: string;
  };
  options?: BotBuilderOptions;
}

export interface IngestAndBuildResult {
  botId: string;
  bot: any;
  botConfig: BotConfig;
  chunksCount: number;
  vectorStore: 'qdrant' | 'mongodb' | 'memory';
}

/**
 * Complete end-to-end ingestion pipeline:
 * 1. Executes AI Meta-Analysis to derive BotConfig.
 * 2. Saves structured metadata to the bots table/collection.
 * 3. Semantically chunks the raw scraped content.
 * 4. Generates dense embeddings.
 * 5. Saves semantic chunks to the vector store (Qdrant / MongoDB / in-memory).
 */
export async function ingestAndBuildBot(params: IngestAndBuildParams): Promise<IngestAndBuildResult> {
  const {
    scrapedContent,
    siteUrl,
    ownerId = '',
    ownerEmail = '',
    ownerName = '',
    primaryColor = '#6366f1',
    position = 'bottom-right',
    chatProvider = 'gemini',
    apiKeys = {},
    options,
  } = params;

  // Step 1: Derive or validate BotConfig
  const botConfig = params.botConfig
    ? BotConfigSchema.parse(params.botConfig)
    : await generateBotConfig(scrapedContent, options);

  // Step 2: Synthesize system prompt and suggested questions from BotConfig
  const synthesizedPrompt = [
    `You are ${botConfig.bot_name}, the official AI representative for ${botConfig.company_name} (${siteUrl}).`,
    `Core Mission & Value: ${botConfig.core_value_prop}`,
    `Conversational Tone: ${botConfig.tone}. Be helpful, polite, and brand-aligned.`,
    `Qualification Objectives:`,
    `- When appropriate or when the visitor expresses interest, ask: "${botConfig.qualification_questions.ask_for_email}"`,
    `- For direct follow-up consultations or calls, ask: "${botConfig.qualification_questions.ask_for_phone}"`,
    `Specific Guardrails:`,
    ...botConfig.guardrails.map((g) => `- ${g}`),
    `Only provide facts that are verified in the website context. If not found, politely offer to connect the visitor with human representatives.`,
  ].join('\n\n');

  const greeting = `Hello! 👋 I'm ${botConfig.bot_name}, representing ${botConfig.company_name}. How can I assist you with our services today?`;

  const suggestedQuestions = [
    `Tell me about ${botConfig.company_name}`,
    ...botConfig.lead_triggers.slice(0, 2),
  ];

  const botRecordData = {
    name: botConfig.bot_name,
    siteUrl,
    systemPrompt: synthesizedPrompt,
    primaryColor,
    position,
    chatProvider,
    chatModel: 'gemini-2.5-flash',
    embedProvider: 'gemini',
    embedModel: 'text-embedding-004',
    apiKeys,
    greeting,
    suggestedQuestions,
    email: botConfig.support_email || '',
    phone: botConfig.phone || '',
    guardrails: {
      enabled: true,
      strictRAG: true,
      promptInjectionDefense: true,
      domainScopeEnforcement: true,
      piiMasking: true,
      similarityThreshold: 0.40,
      fallbackMessage: `I do not have verified information about that from ${botConfig.company_name}'s website. Please contact our team directly at ${botConfig.support_email || 'our contact page'}!`,
    },
    handoff: {
      enabled: true,
      autoDetect: true,
      agentName: `${botConfig.company_name} Live Representative`,
    },
    ownerId,
    ownerEmail: ownerEmail ? ownerEmail.toLowerCase().trim() : '',
    ownerName,
    status: 'active' as const,
  };

  let bot: any;
  let botId = '';

  if (isUsingMemoryDb()) {
    bot = MemoryDb.createChatbot(botRecordData);
    botId = bot._id;
  } else {
    bot = await Chatbot.create(botRecordData);
    botId = bot._id.toString();
  }

  // Step 3: Semantic Chunking
  const rawChunks = chunkText(scrapedContent, 700, 120);

  // Step 4: Batch Embeddings
  const textsToEmbed = rawChunks.map((c) => c.content);
  const geminiKey = apiKeys.gemini || process.env.GEMINI_API_KEY || '';
  let embeddings: number[][] = [];

  if (geminiKey && !geminiKey.toLowerCase().includes('dummy')) {
    try {
      embeddings = await getBatchEmbeddings(textsToEmbed, 'gemini', geminiKey);
    } catch (err) {
      console.warn('[BotBuilder] Embeddings API call failed, generating deterministic fallback vectors:', err instanceof Error ? err.message : err);
    }
  }

  if (!embeddings || embeddings.length === 0) {
    embeddings = textsToEmbed.map((t) => createDeterministicEmbedding(t, 768));
  }

  const enrichedChunks = rawChunks.map((chunk, idx) => ({
    chatbotId: botId,
    pageUrl: siteUrl,
    content: chunk.content,
    embedding: embeddings[idx] || createDeterministicEmbedding(chunk.content, 768),
    metadata: {
      title: `${botConfig.company_name} Knowledge Base`,
      chunkIndex: idx,
      totalChunks: rawChunks.length,
    },
  }));

  // Step 5: Save Semantic Chunks to Vector Store
  let vectorStore: 'qdrant' | 'mongodb' | 'memory' = 'memory';

  if (isQdrantConfigured()) {
    try {
      await upsertQdrantChunks(enrichedChunks);
      vectorStore = 'qdrant';
    } catch (err) {
      console.warn('[BotBuilder] Qdrant upsert failed, falling back to database chunks:', err);
    }
  }

  if (isUsingMemoryDb()) {
    MemoryDb.insertDocumentChunks(enrichedChunks);
    if (vectorStore !== 'qdrant') vectorStore = 'memory';
  } else {
    const docs = enrichedChunks.map((c) => ({
      chatbotId: new mongoose.Types.ObjectId(botId),
      pageUrl: c.pageUrl,
      content: c.content,
      embedding: c.embedding,
      metadata: c.metadata,
    }));
    await DocumentChunk.insertMany(docs);
    if (vectorStore !== 'qdrant') vectorStore = 'mongodb';
  }

  // Step 6: Create default BotForm for lead capture
  const defaultFormFields = [
    { key: 'name', label: 'Full Name', type: 'string', required: false },
    { key: 'email', label: 'Email Address', type: 'string', required: true },
    { key: 'phone', label: 'Phone Number', type: 'string', required: false },
    { key: 'message', label: 'How can we help?', type: 'string', required: false },
  ];

  if (isUsingMemoryDb()) {
    MemoryDb.createBotForm({
      botId,
      formType: 'LEAD_GENERATION',
      title: `${botConfig.company_name} Lead Capture`,
      targetUrl: siteUrl,
      fieldsSchema: defaultFormFields,
      isActive: true,
    });
  }

  return {
    botId,
    bot,
    botConfig,
    chunksCount: enrichedChunks.length,
    vectorStore,
  };
}
