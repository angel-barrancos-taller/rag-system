import path from "node:path";

import { getConfig } from "@/lib/config";
import { TransformersEmbedder } from "@/lib/embeddings/transformers-embedder";
import type { LLMClient } from "@/lib/llm/llm-client";
import { OpenRouterClient } from "@/lib/llm/openrouter-client";
import type { RagDeps } from "@/lib/rag/pipeline";
import { JsonVectorStore } from "@/lib/vector-store/json-vector-store";

export type Services = RagDeps;

declare global {
  // Cached on globalThis so dev-mode HMR module reloads keep the same
  // store instance and loaded embedding model across requests.
  var __ragServices: Services | undefined;
}

export function getServices(): Services {
  globalThis.__ragServices ??= createServices();
  return globalThis.__ragServices;
}

/** Replaces the wired services with fakes; pass null to reset. */
export function setServicesForTesting(services: Services | null): void {
  globalThis.__ragServices = services ?? undefined;
}

function createServices(): Services {
  const config = getConfig();
  return {
    embedder: new TransformersEmbedder(
      config.EMBEDDING_MODEL,
      config.EMBEDDING_DIMENSION,
      config.RAG_DATA_DIR,
    ),
    store: new JsonVectorStore(path.join(config.RAG_DATA_DIR, "index.json"), {
      modelId: config.EMBEDDING_MODEL,
      dimension: config.EMBEDDING_DIMENSION,
    }),
    llm: lazyLLMClient(() => new OpenRouterClient(config.OPENROUTER_API_KEY)),
  };
}

/**
 * Defers LLM client construction to the first completion call: indexing
 * never touches the LLM, so it must work without an OPENROUTER_API_KEY.
 */
function lazyLLMClient(create: () => LLMClient): LLMClient {
  let client: LLMClient | undefined;
  return {
    async complete(request) {
      client ??= create();
      return client.complete(request);
    },
  };
}
