import mongoose from 'mongoose';
import { DocumentChunk } from '@/lib/models';
import { isUsingMemoryDb } from '@/lib/db';
import { MemoryDb } from '@/lib/memoryDb';
import { searchQdrantChunks, QdrantConfig } from '@/lib/vector/qdrant';

export interface RetrievedChunk {
  _id: string;
  pageUrl: string;
  content: string;
  metadata?: {
    title?: string;
    chunkIndex?: number;
    totalChunks?: number;
    charCount?: number;
  };
  score: number;
}

/**
 * Computes cosine similarity between two numeric vectors of identical dimension.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Searches vector database for top matching chunks for a given chatbot.
 * Priority order:
 * 1. Qdrant Vector Database (Cosine similarity, filtered by chatbotId)
 * 2. MongoDB Atlas $vectorSearch (if Atlas M0 vector index is configured)
 * 3. In-memory cosine similarity fallback (ensures zero downtime)
 */
export async function searchSimilarChunks(
  chatbotId: string | mongoose.Types.ObjectId,
  queryEmbedding: number[],
  topK = 4,
  config?: QdrantConfig
): Promise<RetrievedChunk[]> {
  const botIdStr = chatbotId.toString();

  // 1. Check Qdrant Vector Database first
  try {
    const qdrantResults = await searchQdrantChunks(botIdStr, queryEmbedding, topK, undefined, config);
    if (qdrantResults && qdrantResults.length > 0) {
      return qdrantResults;
    }
  } catch (err) {
    console.warn('Qdrant search fallback notice:', err instanceof Error ? err.message : err);
  }

  // 2. In-memory mode fallback
  if (isUsingMemoryDb()) {
    const chunks = MemoryDb.findDocumentChunks(botIdStr);
    if (!chunks || chunks.length === 0) return [];

    return chunks
      .map((c) => ({
        _id: c._id,
        pageUrl: c.pageUrl,
        content: c.content,
        metadata: c.metadata,
        score: cosineSimilarity(queryEmbedding, c.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  const botObjectId =
    typeof chatbotId === 'string' ? new mongoose.Types.ObjectId(chatbotId) : chatbotId;

  // 3. Try native Atlas $vectorSearch
  try {
    const pipeline = [
      {
        $vectorSearch: {
          index: 'vector_index',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: Math.max(topK * 10, 50),
          limit: topK,
          filter: {
            chatbotId: botObjectId,
          },
        },
      },
      {
        $project: {
          _id: 1,
          pageUrl: 1,
          content: 1,
          metadata: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ];

    const results = await DocumentChunk.aggregate(pipeline).exec();

    if (results && results.length > 0) {
      return results.map((r) => ({
        _id: r._id.toString(),
        pageUrl: r.pageUrl,
        content: r.content,
        metadata: r.metadata,
        score: r.score || 1.0,
      }));
    }
  } catch {
    // Continue to fallback
  }

  // 4. Fallback: In-memory cosine similarity over this bot's chunks in MongoDB
  try {
    const chunks = await DocumentChunk.find({ chatbotId: botObjectId })
      .select('pageUrl content metadata embedding')
      .lean()
      .exec();

    if (!chunks || chunks.length === 0) {
      return [];
    }

    return chunks
      .map((c: any) => ({
        _id: c._id.toString(),
        pageUrl: c.pageUrl,
        content: c.content,
        metadata: c.metadata,
        score: cosineSimilarity(queryEmbedding, c.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  } catch (fallbackErr) {
    console.error('Vector similarity fallback error:', fallbackErr);
    return [];
  }
}
