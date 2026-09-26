import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const OPENAI_BASE = 'https://api.openai.com/v1';
const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

const CACHE_TTL_MS = 5 * 60 * 1000;
type ProviderCache = { at: number; chat: string[]; embed: string[]; error: string };
const cache: Record<string, ProviderCache> = {};

const NON_CHAT_GEMINI = /(tts|image|transcribe|robotics|computer-use|antigravity|deep-research|lyria|nano-banana|preview-customtools|clip|omni-1|omni-flash)/i;

// Models confirmed to work with the project keys. Used as a safe union so
// suggestions never disappear when live one-token verification is rate-limited.
const FALLBACKS: Record<string, { chat: string[]; embed: string[] }> = {
  gemini: {
    chat: [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-3-flash-preview',
      'gemini-3.1-flash-lite',
      'gemini-3.1-flash-lite-preview',
      'gemini-3.5-flash',
      'gemini-3.6-flash',
      'gemma-4-26b-a4b-it',
    ],
    embed: ['gemini-embedding-001', 'gemini-embedding-2'],
  },
  openai: {
    chat: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
    embed: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
  },
  nvidia: {
    chat: [
      'meta/muse-glimmer-30b',
      'meta/llama-3.1-8b-instruct',
      'nvidia/llama-3.1-nemotron-70b-instruct',
    ],
    embed: [
      'nvidia/llama-nemotron-embed-vl-1b-v2',
      'nvidia/llama-3.2-nv-embedqa-1b-v1',
      'nvidia/nv-embedqa-mistral-7b-v2',
      'snowflake/arctic-embed-l',
    ],
  },
  openrouter: {
    chat: [
      'meta-llama/llama-3-8b-instruct:free',
      'google/gemini-2.0-flash-exp:free',
      'deepseek/deepseek-chat',
    ],
    embed: ['openai/text-embedding-3-small'],
  },
};

// Curated, well-known OpenRouter models to live-verify (catalog is too huge to list).
const OPENROUTER_CANDIDATES = [
  'meta-llama/llama-3-8b-instruct:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'google/gemma-3-27b-it:free',
  'google/gemini-2.5-flash',
  'deepseek/deepseek-chat',
  'deepseek/deepseek-v3',
  'mistralai/mistral-small-3.1',
  'qwen/qwen-2.5-72b-instruct',
  'openai/gpt-4o-mini',
  'anthropic/claude-3.5-haiku',
  'x-ai/grok-3-fast',
];

const OPENROUTER_EMBED_CANDIDATES = [
  'openai/text-embedding-3-small',
  'openai/text-embedding-3-large',
  'snowflake/snowflake-arctic-embed:337m',
  'snowflake/snowflake-arctic-embed:1024m',
  'qwen/qwen-embedding',
  'google/text-embedding-004',
];

function getKey(provider: string): string {
  const key =
    provider === 'gemini'
      ? process.env.GEMINI_API_KEY
      : provider === 'openai'
      ? process.env.OPENAI_API_KEY
      : provider === 'nvidia'
      ? process.env.NVIDIA_API_KEY
      : process.env.OPENROUTER_API_KEY;
  return (key || '').trim();
}

