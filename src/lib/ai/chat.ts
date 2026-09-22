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
1. GREETINGS & INTRODUCTIONS: If the user greets you (e.g. "hi", "hello", "namaste", "good morning") or asks who you are, respond warmly and professionally, introduce yourself as the AI representative for this business, and offer to help with their needs.
2. ACCURACY & EVIDENCE: For questions regarding services, pricing, features, contact details, team, and company offerings, base your answers on the verified knowledge base context above.
3. CONTACT INFORMATION: When a user asks how to reach the team or requests contact details, ALWAYS use the exact BUSINESS CONTACT DETAILS provided above. NEVER write "[insert phone number]", "[insert email]", or any placeholder text. If no contact details are configured, say "Please visit our website for contact information."
4. CONVERSATIONAL HELPFULNESS: If the verified context does not contain specific proprietary data or technical statistics requested by the user, politely provide what general information is known and invite the visitor to contact the team directly using the real contact details above.
5. TONE & FORMATTING: Keep your responses engaging, clear, concise, and professional. Format with clean Markdown (bold headings, bullet points, numbered lists). Do NOT include raw citation tags like "[1]" or bracketed footnotes in your prose.
6. CONCISE & COMPLETE ANSWERS: Always provide COMPLETE, fully-formed responses that finish every sentence naturally and NEVER cut off mid-thought. Keep answers crisp, concise, and straight to the point (typically 2 to 4 sentences or 2 to 3 clean bullet points). Avoid unnecessary preamble or repeating the user's question. Conclude every thought cleanly.`;

  const sources = Array.from(uniqueSourcesMap.entries()).map(([url, title]) => ({
    url,
    title,
  }));

  return { prompt, sources };
}

/**
 * Streams chat response from Google Gemini (gemini-1.5-flash)
 */
export async function streamGeminiChat(
  apiKey: string,
  modelName: string,
  systemPrompt: string,
  history: ChatMessage[],
  newMessage: string,
  callbacks: StreamCallbacks
): Promise<void> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName || 'gemini-1.5-flash',
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.6,
    },
  });

  // Convert history to Gemini format
  const geminiHistory = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

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
  } catch (err: any) {
    callbacks.onError?.(err);
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
  callbacks: StreamCallbacks
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
    headers['HTTP-Referer'] = 'https://sitebotstudio.app';
    headers['X-Title'] = 'SiteBot Studio';
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
      max_tokens: 1024,
      temperature: 0.6,
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
