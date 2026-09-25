/**
 * Runtime Chat API Route (/api/chat)
 * 
 * Executes Strict RAG with cosine similarity thresholding,
 * dynamic lead capture, and live human handoff flagging via parseable tags.
 */

import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { createHash } from 'crypto';
import { connectToDatabase, isUsingMemoryDb } from '@/lib/db';
import { Chatbot, BotForm, FormSubmission } from '@/lib/models';
import { MemoryDb } from '@/lib/memoryDb';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { searchSimilarChunks } from '@/lib/ai/vectorSearch';
import {
  buildAugmentedSystemPrompt,
  streamGeminiChat,
  streamOpenAICompatibleChat,
  ChatMessage,
} from '@/lib/ai/chat';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import {
  checkPromptInjection,
  checkDomainScope,
  checkRetrievalGroundedness,
  sanitizeModelOutput,
  injectRAGGuardrails,
} from '@/lib/ai/guardrails';
import {
  detectHandoffIntent,
  escalateToLiveAgent,
  appendConversationMessage,
  getOrCreateConversation,
} from '@/lib/ai/handoff';
import { createDeterministicEmbedding } from '@/lib/bot-builder';
import { autoCaptureLead } from '@/lib/leadCapture';
import { trackChatTurn } from '@/lib/usage';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-SiteBot-Preview',
  'Access-Control-Max-Age': '86400',
};

function sseEvent(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function resolveSessionId(botId: string, body: any, message: string): string {
  if (typeof body?.sessionId === 'string' && body.sessionId.trim()) {
    return body.sessionId.trim().slice(0, 200);
  }
  const history = Array.isArray(body?.history) ? body.history : [];
  const joined = history
    .slice(0, 3)
    .map((m: any) => String(m?.content || ''))
    .join('\u0001');
  const digest = createHash('sha1')
    .update(`${botId}|${joined}|${message}`)
    .digest('hex')
    .slice(0, 24);
  return `sess-${digest}`;
}

function chunkString(text: string, size = 8): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    out.push(text.slice(i, i + size));
  }
  return out.length > 0 ? out : [' '];
}

function streamImmediateText(
  text: string,
  extraEvents: Array<{ event: string; data: any }> = []
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const evt of extraEvents) {
        controller.enqueue(sseEvent(evt.event, evt.data));
      }
      const tokens = chunkString(text, 8);
      for (const token of tokens) {
        controller.enqueue(sseEvent('token', { token }));
      }
      controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      ...CORS_HEADERS,
    },
  });
}


