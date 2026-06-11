import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { FakeEmbedder } from "@/lib/embeddings/embedder";
import { FakeLLMClient } from "@/lib/llm/llm-client";
import type { RagDeps } from "@/lib/rag/pipeline";
import type { Chunk } from "@/lib/types";
import { JsonVectorStore } from "@/lib/vector-store/json-vector-store";

import type { GoldenItem } from "./golden/dataset";
import { runEvaluation } from "./runner";

const VERDICT = JSON.stringify({
  faithfulness: { score: 4, reasoning: "grounded" },
  relevance: { score: 2, reasoning: "partially" },
});

function chunk(filePath: string, name: string, content: string): Chunk {
  return {
    id: `${filePath}#${name}`,
    filePath,
    name,
    kind: "function",
    content,
    startLine: 1,
    endLine: 1,
  };
}

/**
 * Hand-seeded store: the FakeEmbedder is a word-hash model, so a chunk whose
 * content repeats a question's exact words will rank first for that question.
 */
async function makeDeps(
  llmResponses: string[] | ((req: { user: string }) => string),
): Promise<RagDeps & { llm: FakeLLMClient }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rag-eval-"));
  const embedder = new FakeEmbedder();
  const store = new JsonVectorStore(path.join(dir, "index.json"), {
    modelId: embedder.modelId,
    dimension: embedder.dimension,
  });

  const chunks = [
    chunk("a.ts", "alpha", "alpha apple avocado almond"),
    chunk("b.ts", "beta", "beta banana blueberry bread"),
    chunk("c.ts", "gamma", "gamma grape guava garlic"),
  ];
  const vectors = await embedder.embed(chunks.map((c) => c.content));
  await store.upsert(chunks.map((c, i) => ({ chunk: c, vector: vectors[i] })));

  return { embedder, store, llm: new FakeLLMClient(llmResponses) };
}

const DATASET: GoldenItem[] = [
  {
    id: "q-alpha",
    question: "alpha apple avocado almond",
    relevantChunkIds: ["a.ts#alpha"],
    referenceAnswer: "about alpha",
  },
  {
    id: "q-beta",
    question: "beta banana blueberry bread",
    relevantChunkIds: ["b.ts#beta", "a.ts#alpha"],
    referenceAnswer: "about beta and alpha",
  },
  {
    id: "q-miss",
    question: "zebra xylophone quokka jigsaw",
    relevantChunkIds: ["missing.ts#nope"],
    referenceAnswer: "nothing matches",
  },
];

describe("runEvaluation", () => {
  it("computes per-question and aggregate retrieval metrics that match hand-computed values", async () => {
    const deps = await makeDeps(() => VERDICT);

    const report = await runEvaluation(deps, DATASET, { k: 2 });

    expect(report.k).toBe(2);
    expect(report.perQuestion).toHaveLength(3);

    const [alpha, beta, miss] = report.perQuestion;
    // q-alpha: top-1 is a.ts#alpha → P@2 = 1/2, R@2 = 1/1, RR = 1
    expect(alpha.retrieved[0].chunkId).toBe("a.ts#alpha");
    expect(alpha.precisionAtK).toBeCloseTo(0.5);
    expect(alpha.recallAtK).toBe(1);
    expect(alpha.reciprocalRank).toBe(1);
    // q-beta: top-1 is b.ts#beta, a.ts#alpha is also relevant and ranks within top 2
    // (word-hash model: disjoint vocab → other chunks score ~0, ordering among them varies)
    expect(beta.retrieved[0].chunkId).toBe("b.ts#beta");
    expect(beta.reciprocalRank).toBe(1);
    // q-miss: nothing relevant → all zeros
    expect(miss.precisionAtK).toBe(0);
    expect(miss.recallAtK).toBe(0);
    expect(miss.reciprocalRank).toBe(0);

    // Aggregates are the means of the per-question values
    expect(report.aggregate.precisionAtK).toBeCloseTo(
      (alpha.precisionAtK + beta.precisionAtK + miss.precisionAtK) / 3,
    );
    expect(report.aggregate.mrr).toBeCloseTo((1 + 1 + 0) / 3);
  });

  it("judges every question and aggregates faithfulness/relevance means", async () => {
    const deps = await makeDeps(() => VERDICT);

    const report = await runEvaluation(deps, DATASET, { k: 2 });

    for (const row of report.perQuestion) {
      expect(row.judge).toEqual({
        faithfulness: { score: 4, reasoning: "grounded" },
        relevance: { score: 2, reasoning: "partially" },
      });
    }
    expect(report.aggregate.meanFaithfulness).toBeCloseTo(4);
    expect(report.aggregate.meanRelevance).toBeCloseTo(2);
  });

  it("skipJudge answers questions but makes no judge calls", async () => {
    const deps = await makeDeps(["generated answer"]);

    const report = await runEvaluation(deps, DATASET, {
      k: 2,
      skipJudge: true,
    });

    // one answer-generation call per question, zero judge calls
    expect(deps.llm.calls).toHaveLength(3);
    expect(deps.llm.calls.every((c) => !c.jsonMode)).toBe(true);
    expect(report.perQuestion.every((row) => row.judge === null)).toBe(true);
    expect(report.aggregate.meanFaithfulness).toBeNull();
    expect(report.aggregate.meanRelevance).toBeNull();
  });

  it("a judge failure on one question is recorded and does not break the run", async () => {
    let judgeCalls = 0;
    const deps = await makeDeps((req) => {
      if (!req.user.includes("Answer to evaluate")) return "an answer";
      judgeCalls++;
      // fail (twice, incl. retry) only for the first judged question
      return judgeCalls <= 2 ? "not json" : VERDICT;
    });

    const report = await runEvaluation(deps, DATASET, { k: 2 });

    expect(report.perQuestion[0].judge).toBeNull();
    expect(report.perQuestion[0].judgeError).toMatch(/invalid json/i);
    expect(report.perQuestion[1].judge).not.toBeNull();
    // means ignore the failed row
    expect(report.aggregate.meanFaithfulness).toBeCloseTo(4);
  });
});