async function listAvailable(provider: string, apiKey: string): Promise<{ chat: string[]; embed: string[] }> {
  if (provider === 'openrouter') {
    return { chat: OPENROUTER_CANDIDATES, embed: OPENROUTER_EMBED_CANDIDATES };
  }

  if (provider === 'gemini') {
    const res = await fetch(`${GEMINI_BASE}/models?key=${encodeURIComponent(apiKey)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    const payload = await res.json();
    const models: any[] = Array.isArray(payload.models) ? payload.models : [];
    const chat: string[] = [];
    const embed: string[] = [];
    for (const m of models) {
      const id = typeof m.name === 'string' ? m.name.replace(/^models\//, '') : '';
      if (!id) continue;
      const methods: string[] = Array.isArray(m.supportedGenerationMethods)
        ? m.supportedGenerationMethods
        : [];
      if (methods.includes('embedContent')) embed.push(id);
      else if (methods.includes('generateContent') && !NON_CHAT_GEMINI.test(id)) chat.push(id);
    }
    return { chat, embed };
  }

  const base = provider === 'openai' ? OPENAI_BASE : NVIDIA_BASE;
  const res = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`${provider} API error: ${res.status}`);
  const payload = await res.json();
  const models: any[] = Array.isArray(payload.data) ? payload.data : [];

  if (provider === 'openai') {
    const chat = models
      .map((m) => m.id)
      .filter((id) => /^(gpt-|chatgpt-|o[1-9]|o[0-9])/i.test(id))
      .filter((id) => !/(audio|tts|whisper|realtime|transcri|image|dall-e|moderation|embedd|rerank|fine-?tun|search|instruct)/i.test(id));
    const embed = models.map((m) => m.id).filter((id) => /^(text-embedding|bge-)/i.test(id));
    return { chat, embed };
  }

  // NVIDIA NIM — drop non-conversational tooling models (guard/safety,
  // translation, document parsing, calibration, reward/judge) and embeds.
  const chat = models
    .map((m) => m.id)
    .filter((id) => !/ember|embed|embedqa/i.test(id))
    .filter((id) => !/(tts|speech|audio|audio2|vad-)/i.test(id))
    .filter((id) => !/(guard|safety|translate|riva|parse|calibration|moderation|reward|verifier|judge|kill-switch|classifier|detector|vlm$|is-)/i.test(id));
  const embed = models.map((m) => m.id).filter((id) => /ember|embed|embedqa/i.test(id));
  return { chat: chat.slice(0, 30), embed };
}

async function verifyProviderModel(
  provider: string,
  apiKey: string,
  id: string,
  mode: 'chat' | 'embed'
): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 100 + Math.random() * 150));
  try {
    if (provider === 'gemini') {
      const url = `${GEMINI_BASE}/models/${encodeURIComponent(id)}:${mode === 'chat' ? 'generateContent' : 'embedContent'}?key=${encodeURIComponent(apiKey)}`;
      const body =
        mode === 'chat'
          ? { contents: [{ role: 'user', parts: [{ text: 'ping' }] }], generationConfig: { maxOutputTokens: 1 } }
          : { content: { parts: [{ text: 'x' }] } };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(6000),
      });
      return res.ok;
    }

    if (provider === 'openrouter') {
      if (mode === 'chat') {
        const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: id, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
          signal: AbortSignal.timeout(8000),
        });
        return res.ok;
      }
      const res = await fetch(`${OPENROUTER_BASE}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: id, input: 'x' }),
        signal: AbortSignal.timeout(8000),
      });
      return res.ok;
    }

    // OpenAI / NVIDIA
    const base = provider === 'openai' ? OPENAI_BASE : NVIDIA_BASE;
    if (mode === 'chat') {
      const isOpenAIReasoning = provider === 'openai' && /^o[0-9]/i.test(id);
      const body = isOpenAIReasoning
        ? { model: id, messages: [{ role: 'user', content: 'ping' }], max_completion_tokens: 1 }
        : { model: id, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 };
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      return res.ok;
    }

    const res = await fetch(`${base}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: id, input: 'x' }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function verifyBatch<T>(items: T[], limit: number, worker: (item: T) => Promise<boolean>): Promise<Set<T>> {
  const ok = new Set<T>();
  let cursor = 0;
  let active = 0;
  return new Promise((resolve) => {
    const start = () => {
      while (active < limit && cursor < items.length) {
        const idx = cursor++;
        const item = items[idx];
        active++;
        Promise.resolve(worker(item))
          .then((succeeds) => {
            if (succeeds) ok.add(item);
          })
          .catch(() => {})
          .finally(() => {
            active--;
            if (cursor < items.length) start();
            else if (active === 0) resolve(ok);
          });
      }
      if (cursor >= items.length && active === 0) resolve(ok);
    };
    start();
  });
}

const rankChat = (id: string, provider: string) => {
  if (provider === 'gemini') {
    if (id.includes('flash')) return 0;
    if (id.includes('pro')) return 1;
    return 2;
  }
  if (provider === 'openai') {
    if (/\bmini\b/.test(id)) return 0;
    if (/\b4\.1\b|\b4o\b|\bo[0-9]/.test(id)) return 1;
    return 2;
  }
  return 0;
};

export async function GET(request: Request) {
  const provider = new URL(request.url).searchParams.get('provider') || 'gemini';

  const cached = cache[provider];
  if (cached && Date.now() - cached.at < CACHE_TTL_MS && !cached.error) {
    return NextResponse.json(
      { provider, chatModels: cached.chat, embedModels: cached.embed, error: '' },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const apiKey = getKey(provider);
  const fallback = FALLBACKS[provider] || { chat: [], embed: [] };
  if (!apiKey) {
    return NextResponse.json(
      {
        provider,
        error: `${provider} API key is not set in the server environment.`,
        chatModels: fallback.chat,
        embedModels: fallback.embed,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const available = await listAvailable(provider, apiKey);
    const concurrency = provider === 'openrouter' ? 4 : 6;
    const verifiedChat = await verifyBatch(available.chat, concurrency, (id) =>
      verifyProviderModel(provider, apiKey, id, 'chat')
    );
    const verifiedEmbed = await verifyBatch(available.embed, Math.min(2, concurrency), (id) =>
      verifyProviderModel(provider, apiKey, id, 'embed')
    );

    const chatModels = [...new Set([...fallback.chat, ...verifiedChat])].sort(
      (a, b) => rankChat(a, provider) - rankChat(b, provider) || a.localeCompare(b)
    );
    const embedModels = [...new Set([...fallback.embed, ...verifiedEmbed])];

    cache[provider] = { at: Date.now(), chat: chatModels, embed: embedModels, error: '' };
    return NextResponse.json(
      { provider, chatModels, embedModels, error: '' },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        provider,
        error: err?.message || `Failed to verify ${provider} models.`,
        chatModels: fallback.chat,
        embedModels: fallback.embed,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}