export interface Embedder {
  /** One L2-normalized vector per input text. */
  embed(texts: string[]): Promise<number[][]>;
  readonly dimension: number;
  readonly modelId: string;
}

/**
 * Deterministic test embedder: hashes each word into a fixed-dimension
 * bag-of-words vector and L2-normalizes it. Texts sharing words therefore
 * score genuinely higher cosine similarity, which lets retrieval tests
 * assert real ranking behavior without a model.
 */
export class FakeEmbedder implements Embedder {
  readonly modelId = "fake-embedder";

  constructor(readonly dimension = 128) {}

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.embedOne(text));
  }

  private embedOne(text: string): number[] {
    const vector = new Array<number>(this.dimension).fill(0);
    // Split camelCase before lowercasing so "getCartTotal" shares the
    // tokens "cart" and "total" with natural-language questions.
    const words = text
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .split(/\W+/)
      .filter(Boolean);
    for (const word of words) {
      vector[hash(word) % this.dimension] += 1;
    }
    const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
    return norm === 0 ? vector : vector.map((x) => x / norm);
  }
}

/** FNV-1a string hash — stable across runs and platforms. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
