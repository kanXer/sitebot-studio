import { QdrantClient } from '@qdrant/js-client-rest';
import crypto from 'crypto';

export const QDRANT_COLLECTION = 'sitebot_chunks';
export const VECTOR_DIMENSIONS = 768;

let qdrantClientInstance: QdrantClient | null = null;

export interface QdrantConfig {
  enabled?: boolean;
  url?: string;
  apiKey?: string;
  collectionName?: string;
}

export function isQdrantConfigured(config?: QdrantConfig): boolean {
  if (config?.enabled && config?.url) {
    const customUrl = config.url.trim();
    return (
      (customUrl.startsWith('http://') || customUrl.startsWith('https://')) &&
      !customUrl.includes('xyz-example') &&
      !customUrl.includes('dummy')
    );
  }

  const url = process.env.QDRANT_URL;
  return Boolean(
    url &&
      !url.includes('xyz-example') &&
      !url.includes('dummy') &&
      (url.startsWith('http://') || url.startsWith('https://'))
  );
}

export function getQdrantClient(config?: QdrantConfig): QdrantClient | null {
  // If custom configuration is provided and enabled with a valid URL
  if (config?.enabled && config?.url) {
    const customUrl = config.url.trim();
    if (customUrl.startsWith('http://') || customUrl.startsWith('https://')) {
      return new QdrantClient({
        url: customUrl,
        apiKey: config.apiKey?.trim() || undefined,
        checkCompatibility: false,
      });
    }
  }

  // Fallback to default server environment Qdrant
  if (!isQdrantConfigured()) {
    return null;
  }

  if (!qdrantClientInstance) {
    qdrantClientInstance = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      checkCompatibility: false,
    });
  }

  return qdrantClientInstance;
}

/**
 * Tests connection to a custom Qdrant cluster URL and API key.
 */
