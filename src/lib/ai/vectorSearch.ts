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

function extractHighIntentKeywords(query: string): string[] {
  if (!query || typeof query !== 'string') return [];
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'to', 'from', 'in', 'out',
    'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here',
    'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each',
    'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will',
    'just', 'should', 'now', 'what', 'who', 'whom', 'this', 'that', 'these',
    'those', 'tell', 'show', 'give', 'know', 'please', 'help', 'about',
    'with', 'for', 'by', 'at', 'of', 'me', 'us', 'him', 'her', 'them',
  ]);

  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  return Array.from(new Set(words));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Searches vector database for top matching chunks for a given chatbot.
 * Priority order:
 * 1. Hybrid Qdrant + Keyword matching
 * 2. MongoDB Atlas $vectorSearch + Keyword matching
 * 3. In-memory cosine similarity + Keyword matching fallback
 */
export async function searchSimilarChunks(
  chatbotId: string | mongoose.Types.ObjectId,
  queryEmbedding: number[],
  topK = 8,
  config?: QdrantConfig,
  queryText?: string
): Promise<RetrievedChunk[]> {
  const botIdStr = chatbotId.toString();
  const keywords = queryText ? extractHighIntentKeywords(queryText) : [];
  const hasHighIntentEntity = keywords.some((k) =>
    /(founder|founders|founded|founding|ceo|cto|owner|creator|leader|leadership|executive|director|history|background|team|pricing|price|cost|contact|about|started|established)/i.test(k)
  );

  // Helper to merge and rank vector results with keyword matches
  const mergeWithKeywords = (
    vectorResults: RetrievedChunk[],
    keywordResults: RetrievedChunk[]
  ): RetrievedChunk[] => {
    const mergedMap = new Map<string, RetrievedChunk>();
    for (const c of [...vectorResults, ...keywordResults]) {
      const key = c._id || c.content.slice(0, 100);
      const existing = mergedMap.get(key);
      if (!existing || c.score > existing.score) {
        mergedMap.set(key, c);
      }
    }
    return Array.from(mergedMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  };

  // 1. In-memory mode fallback
  if (isUsingMemoryDb()) {
    const chunks = MemoryDb.findDocumentChunks(botIdStr);
    if (!chunks || chunks.length === 0) return [];

    const scored = chunks.map((c) => {
      let score = cosineSimilarity(queryEmbedding, c.embedding);
      if (keywords.length > 0) {
        const textLower = (c.content + ' ' + (c.metadata?.title || '')).toLowerCase();
        let matches = 0;
        for (const kw of keywords) {
          if (textLower.includes(kw)) matches++;
        }
        if (matches > 0) {
          score = Math.max(score + 0.15 * Math.min(matches, 3), hasHighIntentEntity ? 0.45 : 0.35);
        }
      }
      return {
        _id: c._id,
        pageUrl: c.pageUrl,
        content: c.content,
        metadata: c.metadata,
        score,
      };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  const botObjectId =
    typeof chatbotId === 'string' ? new mongoose.Types.ObjectId(chatbotId) : chatbotId;

  let vectorResults: RetrievedChunk[] = [];

  // 2. Check Qdrant Vector Database first
  try {
    const qdrantResults = await searchQdrantChunks(botIdStr, queryEmbedding, topK, undefined, config);
    if (qdrantResults && qdrantResults.length > 0) {
      vectorResults = qdrantResults;
    }
  } catch (err) {
    console.warn('Qdrant search fallback notice:', err instanceof Error ? err.message : err);
  }

  // 3. Try native Atlas $vectorSearch if Qdrant didn't return results
  if (vectorResults.length === 0) {
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
        vectorResults = results.map((r) => ({
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
  }

  // 4. Fallback: In-memory cosine similarity over this bot's chunks in MongoDB if needed
  if (vectorResults.length === 0) {
    try {
      const chunks = await DocumentChunk.find({ chatbotId: botObjectId })
        .select('pageUrl content metadata embedding')
        .lean()
        .exec();

      if (chunks && chunks.length > 0) {
        vectorResults = chunks
          .map((c: any) => ({
            _id: c._id.toString(),
            pageUrl: c.pageUrl,
            content: c.content,
            metadata: c.metadata,
            score: cosineSimilarity(queryEmbedding, c.embedding),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, topK);
      }
    } catch (fallbackErr) {
      console.error('Vector similarity fallback error:', fallbackErr);
    }
  }

  // 5. Keyword search overlay: guarantee high-intent terms (e.g. founder, CEO, pricing) are retrieved
  if (keywords.length > 0) {
    try {
      const keywordRegex = new RegExp(keywords.map(escapeRegex).join('|'), 'i');
      const keywordDocs = await DocumentChunk.find({
        chatbotId: botObjectId,
        $or: [
          { content: { $regex: keywordRegex } },
          { 'metadata.title': { $regex: keywordRegex } },
        ],
      })
        .select('pageUrl content metadata embedding')
        .limit(6)
        .lean()
        .exec();

      if (keywordDocs && keywordDocs.length > 0) {
        const keywordChunks: RetrievedChunk[] = keywordDocs.map((doc: any) => {
          let score = Array.isArray(doc.embedding) && doc.embedding.length > 0
            ? cosineSimilarity(queryEmbedding, doc.embedding)
            : 0.35;

          const textLower = (doc.content + ' ' + (doc.metadata?.title || '')).toLowerCase();
          let matches = 0;
          for (const kw of keywords) {
            if (textLower.includes(kw)) matches++;
          }
          if (matches > 0) {
            score = Math.max(score + 0.15 * Math.min(matches, 3), hasHighIntentEntity ? 0.45 : 0.35);
          }

          return {
            _id: doc._id.toString(),
            pageUrl: doc.pageUrl,
            content: doc.content,
            metadata: doc.metadata,
            score,
          };
        });

        return mergeWithKeywords(vectorResults, keywordChunks);
      }
    } catch (kwErr) {
      console.warn('Hybrid keyword search notice:', kwErr);
    }
  }

  return vectorResults;
}
