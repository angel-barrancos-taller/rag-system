/**
 * Route handler tests: the exported POST functions are called directly with
 * Request objects, with fakes injected via setServicesForTesting — no HTTP
 * server, no model download, no OpenRouter.
 */
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { POST as evaluatePost } from "@/app/api/evaluate/route";
import { POST as indexPost } from "@/app/api/index/files/route";
import { POST as queryPost } from "@/app/api/query/route";
import { FakeEmbedder } from "@/lib/embeddings/embedder";
import { FakeLLMClient } from "@/lib/llm/llm-client";
import { JsonVectorStore } from "@/lib/vector-store/json-vector-store";

import { setServicesForTesting } from "../services";

const VERDICT = JSON.stringify({
  faithfulness: { score: 5, reasoning: "grounded" },
  relevance: { score: 4, reasoning: "on topic" },
});

let llm: FakeLLMClient;
let store: JsonVectorStore;

beforeEach(async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rag-routes-"));
  const embedder = new FakeEmbedder();
  store = new JsonVectorStore(path.join(dir, "index.json"), {
    modelId: embedder.modelId,
    dimension: embedder.dimension,
  });
  llm = new FakeLLMClient((req) =>
    req.jsonMode ? VERDICT : "generated answer",
  );
  setServicesForTesting({ embedder, store, llm });
});

afterEach(() => setServicesForTesting(null));

function post(handler: (req: Request) => Promise<Response>, body: unknown) {
  return handler(
    new Request("http://test.local/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/index/files", () => {
  it("indexes valid files and reports chunk counts", async () => {
    const response = await post(indexPost, {
      files: [
        {
          path: "src/sum.ts",
          content: "export function sum(a:number,b:number){return a+b;}",
        },
      ],
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      filesIndexed: 1,
      chunksIndexed: 1,
      perFile: [{ path: "src/sum.ts", chunks: 1 }],
    });
    expect(await store.size()).toBe(1);
  });

  it("rejects non-TS/JS files with 400 and Zod issues", async () => {
    const response = await post(indexPost, {
      files: [{ path: "notes.md", content: "# hi" }],
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("ValidationError");
    expect(JSON.stringify(body.issues)).toMatch(/TS\/JS/);
  });

  it("rejects path traversal", async () => {
    const response = await post(indexPost, {
      files: [{ path: "../evil.ts", content: "x" }],
    });
    expect(response.status).toBe(400);
  });

  it("rejects oversized files", async () => {
    const response = await post(indexPost, {
      files: [{ path: "big.ts", content: "x".repeat(200_001) }],
    });
    expect(response.status).toBe(400);
  });

  it("rejects malformed JSON bodies", async () => {
    const response = await indexPost(
      new Request("http://test.local/api", { method: "POST", body: "{nope" }),
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /api/query", () => {
  beforeEach(() =>
    post(indexPost, {
      files: [
        {
          path: "src/cart.ts",
          content: "export function getCartTotal(){ return 0; }",
        },
        {
          path: "src/other.ts",
          content: "export function unrelatedThing(){ return 1; }",
        },
      ],
    }),
  );

  it("answers a question with sources", async () => {
    const response = await post(queryPost, {
      question: "what does getCartTotal return?",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.answer).toBe("generated answer");
    expect(body.sources.length).toBeGreaterThan(0);
    expect(body.sources[0]).toMatchObject({
      filePath: "src/cart.ts",
      chunkId: "src/cart.ts#getCartTotal",
      lines: { start: 1, end: 1 },
    });
  });

  it("honors topK", async () => {
    const response = await post(queryPost, {
      question: "cart total?",
      topK: 1,
    });
    const body = await response.json();
    expect(body.sources).toHaveLength(1);
  });

  it("rejects questions that are too short", async () => {
    const response = await post(queryPost, { question: "ab" });
    expect(response.status).toBe(400);
  });
});

describe("POST /api/evaluate", () => {
  it("falls back to the bundled golden dataset and indexes the sample code", async () => {
    const response = await post(evaluatePost, { k: 2, skipJudge: true });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.k).toBe(2);
    expect(body.perQuestion).toHaveLength(8);
    expect(body.aggregate.meanFaithfulness).toBeNull();
    // sample code was indexed into the store
    expect(await store.size()).toBeGreaterThan(0);
  });

  it("runs a custom dataset without indexing sample code", async () => {
    await post(indexPost, {
      files: [
        {
          path: "src/cart.ts",
          content: "export function getCartTotal(){ return 0; }",
        },
      ],
    });

    const response = await post(evaluatePost, {
      dataset: [
        {
          id: "q1",
          question: "what does getCartTotal return?",
          relevantChunkIds: ["src/cart.ts#getCartTotal"],
          referenceAnswer: "zero",
        },
      ],
      k: 1,
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.perQuestion).toHaveLength(1);
    expect(body.perQuestion[0].reciprocalRank).toBe(1);
    expect(body.perQuestion[0].judge.faithfulness.score).toBe(5);
    expect(body.aggregate.meanRelevance).toBe(4);
  });

  it("rejects an invalid dataset", async () => {
    const response = await post(evaluatePost, {
      dataset: [{ id: "", question: "x" }],
    });
    expect(response.status).toBe(400);
  });
});
