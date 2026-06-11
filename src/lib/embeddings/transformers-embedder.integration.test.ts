/**
 * Opt-in integration test: downloads the real embedding model (~150MB on
 * first run) and verifies real semantic similarity. Run with:
 *   pnpm test:integration
 */
import os from "node:os";
import path from "node:path";

import { getConfig } from "@/lib/config";
import { cosineSimilarity } from "@/lib/vector-store/vector-store";

import { TransformersEmbedder } from "./transformers-embedder";

const describeIntegration = process.env.RUN_INTEGRATION
  ? describe
  : describe.skip;

describeIntegration("TransformersEmbedder (integration)", () => {
  jest.setTimeout(300_000);

  it("embeds code and ranks similar snippets above dissimilar ones", async () => {
    const config = getConfig();
    const embedder = new TransformersEmbedder(
      config.EMBEDDING_MODEL,
      config.EMBEDDING_DIMENSION,
      path.join(os.tmpdir(), "rag-system-integration"),
    );

    const [query, related, unrelated] = await embedder.embed([
      "how is the shopping cart total calculated?",
      "getTotal() { return this.items.reduce((sum, i) => sum + i.price * i.quantity, 0); }",
      "function parseXmlNamespace(doc: XMLDocument): string { return doc.documentElement.namespaceURI; }",
    ]);

    expect(query).toHaveLength(config.EMBEDDING_DIMENSION);
    expect(cosineSimilarity(query, related)).toBeGreaterThan(
      cosineSimilarity(query, unrelated),
    );
  });
});
