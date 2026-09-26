import { GoogleGenerativeAI } from '@google/generative-ai';
import { RetrievedChunk } from './vectorSearch';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onSources?: (sources: Array<{ url: string; title: string }>) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

export interface ContactInfo {
  phone?: string;
  whatsapp?: string;
  email?: string;
}

/**
 * Builds an augmented system prompt including retrieved context chunks and citations instructions.
 * Accepts optional contact info so the AI always uses real values, never placeholders.
 */
export function buildAugmentedSystemPrompt(
  baseSystemPrompt: string,
  siteUrl: string,
  chunks: RetrievedChunk[],
  contact?: ContactInfo
): { prompt: string; sources: Array<{ url: string; title: string }> } {
  const uniqueSourcesMap = new Map<string, string>();

  let contextText = '';
  if (chunks.length === 0) {
    contextText = 'No specific knowledge base pages matched this particular query.';
  } else {
    chunks.forEach((chunk, index) => {
      const title = chunk.metadata?.title || 'Web Page';
      uniqueSourcesMap.set(chunk.pageUrl, title);
      contextText += `\n--- Context Document [${index + 1}] (${title} - ${chunk.pageUrl}) ---\n${chunk.content}\n`;
    });
  }

  // Build real contact details string so the AI never outputs placeholder text
  let contactDetails = '';
  if (contact?.phone || contact?.whatsapp || contact?.email) {
    const lines: string[] = [];
    if (contact.phone) lines.push(`- **Phone / Call:** ${contact.phone}`);
    if (contact.whatsapp) {
      const cleanWa = contact.whatsapp.replace(/[^\d]/g, '');
      lines.push(`- **WhatsApp:** https://wa.me/${cleanWa} (or ${contact.whatsapp})`);
    }
    if (contact.email) lines.push(`- **Email:** ${contact.email}`);
    contactDetails = `\nBUSINESS CONTACT DETAILS (use these exact values when a user asks how to get in touch, never use placeholders):\n${lines.join('\n')}\n`;
  }

  const prompt = `${baseSystemPrompt}

TARGET WEBSITE: ${siteUrl}
${contactDetails}
VERIFIED KNOWLEDGE BASE CONTEXT FROM ${siteUrl}:
${contextText}

BEHAVIOR AND ANSWERING RULES:
1. DIRECT ANSWERS ONLY: Answer ONLY what the user specifically asked. Do NOT pad with extra facts, background info, or unrelated content. One question = one focused answer.
2. STRICT BREVITY: Keep every reply to 1–3 sentences maximum, or 2–3 bullet points if listing. NEVER write long paragraphs. If the answer is short, keep it short. Do not repeat the user's question back to them.
3. GREETINGS: If the user greets you, introduce yourself briefly in 1 sentence and ask how you can help. Nothing more.
4. ACCURACY: Base answers ONLY on the verified knowledge base context above. If not found there, say so plainly in one sentence and offer to connect them with the team.
5. CONTACT INFORMATION: When asked for contact details, use ONLY the exact BUSINESS CONTACT DETAILS provided above. Never use placeholder text.
6. LEAD CAPTURE (IMPORTANT): Whenever a user expresses interest in services, pricing, a demo, a callback, or anything requiring follow-up — proactively and naturally ask for their **full name, email address, and phone number** together. Example: "To connect you with our team, could you share your name, email, and phone number?" Do this in ONE short sentence.
7. NO FILLER: Never say things like "Great question!", "Certainly!", "Of course!", "That's interesting!", or any generic opener. Start your reply directly with the answer.
8. NO OFF-TOPIC: Do not help with anything unrelated to this business — no general coding, recipes, trivia, or other topics. Politely decline in one sentence.
9. CONTACT DETAILS SHARED: When a user shares their name/email/phone, acknowledge briefly in one sentence ("Got it! Our team will reach out shortly.") then answer their question if they had one.
10. LIVE HUMAN AGENT ESCALATION: This chat system HAS direct live human agent handoff capability. If a visitor asks to speak with a human, agent, or representative, NEVER say "I don't have the capability to connect you directly through this chat" or refuse handoff. Instead say: "I am connecting you with our live human support team right now. An agent will be with you directly in this chat!"`;

  const sources = Array.from(uniqueSourcesMap.entries()).map(([url, title]) => ({
    url,
    title,
  }));

  return { prompt, sources };
}

