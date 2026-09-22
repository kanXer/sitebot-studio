import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Chatbot, CrawledPage, DocumentChunk } from '@/lib/models';
import { crawlWebsite, extractSiteIdentity } from '@/lib/crawler/scraper';
import { chunkText } from '@/lib/crawler/chunker';
import { getBatchEmbeddings } from '@/lib/ai/embeddings';
import { MemoryDb } from '@/lib/memoryDb';
import { upsertQdrantChunks, deleteQdrantBotChunks, isQdrantConfigured } from '@/lib/vector/qdrant';

const encoder = new TextEncoder();

function sseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
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
      if (!mongoose.Types.ObjectId.isValid(chatbotId)) {
        controller.enqueue(sseEvent('error', { error: 'Valid chatbotId is required' }));
        controller.close();
        return;
      }
      bot = await Chatbot.findById(chatbotId);
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

    const botObjectId =
      !isUsingMemoryDb() && mongoose.Types.ObjectId.isValid(chatbotId)
        ? new mongoose.Types.ObjectId(chatbotId)
        : null;

    const qdrantConfig = bot.customVectorDb?.enabled ? bot.customVectorDb : undefined;

    // Reset existing if requested
    if (resetExisting) {
      if (isQdrantConfigured(qdrantConfig)) {
        await deleteQdrantBotChunks(chatbotId, undefined, qdrantConfig);
      }
      if (isUsingMemoryDb()) {
        MemoryDb.deleteDocumentChunksForBot(chatbotId);
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
          const p = MemoryDb.upsertCrawledPage(chatbotId, page.url, {
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
            MemoryDb.upsertCrawledPage(chatbotId, page.url, { status: 'indexed', chunkCount: 0 });
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
          bot.embedModel || (embedProvider === 'openai' ? 'text-embedding-3-small' : 'text-embedding-004'),
          5,
          350
        );

        const chunkDocs = chunks.map((chunk, idx) => ({
          chatbotId: isUsingMemoryDb() ? chatbotId : botObjectId,
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
              chatbotId,
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
          MemoryDb.upsertCrawledPage(chatbotId, page.url, {
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
          MemoryDb.upsertCrawledPage(chatbotId, page.url, {
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
      auditUrl: bot.auditUrl || '',
      pricingUrl: bot.pricingUrl || '',
      keyTopics: [] as string[],
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
    } catch (identErr) {
      console.warn('Could not extract site identity:', identErr);
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

    // Update chatbot with dynamic identity, questions, contact links, and prompt
    const botUpdates: Record<string, any> = {
      greeting: tailoredGreeting,
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
    if (siteIdentity.auditUrl) botUpdates.auditUrl = siteIdentity.auditUrl;
    if (siteIdentity.pricingUrl) botUpdates.pricingUrl = siteIdentity.pricingUrl;
    if (siteIdentity.brandColor) botUpdates.primaryColor = siteIdentity.brandColor;

    if (isUsingMemoryDb()) {
      MemoryDb.updateChatbot(chatbotId, botUpdates);
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
          auditUrl: siteIdentity.auditUrl,
          pricingUrl: siteIdentity.pricingUrl,
        },
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
