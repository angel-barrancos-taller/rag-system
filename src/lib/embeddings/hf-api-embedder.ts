import type { Embedder } from "./embedder";

// HF migrated the Inference API to router.huggingface.co in 2025.
// The old api-inference.huggingface.co domain is no longer reliably reachable.
const HF_API =
  "https://router.huggingface.co/hf-inference/pipeline/feature-extraction";
const BATCH_SIZE = 32;

function l2Normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

/**
 * Embedder backed by the Hugging Face Inference API.
 * Used in serverless environments (Vercel) where onnxruntime-node's native
 * binaries can't be resolved. HF_TOKEN is optional for public models but
 * avoids rate limits.
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

    const response = await fetch(`${HF_API}/${this.modelId}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ inputs, options: { wait_for_model: true } }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`HF Inference API error ${response.status}: ${text}`);
    }

    // The feature-extraction pipeline returns [batch, dim] for sentence
    // transformers that already apply pooling, or [batch, seq_len, dim] for
    // token-level models. Handle both by mean-pooling if needed.
    const raw: number[][] | number[][][] = await response.json();
    return (raw as (number[] | number[][])[]).map((item) => {
      const vec: number[] = Array.isArray(item[0])
        ? meanPool(item as number[][])
        : (item as number[]);
      return l2Normalize(vec);
    });
  }
}

function meanPool(tokenVectors: number[][]): number[] {
  const dim = tokenVectors[0].length;
  const sum = new Array<number>(dim).fill(0);
  for (const v of tokenVectors) {
    for (let i = 0; i < dim; i++) sum[i] += v[i];
  }
  return sum.map((x) => x / tokenVectors.length);
}
