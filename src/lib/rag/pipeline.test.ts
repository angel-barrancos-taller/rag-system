import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { FakeEmbedder } from "@/lib/embeddings/embedder";
import { FakeLLMClient } from "@/lib/llm/llm-client";
import { JsonVectorStore } from "@/lib/vector-store/json-vector-store";

import { answerQuestion, indexFiles } from "./pipeline";

const CART_FILE = {
  path: "src/cart.ts",
  content: [
    "export function getCartTotal(items: { price: number; quantity: number }[]): number {",
    "  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);",
    "}",
    "",
    "export function clearCart(items: unknown[]): void {",
    "  items.length = 0;",
    "}",
  ].join("\n"),
};

const XML_FILE = {
  path: "src/xml.ts",
  content: [
    "export function parseXmlNamespace(doc: string): string {",
    "  return doc.split('xmlns=')[1] ?? '';",
    "}",
  ].join("\n"),
};

async function makeDeps() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rag-pipeline-"));
  const embedder = new FakeEmbedder();
  const store = new JsonVectorStore(path.join(dir, "index.json"), {
    modelId: embedder.modelId,
    dimension: embedder.dimension,
  });
  return { embedder, store, llm: new FakeLLMClient(["the answer"]) };
}

describe("indexFiles", () => {
  it("chunks, embeds and stores files, reporting counts per file", async () => {
    const deps = await makeDeps();

    const result = await indexFiles(deps, [CART_FILE, XML_FILE]);

    expect(result.filesIndexed).toBe(2);
    expect(result.chunksIndexed).toBe(3); // getCartTotal, clearCart, parseXmlNamespace
    expect(result.perFile).toEqual([
      { path: "src/cart.ts", chunks: 2 },
      { path: "src/xml.ts", chunks: 1 },
    ]);
    expect(await deps.store.size()).toBe(3);
  });

  it("re-indexing a changed file replaces its chunks instead of accumulating", async () => {
    const deps = await makeDeps();
    await indexFiles(deps, [CART_FILE]);

    const changed = {
      path: "src/cart.ts",
      content: "export function onlyOne(): number { return 1; }",
    };
    await indexFiles(deps, [changed]);

    expect(await deps.store.size()).toBe(1);
    const [only] = await deps.store.query(
      (await deps.embedder.embed(["onlyOne"]))[0],
      5,
    );
    expect(only.id).toBe("src/cart.ts#onlyOne");
  });
});

describe("answerQuestion", () => {
  it("retrieves the most relevant chunks and returns the LLM answer with sources", async () => {
    const deps = await makeDeps();
    await indexFiles(deps, [CART_FILE, XML_FILE]);

    const result = await answerQuestion(
      deps,
      "how is the cart total calculated from price and quantity?",
      2,
    );

    expect(result.answer).toBe("the answer");
    expect(result.sources).toHaveLength(2);
    // FakeEmbedder shares words ("cart", "total", "price", "quantity") with getCartTotal
    expect(result.sources[0].chunkId).toBe("src/cart.ts#getCartTotal");
    expect(result.sources[0].lines).toEqual({ start: 1, end: 3 });
    expect(result.sources[0].snippet).toContain("item.price * item.quantity");
    // sorted by score, descending
    expect(result.sources[0].score).toBeGreaterThanOrEqual(
      result.sources[1].score,
    );
  });

  it("sends the question and every retrieved snippet to the LLM", async () => {
    const deps = await makeDeps();
    await indexFiles(deps, [CART_FILE]);

    await answerQuestion(deps, "what does getCartTotal do?", 2);

    const llm = deps.llm;
    expect(llm.calls).toHaveLength(1);
    const prompt = llm.calls[0].user;
    expect(prompt).toContain("what does getCartTotal do?");
    expect(prompt).toContain("src/cart.ts:1-3");
    expect(prompt).toContain("items.reduce");
  });

  it("respects topK", async () => {
    const deps = await makeDeps();
    await indexFiles(deps, [CART_FILE, XML_FILE]);

    const result = await answerQuestion(deps, "cart total", 1);
    expect(result.sources).toHaveLength(1);
  });

  it("answers with no sources when the store is empty", async () => {
    const deps = await makeDeps();

    const result = await answerQuestion(deps, "anything?", 5);

    expect(result.sources).toEqual([]);
    expect(result.answer).toBe("the answer");
    expect(deps.llm.calls[0].user).toContain("No code has been indexed");
  });
});
