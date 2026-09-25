import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Chatbot, CrawledPage, DocumentChunk } from '@/lib/models';
import { crawlWebsite, extractSiteIdentity, extractEmailsFromHtml, normalizeEmail, ScrapedPage } from '@/lib/crawler/scraper';
import { chunkText } from '@/lib/crawler/chunker';
import { getBatchEmbeddings } from '@/lib/ai/embeddings';
import { extractFormsFromUrl, pickFormCandidateUrls, RawExtractedForm } from '@/lib/crawler/formExtractor';
import { classifyAndPersistForms, LLMProviderConfig } from '@/lib/crawler/formClassifier';
import { MemoryDb } from '@/lib/memoryDb';
import { upsertQdrantChunks, deleteQdrantBotChunks, isQdrantConfigured } from '@/lib/vector/qdrant';
import { generateBotConfig } from '@/lib/bot-builder';
import { deriveBusinessRoleSubtitle } from '@/lib/niche-detector';

const encoder = new TextEncoder();

function sseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

const isRealKey = (key?: string) => Boolean(key && key.trim() && !key.toLowerCase().includes('dummy'));

/**
 * Resolves an LLM config for form classification using the bot's own keys,
 * falling back to NVIDIA NIM then OpenRouter master keys.
 */
function buildFormClassifierConfig(bot: any): LLMProviderConfig | undefined {
  const nvidiaKey = isRealKey(bot.apiKeys?.nvidia) ? bot.apiKeys.nvidia : '';
  if (nvidiaKey) {
    return {
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      apiKey: nvidiaKey,
      model: 'meta/llama-3.3-70b-instruct',
    };
  }
  const openrouterKey = isRealKey(bot.apiKeys?.openrouter) ? bot.apiKeys.openrouter : '';
  if (openrouterKey) {
    return {
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: openrouterKey,
      model: 'meta-llama/llama-3.3-70b-instruct',
    };
  }
  const masterNvidia = isRealKey(process.env.NVIDIA_API_KEY) ? process.env.NVIDIA_API_KEY : '';
  if (masterNvidia) {
    return {
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      apiKey: masterNvidia,
      model: 'meta/llama-3.3-70b-instruct',
    };
  }
  const masterOpenrouter = isRealKey(process.env.OPENROUTER_API_KEY) ? process.env.OPENROUTER_API_KEY : '';
  if (masterOpenrouter) {
    return {
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: masterOpenrouter,
      model: 'meta-llama/llama-3.3-70b-instruct',
    };
  }
  return undefined;
}

/**
 * Detects interactive forms on the most promising crawled pages (contact /
 * booking / order / enquiry), renders them with Playwright, normalizes them via
 * the LLM (heuristics as fallback) and persists the definitions to bot_forms.
 */
async function scanAndSaveForms(
  chatbotId: string,
  scrapedPages: ScrapedPage[],
  bot: any
): Promise<{ scannedUrls: string[]; rawForms: RawExtractedForm[]; savedForms: any[] }> {
  const candidates = pickFormCandidateUrls(
    scrapedPages.map((p) => ({ url: p.url, title: p.title })),
    bot.siteUrl
  ).slice(0, 3);

  const rawForms: RawExtractedForm[] = [];
  const scannedUrls: string[] = [];

  for (const url of candidates) {
    scannedUrls.push(url);
    try {
      const { forms } = await extractFormsFromUrl(url, {
        waitForFrameworksMs: 2200,
        timeoutMs: 28000,
        maxForms: 15,
      });
      rawForms.push(...forms);
    } catch (err: unknown) {
      console.warn(`[FormScan] Skipped ${url}:`, err instanceof Error ? err.message : err);
    }
    if (rawForms.length >= 10) break;
  }

  try {
    const savedForms = await classifyAndPersistForms(
      chatbotId,
      rawForms,
      buildFormClassifierConfig(bot)
    );
    return { scannedUrls, rawForms, savedForms };
  } catch (err: unknown) {
    console.warn('[FormScan] Could not persist classified forms:', err instanceof Error ? err.message : err);
    return { scannedUrls, rawForms, savedForms: [] };
  }
}