// ============================================================================
// OPTIONS (CORS preflight)
// ============================================================================
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// ============================================================================
// GET /api/chat
// ============================================================================
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const url = new URL(req.url);
    const botId = url.searchParams.get('botId');

    let bot: any = null;
    if (botId) {
      if (isUsingMemoryDb()) {
        bot = MemoryDb.findChatbotById(botId);
      } else if (mongoose.Types.ObjectId.isValid(botId)) {
        bot = await Chatbot.findById(botId).lean();
      }
    }

    if (!bot) {
      if (isUsingMemoryDb()) {
        const all = MemoryDb.findChatbots();
        bot = all.find((b) => b.status !== 'disabled') || all[0] || null;
      } else {
        bot = await Chatbot.findOne({ status: { $ne: 'disabled' } }).lean();
      }
    }

    if (!bot) {
      return NextResponse.json(
        { error: 'No active chatbot found. Please create a bot first.' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        id: bot._id?.toString() || bot.id,
        name: bot.name,
        siteUrl: bot.siteUrl,
        primaryColor: bot.primaryColor || '#6366f1',
        greeting: bot.greeting,
        suggestedQuestions: bot.suggestedQuestions || [],
        leadTriggers: bot.botConfig?.lead_triggers || [],
        guardrails: bot.guardrails || { enabled: true, strictRAG: true },
      },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to retrieve chatbot info' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// ============================================================================
// POST /api/chat
// ============================================================================
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json().catch(() => ({}));
    const { message, history = [], botId: requestedBotId, stream = true } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'Message cannot be empty' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 1. Resolve Target Chatbot
    let bot: any = null;
    if (requestedBotId) {
      if (isUsingMemoryDb()) {
        bot = MemoryDb.findChatbotById(requestedBotId);
      } else if (mongoose.Types.ObjectId.isValid(requestedBotId)) {
        bot = await Chatbot.findById(requestedBotId).lean();
      }
    }

    if (!bot) {
      if (isUsingMemoryDb()) {
        const all = MemoryDb.findChatbots();
        bot = all.find((b) => b.status !== 'disabled') || all[0] || null;
      } else {
        bot = await Chatbot.findOne({ status: { $ne: 'disabled' } }).lean();
      }
    }

    if (!bot) {
      return NextResponse.json(
        { error: 'No active chatbot found to handle this request.' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const resolvedBotId = bot._id.toString();

    // Approx token estimator (chars / 4) + single-call usage recorder for bot owner
    const countTokens = (text: unknown): number =>
      Math.max(1, Math.ceil(String(text == null ? '' : text).length / 4));
    const trackChat = (replies: unknown[], chats = true) => {
      trackChatTurn(bot, {
        inputTokens: countTokens(message),
        outputTokens: replies.reduce<number>((n, r) => n + countTokens(r), 0),
        chats,
      }).catch((err) => console.warn('[Usage] Could not track chatbot usage:', err));
    };

    // 2. Rate Limiting Check
    if (bot.rateLimit?.enabled) {
      const rateResult = checkRateLimit(
        `${getClientIp(req)}|${resolvedBotId}`,
        bot.rateLimit.maxRequests || 20,
        bot.rateLimit.windowMs || 60000
      );
      if (!rateResult.allowed) {
        return NextResponse.json(
          { error: 'Too many requests. Please wait a moment and try again.' },
          { status: 429, headers: CORS_HEADERS }
        );
      }
    }

    const sessionId = resolveSessionId(resolvedBotId, body, message);

    // =========================================================================
    // GUARDRAIL 1: PROMPT INJECTION & JAILBREAK DEFENSE
    // =========================================================================
    const injectionCheck = checkPromptInjection(message, bot.guardrails);
    if (!injectionCheck.allowed) {
      const refusal = injectionCheck.responseOverride ||
        "I am configured to answer questions strictly regarding this business and its website. I cannot modify my behavior, bypass instructions, or reveal system directives.";
      
      const flaggedText = `${refusal} [[GUARDRAIL_BLOCKED: prompt_injection]]`;
      await appendConversationMessage(resolvedBotId, sessionId, { role: 'user', content: message });
      await appendConversationMessage(resolvedBotId, sessionId, { role: 'assistant', content: refusal });

      trackChat([refusal]);

      if (stream) {
        return streamImmediateText(flaggedText, [
          { event: 'guardrail', data: { triggered: true, type: 'prompt_injection' } },
        ]);
      }
      return NextResponse.json({
        response: flaggedText,
        tags: ['GUARDRAIL_BLOCKED: prompt_injection'],
        sources: [],
      }, { headers: CORS_HEADERS });
    }

    // =========================================================================
    // GUARDRAIL 2: DOMAIN & TOPIC SCOPE ENFORCEMENT
    // =========================================================================
    const domainCheck = checkDomainScope(message, bot.name, bot.siteUrl, bot.guardrails);
    if (!domainCheck.allowed) {
      const refusal = domainCheck.responseOverride ||
        `I am specialized to assist with information about **${bot.name}** (${bot.siteUrl}). For topics outside this domain, please consult general search or contact our team directly!`;
      
      const flaggedText = `${refusal} [[GUARDRAIL_BLOCKED: scope_violation]]`;
      await appendConversationMessage(resolvedBotId, sessionId, { role: 'user', content: message });
      await appendConversationMessage(resolvedBotId, sessionId, { role: 'assistant', content: refusal });

      trackChat([refusal]);

      if (stream) {
        return streamImmediateText(flaggedText, [
          { event: 'guardrail', data: { triggered: true, type: 'scope_violation' } },
        ]);
      }
      return NextResponse.json({
        response: flaggedText,
        tags: ['GUARDRAIL_BLOCKED: scope_violation'],
        sources: [],
      }, { headers: CORS_HEADERS });
    }

    // =========================================================================
    // LIVE HANDOFF CHECK 1: EXISTING ACTIVE HANDOFF CONVERSATION
    // =========================================================================
    const conversation = await getOrCreateConversation(resolvedBotId, sessionId);
    if (
      conversation &&
      (conversation.status === 'waiting_agent' || conversation.status === 'agent_active')
    ) {
      await appendConversationMessage(resolvedBotId, sessionId, { role: 'user', content: message });

      const agentNotice = conversation.status === 'agent_active'
        ? `Your message has been delivered to ${conversation.assignedAgent?.name || 'the support agent'}. They will respond directly here.`
        : 'You are in the queue for a live support representative. An agent has been alerted and will join shortly.';

      const taggedNotice = `${agentNotice} [[HANDOFF_ACTIVE: ${conversation.status}]]`;

      trackChat([agentNotice]);

      if (stream) {
        return streamImmediateText(taggedNotice, [
          {
            event: 'handoff',
            data: { status: conversation.status, assignedAgent: conversation.assignedAgent || null },
          },
        ]);
      }
      return NextResponse.json({
        response: taggedNotice,
        tags: [`HANDOFF_ACTIVE: ${conversation.status}`],
        sources: [],
      }, { headers: CORS_HEADERS });
    }

    // =========================================================================
    // LIVE HANDOFF CHECK 2: INTENT DETECTION
    // =========================================================================
    const handoffIntent = detectHandoffIntent(message);
    if (handoffIntent.shouldHandoff && bot.handoff?.enabled !== false) {
      await escalateToLiveAgent(resolvedBotId, sessionId, handoffIntent.reason || 'visitor_request');
      await appendConversationMessage(resolvedBotId, sessionId, { role: 'user', content: message });

      const escalationMessage = "I'm connecting you to a live human representative. An agent will be with you shortly to assist you directly!";
      const taggedEscalation = `${escalationMessage} [[HANDOFF: ${handoffIntent.reason || 'visitor_request'}]]`;

      await appendConversationMessage(resolvedBotId, sessionId, { role: 'system', content: escalationMessage });

      trackChat([escalationMessage]);

      if (stream) {
        return streamImmediateText(taggedEscalation, [
          {
            event: 'handoff',
            data: { status: 'waiting_agent', reason: handoffIntent.reason },
          },
        ]);
      }
      return NextResponse.json({
        response: taggedEscalation,
        tags: [`HANDOFF: ${handoffIntent.reason || 'visitor_request'}`],
        sources: [],
      }, { headers: CORS_HEADERS });
    }

    // Record user message to transcript
    await appendConversationMessage(resolvedBotId, sessionId, { role: 'user', content: message });

    // =========================================================================
    // DYNAMIC LEAD CAPTURE
    // =========================================================================
    const leadResult = await autoCaptureLead({
      bot,
      botId: resolvedBotId,
      sessionId,
      message,
    });
    const leadType = leadResult.captured ? leadResult.type : null;
    const leadTag = leadType ? ` [[LEAD_CAPTURED: ${leadType}]]` : '';

    // =========================================================================
    // SEMANTIC RETRIEVAL & VECTOR GROUNDING
    // =========================================================================
    const embedProvider = bot.embedProvider || 'gemini';
    const embedKey = bot.apiKeys?.[embedProvider as keyof typeof bot.apiKeys] || process.env.GEMINI_API_KEY || '';
    let queryEmbedding: number[] = [];

    if (embedKey && !embedKey.toLowerCase().includes('dummy')) {
      try {
        queryEmbedding = await generateEmbedding(message, embedProvider, embedKey);
      } catch (err) {
        console.warn('[RuntimeChat] Query embedding API failed, using deterministic fallback vector:', err instanceof Error ? err.message : err);
      }
    }

    if (!queryEmbedding || queryEmbedding.length === 0) {
      queryEmbedding = createDeterministicEmbedding(message, 768);
    }

    const candidateChunks = await searchSimilarChunks(
      resolvedBotId,
      queryEmbedding,
      5,
      bot.customVectorDb?.enabled ? bot.customVectorDb : undefined
    );

    const groundedness = checkRetrievalGroundedness(
      candidateChunks,
      bot.guardrails?.similarityThreshold ?? 0.40,
      bot.guardrails?.fallbackMessage
    );

    // If chunks fail similarity threshold, return unhallucinated fallback
    if (!groundedness.grounded && candidateChunks.length > 0) {
      const fallbackText = groundedness.fallbackResponse ||
        "I'm sorry, but I do not have verified information about that from this website. For assistance on this specific request, please feel free to contact our team directly.";
      
      const taggedFallback = `${fallbackText}${leadTag} [[UNGROUNDED_FALLBACK]]`;
      await appendConversationMessage(resolvedBotId, sessionId, { role: 'assistant', content: fallbackText });

      trackChat([fallbackText]);

      if (stream) {
        return streamImmediateText(taggedFallback, [
          { event: 'guardrail', data: { triggered: true, type: 'similarity_threshold_unmet' } },
        ]);
      }
      return NextResponse.json({
        response: taggedFallback,
        tags: ['UNGROUNDED_FALLBACK'],
        sources: [],
      }, { headers: CORS_HEADERS });
    }

    // =========================================================================
    // SYSTEM PROMPT AUGMENTATION & MODEL GENERATION
    // =========================================================================
    const basePromptWithGuardrails = injectRAGGuardrails(
      bot.systemPrompt,
      bot.name,
      bot.siteUrl,
      bot.guardrails
    );

    const { prompt: finalSystemPrompt, sources } = buildAugmentedSystemPrompt(
      basePromptWithGuardrails,
      bot.siteUrl,
      groundedness.chunksUsed,
      {
        phone: bot.phone,
        whatsapp: bot.whatsapp,
        email: bot.email,
      }
    );

    const chatHistory: ChatMessage[] = Array.isArray(history)
      ? history.slice(-6).map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content || ''),
        }))
      : [];

    const effectiveProvider = bot.chatProvider || 'gemini';
    const effectiveModel = bot.chatModel || 'gemini-2.5-flash';
    const apiKey = bot.apiKeys?.[effectiveProvider as keyof typeof bot.apiKeys] ||
      (effectiveProvider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENROUTER_API_KEY);

    if (stream) {
      const encoder = new TextEncoder();
      let accumulatedOutput = '';

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(sseEvent('sources', sources));

            const callbacks = {
              onToken(token: string) {
                accumulatedOutput += token;
                controller.enqueue(sseEvent('token', { token }));
              },
              async onDone() {
                // Usage tracking (approx tokens => chars/4) for bot + owner profile
                trackChat([accumulatedOutput]);

                if (leadTag) {
                  controller.enqueue(sseEvent('token', { token: leadTag }));
                }

                // Sanitize transcript recording
                const cleanOutput = sanitizeModelOutput(accumulatedOutput, bot.guardrails);
                await appendConversationMessage(resolvedBotId, sessionId, {
                  role: 'assistant',
                  content: cleanOutput,
                });

                controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
                controller.close();
              },
              onError(err: Error) {
                console.error('[RuntimeChat] Generation stream error:', err);
                controller.enqueue(sseEvent('error', { error: err.message }));
                controller.close();
              },
            };

            if (effectiveProvider === 'gemini' && apiKey) {
              await streamGeminiChat(
                apiKey,
                effectiveModel,
                finalSystemPrompt,
                chatHistory,
                message,
                callbacks
              );
            } else if (apiKey) {
              const endpoint = effectiveProvider === 'openai'
                ? 'https://api.openai.com/v1/chat/completions'
                : 'https://openrouter.ai/api/v1/chat/completions';

              await streamOpenAICompatibleChat(
                endpoint,
                apiKey,
                effectiveModel,
                finalSystemPrompt,
                chatHistory,
                message,
                callbacks
              );
            } else {
              // High-availability knowledge base direct responder
              const topChunk = groundedness.chunksUsed[0]?.content || '';
              const directAnswer = topChunk
                ? `Based on ${bot.name}'s verified documentation:\n\n${topChunk.slice(0, 450)}`
                : bot.guardrails?.fallbackMessage || "Thank you for reaching out. Please contact our team directly for detailed assistance.";
              
              const tokens = chunkString(directAnswer, 8);
              for (const token of tokens) {
                callbacks.onToken(token);
              }
              await callbacks.onDone();
            }
          } catch (err: any) {
            controller.enqueue(sseEvent('error', { error: err.message || 'Stream generation failed' }));
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          ...CORS_HEADERS,
        },
      });
    }

    // Standard Non-Streaming JSON Response
    let responseText = '';
    const topChunk = groundedness.chunksUsed[0]?.content || '';
    if (topChunk) {
      responseText = `Based on ${bot.name}'s verified documentation:\n\n${topChunk.slice(0, 450)}`;
    } else {
      responseText = bot.guardrails?.fallbackMessage || "Thank you for reaching out. Please contact our team directly for detailed assistance.";
    }

    const cleanOutput = sanitizeModelOutput(responseText, bot.guardrails);
    await appendConversationMessage(resolvedBotId, sessionId, { role: 'assistant', content: cleanOutput });

    trackChat([cleanOutput]);

    return NextResponse.json(
      {
        response: cleanOutput + leadTag,
        sources,
        tags: leadTag ? [leadTag.trim()] : [],
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[RuntimeChat] Route handler error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
