import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Generates 768-dimensional embeddings using Google Gemini text-embedding-004.
 */
export async function getGeminiEmbedding(
  text: string,
  apiKey: string,
  modelName = 'text-embedding-004'
): Promise<number[]> {
  if (!apiKey) {
    throw new Error('Gemini API key is required to generate embeddings.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

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
export async function getOpenAIEmbedding(
  text: string,
  apiKey: string,
  modelName = 'text-embedding-3-small'
): Promise<number[]> {
  if (!apiKey) {
    throw new Error('OpenAI API key is required to generate embeddings.');
  }

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: text,
      model: modelName,
      dimensions: 768,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI embedding failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
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
  const model = genAI.getGenerativeModel({ model: modelName || 'text-embedding-004' });

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

  return getGeminiEmbedding(text, apiKey, modelName || 'text-embedding-004');
}