async function runCrawl(
  controller: ReadableStreamDefaultController<Uint8Array>,
  req: NextRequest
) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const { chatbotId, maxPages = 15, resetExisting = true } = body;

    if (!chatbotId) {
      controller.enqueue(sseEvent('error', { error: 'Valid chatbotId is required' }));
      controller.close();
      return;
    }

    let bot: any;
    if (isUsingMemoryDb()) {
      bot = MemoryDb.findChatbotById(chatbotId);
    } else {
      if (mongoose.Types.ObjectId.isValid(chatbotId)) {
        bot = await Chatbot.findById(chatbotId);
      }
      if (!bot) {
        bot = await Chatbot.findOne({ slug: String(chatbotId || '').toLowerCase().trim() });
      }
    }

    if (!bot) {
      controller.enqueue(sseEvent('error', { error: 'Chatbot not found' }));
      controller.close();
      return;
    }

    const embedProvider = bot.embedProvider || 'nvidia';
    const apiKey =
      embedProvider === 'nvidia'
        ? bot.apiKeys?.nvidia || process.env.NVIDIA_API_KEY
        : embedProvider === 'openai'
        ? bot.apiKeys?.openai || process.env.OPENAI_API_KEY
        : bot.apiKeys?.gemini || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      controller.enqueue(
        sseEvent('error', {
          error: `An API key for ${embedProvider} is required to generate vector embeddings. Please add your key in AI Models & Keys settings.`,
        })
      );
      controller.close();
      return;
    }

    const botIdStr = (bot._id || bot.id).toString();
    const botObjectId = !isUsingMemoryDb() ? new mongoose.Types.ObjectId(bot._id) : null;

    const qdrantConfig = bot.customVectorDb?.enabled ? bot.customVectorDb : undefined;

    // Reset existing if requested
    if (resetExisting) {
      if (isQdrantConfigured(qdrantConfig)) {
        await deleteQdrantBotChunks(botIdStr, undefined, qdrantConfig);
      }
      if (isUsingMemoryDb()) {
        MemoryDb.deleteDocumentChunksForBot(botIdStr);
      } else if (botObjectId) {
        await Promise.all([
          CrawledPage.deleteMany({ chatbotId: botObjectId }),
          DocumentChunk.deleteMany({ chatbotId: botObjectId }),
        ]);
      }
    }

    // Step 1: Execute depth-2 web crawler capped at max 15-20 pages
    controller.enqueue(sseEvent('progress', { percent: 5, message: 'Discovering pages...' }));
    const pageLimit = Math.min(Math.max(Number(maxPages) || 15, 1), 20);
    const scrapedPages = await crawlWebsite(bot.siteUrl, pageLimit, 2);

    if (scrapedPages.length === 0) {
      controller.enqueue(
        sseEvent('error', {
          error: `Could not crawl any pages from "${bot.siteUrl}". Please verify the URL is correct, public, and allows automated access.`,
        })
      );
      controller.close();
      return;
    }

    let totalChunksIndexed = 0;
    const indexedPagesSummary = [];

    // Step 2: For each scraped page, chunk and embed
    for (let pageIdx = 0; pageIdx < scrapedPages.length; pageIdx++) {
      const page = scrapedPages[pageIdx];
      controller.enqueue(
        sseEvent('progress', {
          percent: Math.min(94, 8 + Math.round(((pageIdx + 1) / scrapedPages.length) * 86)),
          message: `Indexing ${page.title || page.url} (${pageIdx + 1}/${scrapedPages.length})`,
        })
      );
      try {
        let pageDocId: string | null = null;
        if (isUsingMemoryDb()) {
          const p = MemoryDb.upsertCrawledPage(botIdStr, page.url, {
            title: page.title || 'Untitled',
            status: 'indexing',
            error: '',
          });
          pageDocId = p._id;
        } else if (botObjectId) {
          const p = await CrawledPage.findOneAndUpdate(
            { chatbotId: botObjectId, url: page.url },
            {
              chatbotId: botObjectId,
              url: page.url,
              title: page.title || 'Untitled',
              status: 'indexing',
              error: '',
            },
            { upsert: true, new: true, returnDocument: 'after' }
          );
          pageDocId = p._id.toString();
        }

        const chunks = chunkText(page.text, 700, 100);

        if (chunks.length === 0) {
          if (isUsingMemoryDb()) {
            MemoryDb.upsertCrawledPage(botIdStr, page.url, { status: 'indexed', chunkCount: 0 });
          } else if (pageDocId) {
            await CrawledPage.findByIdAndUpdate(pageDocId, { status: 'indexed', chunkCount: 0 });
          }
          continue;
        }

        // Generate 768-dim embeddings
        const chunkTexts = chunks.map((c) => c.content);
        const embeddings = await getBatchEmbeddings(
          chunkTexts,
          embedProvider,
          apiKey,
          bot.embedModel || (embedProvider === 'openai' ? 'text-embedding-3-small' : 'gemini-embedding-001'),
          5,
          350
        );

        const chunkDocs = chunks.map((chunk, idx) => ({
          chatbotId: isUsingMemoryDb() ? botIdStr : botObjectId,
          pageUrl: page.url,
          content: chunk.content,
          embedding: embeddings[idx] || [],
          metadata: {
            title: page.title || 'Untitled',
            chunkIndex: chunk.chunkIndex,
            totalChunks: chunk.totalChunks,
            charCount: chunk.charCount,
          },
        }));

        // Upsert into Qdrant Vector Database
        if (isQdrantConfigured(qdrantConfig)) {
          await upsertQdrantChunks(
            chunkDocs.map((c) => ({
              chatbotId: botIdStr,
              pageUrl: c.pageUrl,
              content: c.content,
              embedding: c.embedding,
              metadata: c.metadata,
            })),
            undefined,
            qdrantConfig
          );
        }

        // Store in DB / MemoryDb for knowledge management
        if (isUsingMemoryDb()) {
          MemoryDb.insertDocumentChunks(chunkDocs);
          MemoryDb.upsertCrawledPage(botIdStr, page.url, {
            status: 'indexed',
            chunkCount: chunkDocs.length,
          });
        } else {
          await DocumentChunk.insertMany(chunkDocs);
          if (pageDocId) {
            await CrawledPage.findByIdAndUpdate(pageDocId, {
              status: 'indexed',
              chunkCount: chunkDocs.length,
            });
          }
        }

        totalChunksIndexed += chunkDocs.length;
        indexedPagesSummary.push({
          url: page.url,
          title: page.title,
          chunkCount: chunkDocs.length,
        });
      } catch (pageErr: any) {
        console.error(`Error indexing page ${page.url}:`, pageErr);
        if (isUsingMemoryDb()) {
          MemoryDb.upsertCrawledPage(botIdStr, page.url, {
            status: 'failed',
            error: pageErr.message || 'Indexing failed',
          });
        } else if (botObjectId) {
          await CrawledPage.findOneAndUpdate(
            { chatbotId: botObjectId, url: page.url },
            { status: 'failed', error: pageErr.message || 'Indexing failed' }
          );
        }
      }
    }

    // Step 3: Extract dynamic site identity & generate content-specific quick questions
    let siteIdentity = {
      brandName: bot.name || 'Company',
      brandColor: bot.primaryColor || '',
      description: '',
      phone: bot.phone || '',
      whatsapp: bot.whatsapp || '',
      email: bot.email || '',
      keyTopics: [] as string[],
      quickLinks: [] as Array<{ label: string; url: string }>,
    };

    controller.enqueue(
      sseEvent('progress', { percent: 96, message: 'Extracting brand identity...' })
    );

    try {
      const homeHtml = scrapedPages[0]?.rawHtml;
      if (homeHtml) {
        const extracted = extractSiteIdentity(homeHtml, bot.siteUrl);
        siteIdentity = { ...siteIdentity, ...extracted };
      }

      // If email, phone, or whatsapp are missing, or to discover contact details from dedicated pages,
      // scan all other crawled pages, prioritizing /contact, /about, /support, /help, /reach, /touch URLs.
      const contactCandidates = scrapedPages.slice(1).sort((a, b) => {
        const aIsContact = /contact|about|support|reach|help|touch/i.test(a.url);
        const bIsContact = /contact|about|support|reach|help|touch/i.test(b.url);
        if (aIsContact && !bIsContact) return -1;
        if (!aIsContact && bIsContact) return 1;
        return 0;
      });

      for (const page of contactCandidates) {
        if (!siteIdentity.email && page.rawHtml) {
          const emails = extractEmailsFromHtml(page.rawHtml, bot.siteUrl);
          if (emails.length > 0) {
            siteIdentity.email = emails[0];
          }
        }
        if (!siteIdentity.email && page.text) {
          const textMatches = page.text.match(/\b[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,24}\b/g);
          if (textMatches) {
            for (const m of textMatches) {
              const norm = normalizeEmail(m);
              if (norm) {
                siteIdentity.email = norm;
                break;
              }
            }
          }
        }
        if ((!siteIdentity.phone || !siteIdentity.whatsapp) && page.rawHtml) {
          const subIdent = extractSiteIdentity(page.rawHtml, page.url);
          if (!siteIdentity.phone && subIdent.phone) siteIdentity.phone = subIdent.phone;
          if (!siteIdentity.whatsapp && subIdent.whatsapp) siteIdentity.whatsapp = subIdent.whatsapp;
        }
        if (siteIdentity.email && siteIdentity.phone && siteIdentity.whatsapp) break;
      }
    } catch (identErr) {
      console.warn('Could not extract site identity:', identErr);
    }

    // Step 4: Detect interactive forms on the site and build conversational
    // slot-filling definitions for the chat tool layer.
    let formScan: { scannedUrls: string[]; rawForms: RawExtractedForm[]; savedForms: any[] } = {
      scannedUrls: [],
      rawForms: [],
      savedForms: [],
    };
    controller.enqueue(
      sseEvent('progress', { percent: 97, message: 'Scanning for interactive forms...' })
    );
    try {
      formScan = await scanAndSaveForms(botIdStr, scrapedPages, bot);
    } catch (formErr: any) {
      console.warn('Could not scan forms:', formErr);
    }

    const brandName = siteIdentity.brandName || bot.name || 'Company';

    // Generate dynamic suggested questions matching the website offerings
    let dynamicQuestions: string[] = [];
    try {
      const nvidiaKey = bot.apiKeys?.nvidia || process.env.NVIDIA_API_KEY;
      dynamicQuestions = await generateDynamicQuestions(
        brandName,
        siteIdentity.description,
        siteIdentity.keyTopics,
        nvidiaKey
      );
    } catch (qErr) {
      console.warn('Could not generate dynamic questions:', qErr);
      dynamicQuestions = [
        `What services does ${brandName} offer?`,
        `How can ${brandName} help my business?`,
        `Can I get a free audit or consultation?`,
      ];
    }

    // Build grounded system prompt for the bot
    const tailoredPrompt = `You are the official, helpful, and reliable AI assistant for ${brandName} (${bot.siteUrl}).
${siteIdentity.description ? `\nABOUT ${brandName.toUpperCase()}:\n${siteIdentity.description}\n` : ''}
${siteIdentity.keyTopics && siteIdentity.keyTopics.length > 0 ? `\nKEY SERVICES & HIGHLIGHTS:\n- ${siteIdentity.keyTopics.slice(0, 8).join('\n- ')}\n` : ''}
PRIMARY INSTRUCTIONS:
1. Greet visitors warmly and introduce yourself as the official AI representative for ${brandName}.
2. Always answer questions accurately, professionally, and concisely using the verified knowledge base context.
3. If a visitor asks about services, pricing, or getting started, highlight what ${brandName} provides and offer clear next steps.
4. If a specific private or technical detail is not found in the verified context, politely state what you do know and invite them to contact the team.`;

    const tailoredGreeting = `Hi! 👋 Welcome to ${brandName}. How can I assist you with our services and solutions today?`;

    // Derive business niche and tailored role subtitle
    const combinedAllContent = scrapedPages.map((p) => (p.title || '') + ' ' + (p.text || '')).join(' ');
    const detectedRoleTitle = deriveBusinessRoleSubtitle(
      brandName,
      combinedAllContent + ' ' + (siteIdentity.description || ''),
      bot.siteUrl,
      siteIdentity.keyTopics
    );

    // Update chatbot with dynamic identity, questions, contact links, and prompt
    const botUpdates: Record<string, any> = {
      greeting: tailoredGreeting,
      roleTitle: detectedRoleTitle,
      systemPrompt: tailoredPrompt,
      suggestedQuestions: dynamicQuestions,
    };

    const isGenericName =
      !bot.name ||
      bot.name === 'Site AI Assistant' ||
      bot.name === 'My Chatbot' ||
      bot.name === 'Friday' ||
      bot.name.startsWith('SiteBot');
    if (isGenericName && brandName) {
      botUpdates.name = `${brandName} Assistant`;
    }

    if (siteIdentity.phone) botUpdates.phone = siteIdentity.phone;
    if (siteIdentity.whatsapp) botUpdates.whatsapp = siteIdentity.whatsapp;
    if (siteIdentity.email) botUpdates.email = siteIdentity.email;
    if (siteIdentity.brandColor) botUpdates.primaryColor = siteIdentity.brandColor;

    // Merge crawled quick links into the bot's saved quick links — only add,
    // never overwrite/remove links the user already configured.
    if (siteIdentity.quickLinks && siteIdentity.quickLinks.length > 0) {
      const existingLinks: Array<{ label: string; url: string }> =
        bot.customLinks && Array.isArray(bot.customLinks) ? bot.customLinks : [];
      const seenUrls = new Set(existingLinks.map((l) => l.url));
      const merged = [...existingLinks];
      for (const link of siteIdentity.quickLinks) {
        if (merged.length >= 10) break;
        if (!seenUrls.has(link.url)) {
          merged.push(link);
          seenUrls.add(link.url);
        }
      }
      botUpdates.customLinks = merged;
    }

    // Step 4.5: Run AI Meta-Analysis pass to derive tone, value prop, lead triggers, and guardrails
    let derivedBotConfig: any = null;
    try {
      controller.enqueue(
        sseEvent('progress', { percent: 97, message: 'Running AI Meta-Analysis & guardrails derivation...' })
      );
      const combinedText = scrapedPages.map((p) => `# ${p.title || ''}\n${p.text}`).join('\n\n');
      const chatProv = bot.chatProvider || 'gemini';
      const metaApiKey = bot.apiKeys?.[chatProv as keyof typeof bot.apiKeys] ||
        (chatProv === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY);

      derivedBotConfig = await generateBotConfig(combinedText, {
        apiKey: metaApiKey,
        provider: (chatProv === 'openai' || chatProv === 'openrouter' || chatProv === 'gemini') ? chatProv : undefined,
        model: bot.chatModel,
      });

      if (derivedBotConfig) {
        botUpdates.botConfig = derivedBotConfig;
        if (derivedBotConfig.tone && derivedBotConfig.core_value_prop) {
          botUpdates.systemPrompt = [
            `You are ${derivedBotConfig.bot_name}, the official AI representative for ${derivedBotConfig.company_name} (${bot.siteUrl}).`,
            `Core Mission & Value: ${derivedBotConfig.core_value_prop}`,
            `Conversational Tone: ${derivedBotConfig.tone}. Be helpful, polite, and brand-aligned.`,
            `Qualification Objectives:`,
            `- When appropriate or when the visitor expresses interest, ask: "${derivedBotConfig.qualification_questions?.ask_for_email || 'What is your best email address?'}"`,
            `- For direct follow-up consultations or calls, ask: "${derivedBotConfig.qualification_questions?.ask_for_phone || 'What is your direct phone number?'}"`,
            `Specific Guardrails:`,
            ...(derivedBotConfig.guardrails || []).map((g: string) => `- ${g}`),
            `Only provide facts that are verified in the website context. If not found, politely offer to connect the visitor with human representatives.`,
          ].join('\n\n');
        }

        if (Array.isArray(derivedBotConfig.lead_triggers) && derivedBotConfig.lead_triggers.length > 0) {
          dynamicQuestions = [
            `Tell me about ${derivedBotConfig.company_name}`,
            ...derivedBotConfig.lead_triggers.slice(0, 2),
          ];
          botUpdates.suggestedQuestions = dynamicQuestions;
        }
      }
    } catch (metaErr) {
      console.warn('[Crawl] AI Meta-Analysis failed, keeping default prompt:', metaErr);
    }

    if (isUsingMemoryDb()) {
      MemoryDb.updateChatbot(botIdStr, botUpdates);
    } else if (botObjectId) {
      await Chatbot.findByIdAndUpdate(botObjectId, botUpdates);
    }

    controller.enqueue(
      sseEvent('progress', { percent: 98, message: 'Finalizing bot knowledge...' })
    );

    controller.enqueue(
      sseEvent('done', {
        success: true,
        message: `Successfully indexed ${indexedPagesSummary.length} pages into ${totalChunksIndexed} vector chunks for ${brandName}.`,
        pagesIndexed: indexedPagesSummary.length,
        chunksIndexed: totalChunksIndexed,
        siteIdentity: {
          brandName,
          botName: botUpdates.name || bot.name,
          brandColor: siteIdentity.brandColor,
          description: siteIdentity.description,
          greeting: tailoredGreeting,
          systemPrompt: tailoredPrompt,
          suggestedQuestions: dynamicQuestions,
          phone: siteIdentity.phone,
          whatsapp: siteIdentity.whatsapp,
          email: siteIdentity.email,
          roleTitle: detectedRoleTitle,
          quickLinks: siteIdentity.quickLinks || [],
        },
        forms: {
          scannedUrls: formScan.scannedUrls,
          formsFound: formScan.rawForms.length,
          formsExtracted: formScan.savedForms.length,
          forms: formScan.savedForms.map((f: any) => ({
            id: String(f._id),
            formType: f.formType,
            title: f.title,
            targetUrl: f.targetUrl,
            fieldCount: Array.isArray(f.fieldsSchema) ? f.fieldsSchema.length : 0,
          })),
        },
        botConfig: derivedBotConfig || null,
        pages: indexedPagesSummary,
      })
    );
    controller.enqueue(sseEvent('progress', { percent: 100, message: 'Done!' }));
    controller.close();
  } catch (error: any) {
    console.error('Crawl API error:', error);
    try {
      controller.enqueue(
        sseEvent('error', { error: error.message || 'Crawl and indexing process failed' })
      );
      controller.close();
    } catch {
      /* already closed */
    }
  }
}

