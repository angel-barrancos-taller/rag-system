import type { Embedder } from "./embedder";

// OpenAI-compatible embeddings endpoint on the HF router.
// Supports a much wider model catalog than the /pipeline/feature-extraction path.
const HF_BASE = "https://router.huggingface.co/hf-inference/models";
const BATCH_SIZE = 32;

interface EmbeddingsResponse {
  data: Array<{ embedding: number[] }>;
}

function l2Normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

/**
 * Embedder backed by the Hugging Face Inference API (OpenAI-compatible endpoint).
 * Used in serverless environments (Vercel) where onnxruntime-node's native
 * binaries can't be resolved. HF_TOKEN is required to avoid rate limits.
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

    const response = await fetch(`${HF_BASE}/${this.modelId}/v1/embeddings`, {
      method: "POST",
      headers,
      body: JSON.stringify({ input: inputs, model: this.modelId }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`HF Inference API error ${response.status}: ${text}`);
    }

    const json: EmbeddingsResponse = await response.json();
    return json.data.map((item) => l2Normalize(item.embedding));
  }
}
