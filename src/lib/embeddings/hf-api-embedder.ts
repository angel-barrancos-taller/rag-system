import type { Embedder } from "./embedder";

// HF Inference router, feature-extraction pipeline. The model must come first
// in the path; the /pipeline/feature-extraction suffix forces the right task
// (the bare /models/{id} path defaults to sentence-similarity for ST models).
const HF_BASE = "https://router.huggingface.co/hf-inference/models";
const BATCH_SIZE = 32;

function l2Normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

function meanPool(tokenVectors: number[][]): number[] {
  const dim = tokenVectors[0].length;
  const sum = new Array<number>(dim).fill(0);
  for (const v of tokenVectors) {
    for (let i = 0; i < dim; i++) sum[i] += v[i];
  }
  return sum.map((x) => x / tokenVectors.length);
}

/**
 * Embedder backed by the Hugging Face Inference API.
 * Used in serverless environments (Vercel) where onnxruntime-node's native
 * binaries can't be resolved. HF_TOKEN is required (cloud IPs are rate-limited).
 */
export class HuggingFaceApiEmbedder implements Embedder {
  constructor(
    readonly modelId: string,
    readonly dimension: number,
    private readonly hfToken?: string,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      results.push(...(await this.fetchBatch(batch)));
    }
    return results;
  }

  private async fetchBatch(inputs: string[]): Promise<number[][]> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.hfToken) headers["Authorization"] = `Bearer ${this.hfToken}`;

    const response = await fetch(
      `${HF_BASE}/${this.modelId}/pipeline/feature-extraction`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ inputs }),
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`HF Inference API error ${response.status}: ${text}`);
    }

    // Sentence-transformer / BGE models return [batch, dim] (already pooled).
    // Token-level models return [batch, seq_len, dim]; mean-pool those.
    const raw = (await response.json()) as (number[] | number[][])[];
    return raw.map((item) => {
      const vec = Array.isArray(item[0])
        ? meanPool(item as number[][])
        : (item as number[]);
      return l2Normalize(vec);
    });
  }
}