export async function POST(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      await runCrawl(controller, req);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

async function generateDynamicQuestions(
  brandName: string,
  description: string,
  topics: string[],
  apiKey?: string
): Promise<string[]> {
  if (apiKey) {
    try {
      const prompt = `You are configuring an interactive chat widget for the website "${brandName}".
Description: ${description || 'Digital agency / services company'}
Key Services & Headings: ${topics.slice(0, 6).join(', ') || 'Online solutions'}

Generate exactly 3 or 4 short, engaging visitor questions (each under 45 characters) that visitors would want to click to learn more about ${brandName}'s offerings.
Output ONLY a JSON array of strings, for example: ["What services do you offer?", "How does your pricing work?", "Can I get a free audit?"]. No markdown code fences, no extra text.`;

      const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'meta/llama-3.2-11b-vision-instruct',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 150,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content?.trim() || '';
        const cleanJson = content.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          return parsed
            .map((q: any) => String(q).trim())
            .filter((q: string) => q.length > 5 && q.length < 65)
            .slice(0, 4);
        }
      }
    } catch (err) {
      console.warn('[Crawl] Dynamic question generation fallback:', err);
    }
  }

  // Smart fallback using scraped topics
  const fallback: string[] = [];
  if (topics.length > 0) {
    fallback.push(`What ${topics[0].slice(0, 30)} services do you offer?`);
  } else {
    fallback.push(`What services does ${brandName} offer?`);
  }
  if (topics.length > 1) {
    fallback.push(`Tell me more about ${topics[1].slice(0, 30)}`);
  } else {
    fallback.push(`How do I get started with ${brandName}?`);
  }
  fallback.push('Can I get a free growth audit or quote?');
  return fallback;
}

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const botId = searchParams.get('botId');

    if (!botId) {
      return NextResponse.json({ error: 'Valid botId parameter is required' }, { status: 400 });
    }

    let pages: any[] = [];
    let chunkTotal = 0;

    if (isUsingMemoryDb()) {
      pages = MemoryDb.findCrawledPages(botId);
      chunkTotal = MemoryDb.countDocumentChunks(botId);
    } else {
      if (!mongoose.Types.ObjectId.isValid(botId)) {
        return NextResponse.json({ error: 'Valid botId parameter is required' }, { status: 400 });
      }
      const botObjectId = new mongoose.Types.ObjectId(botId);
      pages = await CrawledPage.find({ chatbotId: botObjectId })
        .sort({ createdAt: -1 })
        .lean();
      chunkTotal = await DocumentChunk.countDocuments({ chatbotId: botObjectId });
    }

    return NextResponse.json({
      success: true,
      pages: pages.map((p: any) => ({
        id: p._id.toString(),
        url: p.url,
        title: p.title,
        status: p.status,
        chunkCount: p.chunkCount,
        error: p.error,
        updatedAt: p.updatedAt,
      })),
      totalChunks: chunkTotal,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve crawler status' },
      { status: 500 }
    );
  }
}
