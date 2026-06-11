import { cosineSimilarity } from "@/lib/vector-store/vector-store";

import { FakeEmbedder } from "./embedder";

describe("FakeEmbedder", () => {
  const embedder = new FakeEmbedder();

  it("exposes its dimension and model id", () => {
    expect(embedder.dimension).toBeGreaterThan(0);
    expect(embedder.modelId).toBe("fake-embedder");
  });

  it("returns one vector of the declared dimension per text", async () => {
    const vectors = await embedder.embed([
      "function add() {}",
      "class Cart {}",
    ]);
    expect(vectors).toHaveLength(2);
    for (const vector of vectors) {
      expect(vector).toHaveLength(embedder.dimension);
    }
  });

  it("returns an empty array for empty input", async () => {
    expect(await embedder.embed([])).toEqual([]);
  });

  it("is deterministic: identical text yields an identical vector", async () => {
    const [a] = await embedder.embed(["const total = price * quantity;"]);
    const [b] = await embedder.embed(["const total = price * quantity;"]);
    expect(a).toEqual(b);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1);
  });

  it("produces L2-normalized vectors", async () => {
    const [vector] = await embedder.embed(["normalize me please"]);
    const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
    expect(norm).toBeCloseTo(1);
  });

  it("scores texts sharing words higher than unrelated texts", async () => {
    const [query, related, unrelated] = await embedder.embed([
      "calculate cart total price",
      "function getTotal() { return cart total price sum }",
      "parse xml document attribute namespace",
    ]);
    expect(cosineSimilarity(query, related)).toBeGreaterThan(
      cosineSimilarity(query, unrelated),
    );
  });

  it("handles text with no word characters without producing NaN", async () => {
    const [vector] = await embedder.embed(["!!! ***"]);
    expect(vector.every((x) => Number.isFinite(x))).toBe(true);
  });
});
