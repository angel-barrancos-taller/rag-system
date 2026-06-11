import path from "node:path";

import { env, pipeline } from "@huggingface/transformers";

import type { Embedder } from "./embedder";

type FeatureExtraction = (
  texts: string[],
  opts: { pooling: "mean"; normalize: boolean },
) => Promise<{ tolist(): number[][] }>;

const BATCH_SIZE = 8;

declare global {
  // Cached on globalThis so dev-mode HMR module reloads don't re-download the model.
  var __ragEmbedPipeline: Promise<FeatureExtraction> | undefined;
}

/**
 * Local embeddings via transformers.js (ONNX). The model (~150MB) is
 * downloaded once into `${dataDir}/models` and loaded once per process.
 */
export class TransformersEmbedder implements Embedder {
  constructor(
    readonly modelId: string,
    readonly dimension: number,
    private readonly dataDir: string,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const extract = await this.getPipeline();

    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const output = await extract(batch, { pooling: "mean", normalize: true });
      vectors.push(...output.tolist());
    }

    if (vectors[0]?.length !== this.dimension) {
      throw new Error(
        `Model ${this.modelId} produced ${vectors[0]?.length}-dim vectors, expected ${this.dimension}. ` +
          "Update EMBEDDING_DIMENSION to match the model.",
      );
    }
    return vectors;
  }

  private getPipeline(): Promise<FeatureExtraction> {
    globalThis.__ragEmbedPipeline ??= (async () => {
      env.cacheDir = path.join(this.dataDir, "models");
      const extractor = await pipeline("feature-extraction", this.modelId, {
        dtype: "q8",
      });
      return extractor as unknown as FeatureExtraction;
    })();
    return globalThis.__ragEmbedPipeline;
  }
}