export async function testQdrantConnection(
  url: string,
  apiKey?: string
): Promise<{ success: boolean; message: string; collectionsCount?: number }> {
  try {
    const cleanUrl = url?.trim();
    if (!cleanUrl || (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://'))) {
      return {
        success: false,
        message: 'Invalid URL format. Please provide a valid Qdrant URL starting with https:// or http://',
      };
    }

    const testClient = new QdrantClient({
      url: cleanUrl,
      apiKey: apiKey?.trim() || undefined,
      checkCompatibility: false,
    });

    const collectionsResult = await testClient.getCollections();
    const count = collectionsResult?.collections?.length ?? 0;

    return {
      success: true,
      message: `Successfully connected to Qdrant cluster! Found ${count} collection(s).`,
      collectionsCount: count,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to connect to Qdrant. Verify your URL and API Key.',
    };
  }
}

/**
 * Ensures the Qdrant vector collection exists with specified dimensions and Cosine distance.
 */
export async function ensureQdrantCollection(
  collectionName = QDRANT_COLLECTION,
  dimensions = VECTOR_DIMENSIONS,
  config?: QdrantConfig
): Promise<boolean> {
  const client = getQdrantClient(config);
  if (!client) return false;

  try {
    const existsResult = await client.collectionExists(collectionName);
    const exists = typeof existsResult === 'boolean' ? existsResult : (existsResult as any)?.exists;

    if (!exists) {
      await client.createCollection(collectionName, {
        vectors: {
          size: dimensions,
          distance: 'Cosine',
        },
      });

      try {
        await client.createPayloadIndex(collectionName, {
          field_name: 'chatbotId',
          field_schema: 'keyword',
        });
      } catch {
        // Index might already exist
      }
    }

    return true;
  } catch (error) {
    console.warn('Qdrant collection setup notice:', error instanceof Error ? error.message : error);
    return false;
  }
}

export interface QdrantChunkInput {
  chatbotId: string;
  pageUrl: string;
  content: string;
  embedding: number[];
  metadata?: any;
}

export function getCollectionName(dim?: number, customPrefix?: string): string {
  const base = customPrefix?.trim() || QDRANT_COLLECTION;
  if (!dim || dim === 768) return base;
  return `${base}_${dim}`;
}

/**
 * Upserts chunk vectors and payload metadata into Qdrant (using custom config if provided).
 */
export async function upsertQdrantChunks(
  chunks: QdrantChunkInput[],
  collectionName?: string,
  config?: QdrantConfig
): Promise<boolean> {
  const client = getQdrantClient(config);
  if (!client || chunks.length === 0) return false;

  try {
    const dim = chunks[0]?.embedding?.length || VECTOR_DIMENSIONS;
    const targetCollection =
      collectionName || config?.collectionName || getCollectionName(dim, config?.collectionName);
    await ensureQdrantCollection(targetCollection, dim, config);

    const points = chunks.map((chunk) => ({
      id: crypto.randomUUID(),
      vector: chunk.embedding,
      payload: {
        chatbotId: chunk.chatbotId.toString(),
        pageUrl: chunk.pageUrl,
        content: chunk.content,
        metadata: chunk.metadata || {},
        createdAt: new Date().toISOString(),
      },
    }));

    await client.upsert(targetCollection, {
      wait: true,
      points,
    });

    return true;
  } catch (err) {
    console.warn('Qdrant upsert notice:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Searches Qdrant for top matching chunks for a specific chatbot using client.query.
 */
export async function searchQdrantChunks(
  chatbotId: string,
  queryVector: number[],
  topK = 4,
  collectionName?: string,
  config?: QdrantConfig
): Promise<Array<{
  _id: string;
  pageUrl: string;
  content: string;
  metadata?: any;
  score: number;
}> | null> {
  const client = getQdrantClient(config);
  if (!client) return null;

  try {
    const dim = queryVector.length || VECTOR_DIMENSIONS;
    const targetCollection =
      collectionName || config?.collectionName || getCollectionName(dim, config?.collectionName);
    await ensureQdrantCollection(targetCollection, dim, config);

    const results = await client.query(targetCollection, {
      query: queryVector,
      limit: topK,
      filter: {
        must: [
          {
            key: 'chatbotId',
            match: {
              value: chatbotId.toString(),
            },
          },
        ],
      },
    });

    const points = (results as any)?.points || results;

    if (!Array.isArray(points) || points.length === 0) {
      return [];
    }

    return points.map((r: any) => ({
      _id: String(r.id),
      pageUrl: String(r.payload?.pageUrl || ''),
      content: String(r.payload?.content || ''),
      metadata: r.payload?.metadata || {},
      score: typeof r.score === 'number' ? r.score : 1.0,
    }));
  } catch (err) {
    console.warn('Qdrant search query notice:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Deletes all vectors belonging to a chatbot from Qdrant.
 */
export async function deleteQdrantBotChunks(
  chatbotId: string,
  collectionName = QDRANT_COLLECTION,
  config?: QdrantConfig
): Promise<boolean> {
  const client = getQdrantClient(config);
  if (!client) return false;

  try {
    const baseCol = config?.collectionName || collectionName;
    const collectionsToDelete = [
      baseCol,
      `${baseCol}_2048`,
      `${baseCol}_1024`,
      `${baseCol}_1536`,
    ];

    for (const col of collectionsToDelete) {
      try {
        const existsRes = await client.collectionExists(col);
        const exists = typeof existsRes === 'boolean' ? existsRes : (existsRes as any)?.exists;
        if (exists) {
          await client.delete(col, {
            filter: {
              must: [
                {
                  key: 'chatbotId',
                  match: {
                    value: chatbotId.toString(),
                  },
                },
              ],
            },
          });
        }
      } catch {}
    }
    return true;
  } catch (err) {
    console.warn('Qdrant delete notice:', err instanceof Error ? err.message : err);
    return false;
  }
}
