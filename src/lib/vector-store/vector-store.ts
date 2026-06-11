import type { Chunk, ScoredChunk } from "@/lib/types";

export interface VectorEntry {
  chunk: Chunk;
  vector: number[];
}

export interface VectorStore {
  /** Idempotent: entries are keyed by chunk.id. */
  upsert(entries: VectorEntry[]): Promise<void>;
  /** Top-K entries by cosine similarity, descending. */
  query(vector: number[], topK: number): Promise<ScoredChunk[]>;
  /** Removes every chunk belonging to a file (re-index support). */
  deleteByFilePath(filePath: string): Promise<void>;
  listFiles(): Promise<{ filePath: string; chunkCount: number }[]>;
  clear(): Promise<void>;
  size(): Promise<number>;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) {
    throw new RangeError("Vectors must be non-empty");
  }
  if (a.length !== b.length) {
    throw new RangeError(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
