import { z } from "zod";

const ConfigSchema = z.object({
  // Only required when the real OpenRouter client is constructed, not at parse time.
  OPENROUTER_API_KEY: z.string().optional(),
  // Default is public on Hugging Face (no token needed). The code-specific
  // jina-embeddings-v2-base-code model is gated and needs an HF login.
  EMBEDDING_MODEL: z.string().default("Xenova/bge-small-en-v1.5"),
  // Remote HF model used when VERCEL=1 (onnxruntime-node can't run in serverless).
  // Requires HF_TOKEN — cloud IPs are blocked without auth on router.huggingface.co.
  HF_EMBEDDING_MODEL: z.string().default("BAAI/bge-small-en-v1.5"),
  HF_TOKEN: z.string().optional(),
  EMBEDDING_DIMENSION: z.coerce.number().int().positive().default(384),
  RAG_DATA_DIR: z.string().default(".rag-data"),
  TOP_K_DEFAULT: z.coerce.number().int().min(1).max(20).default(5),
  EVAL_K_DEFAULT: z.coerce.number().int().min(1).max(20).default(5),
});

export type Config = z.infer<typeof ConfigSchema>;

let cached: Config | null = null;

export function getConfig(): Config {
  cached ??= ConfigSchema.parse(process.env);
  return cached;
}
