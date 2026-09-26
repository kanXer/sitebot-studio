export interface Chunk {
  content: string;
  chunkIndex: number;
  totalChunks?: number;
  charCount: number;
}

/**
 * Splits text into ~950 character chunks with ~150 character overlap,
 * breaking on sentence or paragraph boundaries.
 */
export function chunkText(
  text: string,
  targetChunkSize = 950,
  overlap = 150
): Chunk[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  if (clean.length <= targetChunkSize) {
    return [
      {
        content: clean,
        chunkIndex: 0,
        totalChunks: 1,
        charCount: clean.length,
      },
    ];
  }

  const chunks: Chunk[] = [];
  let startIndex = 0;
  let chunkIdx = 0;

  while (startIndex < clean.length) {
    let endIndex = startIndex + targetChunkSize;

    if (endIndex >= clean.length) {
      endIndex = clean.length;
    } else {
      // Find a clean boundary (sentence end or space)
      const lookbackWindow = Math.min(150, targetChunkSize / 2);
      const windowStart = endIndex - lookbackWindow;
      const slice = clean.slice(windowStart, endIndex + 50);

      // Look for sentence terminators first
      const sentenceMatch = slice.search(/[.!?]\s+/);
      if (sentenceMatch !== -1 && windowStart + sentenceMatch + 1 > startIndex + 200) {
        endIndex = windowStart + sentenceMatch + 1;
      } else {
        // Fallback to last space
        const lastSpace = clean.lastIndexOf(' ', endIndex);
        if (lastSpace > startIndex + 200) {
          endIndex = lastSpace;
        }
      }
    }

    const chunkContent = clean.slice(startIndex, endIndex).trim();
    if (chunkContent.length > 30) {
      chunks.push({
        content: chunkContent,
        chunkIndex: chunkIdx++,
        charCount: chunkContent.length,
      });
    }

    if (endIndex >= clean.length) {
      break;
    }

    // Step forward by chunkSize minus overlap
    startIndex = Math.max(endIndex - overlap, startIndex + 100);
  }

  // Add total count
  return chunks.map((c) => ({
    ...c,
    totalChunks: chunks.length,
  }));
}
