import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Generates 768-dimensional embeddings using Google Gemini gemini-embedding-001.
 */
export async function getGeminiEmbedding(
  text: string,
  apiKey: string,
  modelName = 'gemini-embedding-001'
): Promise<number[]> {
  if (!apiKey) {
    throw new Error('Gemini API key is required to generate embeddings.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName.trim().toLowerCase() });

  const response = await model.embedContent(text);
  const values = response.embedding.values;

  if (!values || values.length === 0) {
    throw new Error('Failed to generate embedding: empty values returned.');
  }

  return values;
}

/**
 * Generates 768-dimensional embeddings using OpenAI text-embedding-3-small.
 */
async function getOpenAICompatibleEmbedding(
  endpointUrl: string,
  apiKey: string,
  modelName: string,
  label: string,
  text: string
): Promise<number[]> {
  const options = (body: Record<string, unknown>) => ({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  // Prefer 768-dim output so embeddings match the app's Qdrant collection. If the
  // model rejects `dimensions` (some 3rd-party models), retry without it — but only
  // accept the result if it is actually 768-dimensional.
  for (const body of [
    { input: text, model: modelName, dimensions: 768 },
    { input: text, model: modelName },
  ]) {
    const res = await fetch(endpointUrl, options(body));
    if (!res.ok) continue;
    const data = await res.json();
    const values: number[] | undefined = data?.data?.[0]?.embedding;
    if (Array.isArray(values) && values.length === 768) return values;
  }

  const last = await fetch(endpointUrl, options({ input: text, model: modelName }));
  const raw = last.ok ? await last.text() : '';
  throw new Error(
    `${label} embedding failed (${last.status}): ${raw || 'no 768-dim embedding returned'}`
  );
}

export async function getOpenAIEmbedding(
  text: string,
  apiKey: string,
  modelName = 'text-embedding-3-small'
): Promise<number[]> {
  if (!apiKey) {
    throw new Error('OpenAI API key is required to generate embeddings.');
  }
  return getOpenAICompatibleEmbedding(
    'https://api.openai.com/v1/embeddings',
    apiKey,
    modelName,
    'OpenAI',
    text
  );
}

export async function getOpenRouterEmbedding(
  text: string,
  apiKey: string,
  modelName = 'openai/text-embedding-3-small'
): Promise<number[]> {
  if (!apiKey) {
    throw new Error('OpenRouter API key is required to generate embeddings.');
  }
  return getOpenAICompatibleEmbedding(
    'https://openrouter.ai/api/v1/embeddings',
    apiKey,
    modelName,
    'OpenRouter',
    text
  );
}

const VERIFIED_NVIDIA_EMBED_MODEL = 'nvidia/llama-nemotron-embed-vl-1b-v2';

export function resolveNvidiaEmbedModel(model?: string): string {
  if (!model) return VERIFIED_NVIDIA_EMBED_MODEL;
  // If deprecated or 404-prone model name was provided, map to verified working model
  if (
    model.includes('llama-3.2-nv-embedqa-1b-v1') ||
    model.includes('llama-3.2-nv-embedqa') ||
    model.trim() === ''
  ) {
    return VERIFIED_NVIDIA_EMBED_MODEL;
  }
  return model;
}

/**
 * Generates embeddings using NVIDIA NIM API (default: nvidia/llama-nemotron-embed-vl-1b-v2)
 */
export async function getNvidiaEmbedding(
  text: string,
  apiKey: string,
  modelName = VERIFIED_NVIDIA_EMBED_MODEL
): Promise<number[]> {
  if (!apiKey) {
    throw new Error('NVIDIA NIM API key is required to generate embeddings.');
  }

  let targetModel = resolveNvidiaEmbedModel(modelName);

  let res = await fetch('https://integrate.api.nvidia.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: [text],
      model: targetModel,
      input_type: 'query',
    }),
  });

  // If 404 or not found for account, fallback to verified model if not already using it
  if (!res.ok && res.status === 404 && targetModel !== VERIFIED_NVIDIA_EMBED_MODEL) {
    console.warn(`NVIDIA model ${targetModel} returned 404. Falling back to ${VERIFIED_NVIDIA_EMBED_MODEL}`);
    targetModel = VERIFIED_NVIDIA_EMBED_MODEL;
    res = await fetch('https://integrate.api.nvidia.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: [text],
        model: targetModel,
        input_type: 'query',
      }),
    });
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`NVIDIA NIM embedding failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const embedding = data.data?.[0]?.embedding;
  if (!embedding || embedding.length === 0) {
    throw new Error('Empty embedding vector returned from NVIDIA NIM.');
  }
  return embedding;
}

/**
 * Batched embedding generation with throttling.
 */
export async function getBatchEmbeddings(
  texts: string[],
  provider: 'gemini' | 'openai' | 'openrouter' | 'nvidia',
  apiKey: string,
  modelName?: string,
  batchSize = 5,
  delayMs = 350
): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  if (provider === 'nvidia') {
    let targetModel = resolveNvidiaEmbedModel(modelName);

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      let res = await fetch('https://integrate.api.nvidia.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          input: batch,
          model: targetModel,
          input_type: 'passage',
        }),
      });

      // If 404, fallback to verified model
      if (!res.ok && res.status === 404 && targetModel !== VERIFIED_NVIDIA_EMBED_MODEL) {
        console.warn(`NVIDIA batch model ${targetModel} returned 404. Falling back to ${VERIFIED_NVIDIA_EMBED_MODEL}`);
        targetModel = VERIFIED_NVIDIA_EMBED_MODEL;
        res = await fetch('https://integrate.api.nvidia.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            input: batch,
            model: targetModel,
            input_type: 'passage',
          }),
        });
      }

      if (!res.ok) {
        throw new Error(`NVIDIA NIM batch embedding failed: ${await res.text()}`);
      }

      const data = await res.json();
      allEmbeddings.push(...data.data.map((d: any) => d.embedding));

      if (i + batchSize < texts.length) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    return allEmbeddings;
  }

  if (provider === 'openai') {
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          input: batch,
          model: modelName || 'text-embedding-3-small',
          dimensions: 768,
        }),
      });

      if (!res.ok) {
        throw new Error(`OpenAI batch embedding failed: ${await res.text()}`);
      }

      const data = await res.json();
      allEmbeddings.push(...data.data.map((d: any) => d.embedding));

      if (i + batchSize < texts.length) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    return allEmbeddings;
  }

  // Default: Gemini
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: (modelName || 'gemini-embedding-001').trim().toLowerCase() });

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchPromises = batch.map(async (text) => {
      try {
        const res = await model.embedContent(text);
        return res.embedding.values;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 800));
        const res = await model.embedContent(text);
        return res.embedding.values;
      }
    });

    const results = await Promise.all(batchPromises);
    allEmbeddings.push(...results);

    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return allEmbeddings;
}

/**
 * Generic embedding dispatcher supporting Gemini, OpenAI, NVIDIA, and OpenRouter.
 */
export async function generateEmbedding(
  text: string,
  provider: 'gemini' | 'openrouter' | 'openai' | 'nvidia' | string,
  apiKey: string,
  modelName?: string
): Promise<number[]> {
  if (provider === 'nvidia') {
    return getNvidiaEmbedding(text, apiKey, modelName || VERIFIED_NVIDIA_EMBED_MODEL);
  }

  if (provider === 'openai') {
    return getOpenAIEmbedding(text, apiKey, modelName || 'text-embedding-3-small');
  }

  if (provider === 'openrouter') {
    return getOpenRouterEmbedding(text, apiKey, modelName || 'openai/text-embedding-3-small');
  }

  return getGeminiEmbedding(text, apiKey, modelName || 'gemini-embedding-001');
}
