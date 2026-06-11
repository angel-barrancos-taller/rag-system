export type ChunkKind = "function" | "class" | "method" | "file" | "window";

export interface Chunk {
  /** Stable identity: `${filePath}#${name}` */
  id: string;
  filePath: string;
  content: string;
  /** 1-based, inclusive */
  startLine: number;
  /** 1-based, inclusive */
  endLine: number;
  /** "Cart.addItem", "formatPrice", "file", "window-2" */
  name: string;
  kind: ChunkKind;
}

export interface ScoredChunk extends Chunk {
  /** Cosine similarity in [-1, 1] */
  score: number;
}

export interface SourceRef {
  filePath: string;
  snippet: string;
  lines: { start: number; end: number };
  score: number;
  chunkId: string;
}

export interface QueryResult {
  answer: string;
  sources: SourceRef[];
}