/**
 * Streams chat response from Google Gemini (gemini-2.5-flash)
 */
export async function streamGeminiChat(
  apiKey: string,
  modelName: string,
  systemPrompt: string,
  history: ChatMessage[],
  newMessage: string,
  callbacks: StreamCallbacks,
  maxTokens?: number
): Promise<void> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: (modelName || 'gemini-2.5-flash').trim().toLowerCase(),
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: maxTokens ?? 512,
      temperature: 0.4,
    },
  });

// Convert history to Gemini format. The SDK requires the FIRST message to be
// a 'user' turn, so drop any leading assistant/model messages and collapse
// consecutive same-role turns.
const geminiHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
for (const m of history) {
  if (m.role !== 'user' && m.role !== 'assistant') continue;
  const role: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user';
  const prev = geminiHistory[geminiHistory.length - 1];
  if (!prev) {
    // First message must be 'user'. If the conversation starts with a bot
    // greeting, the bot's own reply becomes the model turn AFTER the user,
    // so we can safely start the history at the first 'user' turn instead.
    if (role === 'model') continue;
    geminiHistory.push({ role, parts: [{ text: m.content.trim() }] });
  } else {
    if (prev.role === role) {
      prev.parts.push({ text: m.content.trim() });
    } else {
      geminiHistory.push({ role, parts: [{ text: m.content.trim() }] });
    }
  }
}

// If there is still no user turn (or history is empty), seed with a blank user
// turn so the sequence is always valid for the Gemini API.
if (geminiHistory.length === 0 || geminiHistory[0].role !== 'user') {
  geminiHistory.unshift({ role: 'user', parts: [{ text: '.' }] });
}

  const chat = model.startChat({
    history: geminiHistory,
  });

  try {
    const resultStream = await chat.sendMessageStream(newMessage);
    for await (const chunk of resultStream.stream) {
      const text = chunk.text();
      if (text) {
        callbacks.onToken(text);
      }
    }
    callbacks.onDone?.();
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    callbacks.onError?.(error);
  }
}

/**
 * Streams chat response from OpenAI-compatible endpoints (OpenRouter, OpenAI, NVIDIA NIM)
 */
export async function streamOpenAICompatibleChat(
  endpointUrl: string,
  apiKey: string,
  modelName: string,
  systemPrompt: string,
  history: ChatMessage[],
  newMessage: string,
  callbacks: StreamCallbacks,
  maxTokens?: number
): Promise<void> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: newMessage },
  ];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  if (endpointUrl.includes('openrouter.ai')) {
    headers['HTTP-Referer'] = 'https://rivafy.com';
    headers['X-Title'] = 'Rivafy Studio';
  }

  // Auto-redirect deprecated / EOL models on NVIDIA NIM
  let resolvedModel = modelName;
  if (endpointUrl.includes('integrate.api.nvidia.com')) {
    const deprecated = [
      'meta/llama-3.1-8b-instruct',
      'meta/llama-3.3-70b-instruct',
      'meta/llama-3.2-3b-instruct',
      'meta/llama-3.2-1b-instruct',
      'meta/llama-3-8b-instruct',
      'meta/muse-glimmer-30b',
    ];
    if (!resolvedModel || deprecated.includes(resolvedModel)) {
      resolvedModel = 'meta/llama-3.2-11b-vision-instruct';
    }
  }

  const response = await fetch(endpointUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: resolvedModel,
      messages,
      stream: true,
      max_tokens: maxTokens ?? 512,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chat provider error (${response.status}): ${errorText}`);
  }

  if (!response.body) {
    throw new Error('No response body received from chat provider.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (trimmed === 'data: [DONE]') {
          callbacks.onDone?.();
          return;
        }

        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const delta = data.choices?.[0]?.delta;
            const content = delta?.content || delta?.reasoning_content || '';
            if (content) {
              callbacks.onToken(content);
            }
          } catch {
            // Ignore parse errors on malformed lines
          }
        }
      }
    }
    callbacks.onDone?.();
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    callbacks.onError?.(error);
    throw error;
  }
}
