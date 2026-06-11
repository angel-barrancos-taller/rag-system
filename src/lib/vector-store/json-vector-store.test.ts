import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Chunk } from "@/lib/types";

import { JsonVectorStore } from "./json-vector-store";

function chunk(filePath: string, name: string): Chunk {
  return {
    id: `${filePath}#${name}`,
    filePath,
    name,
    kind: "function",
    content: `function ${name}() {}`,
    startLine: 1,
    endLine: 3,
  };
}

const MODEL = { modelId: "test-model", dimension: 3 };

describe("JsonVectorStore", () => {
  let dataFile: string;

  beforeEach(async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "rag-store-"));
    dataFile = path.join(dir, "index.json");
  });

  function makeStore() {
    return new JsonVectorStore(dataFile, MODEL);
  }

  it("starts empty", async () => {
    expect(await makeStore().size()).toBe(0);
  });

  it("returns query results ordered by cosine similarity, truncated to topK", async () => {
    const store = makeStore();
    await store.upsert([
      { chunk: chunk("a.ts", "exact"), vector: [1, 0, 0] },
      { chunk: chunk("a.ts", "close"), vector: [0.9, 0.1, 0] },
      { chunk: chunk("b.ts", "far"), vector: [0, 0, 1] },
    ]);

    const results = await store.query([1, 0, 0], 2);

    expect(results.map((r) => r.id)).toEqual(["a.ts#exact", "a.ts#close"]);
    expect(results[0].score).toBeCloseTo(1);
    expect(results[0].score).toBeGreaterThan(results[1].score);
    expect(results[1].score).toBeGreaterThan(0.9);
  });

  it("upserts by chunk id: same id replaces the vector without growing the store", async () => {
    const store = makeStore();
    await store.upsert([{ chunk: chunk("a.ts", "f"), vector: [1, 0, 0] }]);
    await store.upsert([{ chunk: chunk("a.ts", "f"), vector: [0, 1, 0] }]);

    expect(await store.size()).toBe(1);
    const [top] = await store.query([0, 1, 0], 1);
    expect(top.score).toBeCloseTo(1);
  });

  it("deletes all chunks of a file and only that file", async () => {
    const store = makeStore();
    await store.upsert([
      { chunk: chunk("a.ts", "f1"), vector: [1, 0, 0] },
      { chunk: chunk("a.ts", "f2"), vector: [0, 1, 0] },
      { chunk: chunk("b.ts", "g"), vector: [0, 0, 1] },
    ]);

    await store.deleteByFilePath("a.ts");

    expect(await store.size()).toBe(1);
    expect((await store.query([1, 0, 0], 5)).map((r) => r.id)).toEqual([
      "b.ts#g",
    ]);
  });

  it("lists files with chunk counts", async () => {
    const store = makeStore();
    await store.upsert([
      { chunk: chunk("a.ts", "f1"), vector: [1, 0, 0] },
      { chunk: chunk("a.ts", "f2"), vector: [0, 1, 0] },
      { chunk: chunk("b.ts", "g"), vector: [0, 0, 1] },
    ]);

    expect(await store.listFiles()).toEqual(
      expect.arrayContaining([
        { filePath: "a.ts", chunkCount: 2 },
        { filePath: "b.ts", chunkCount: 1 },
      ]),
    );
  });

  it("clears all entries", async () => {
    const store = makeStore();
    await store.upsert([{ chunk: chunk("a.ts", "f"), vector: [1, 0, 0] }]);
    await store.clear();
    expect(await store.size()).toBe(0);
  });

  it("persists across instances (round-trip through the JSON file)", async () => {
    const writer = makeStore();
    await writer.upsert([{ chunk: chunk("a.ts", "f"), vector: [1, 0, 0] }]);

    const reader = makeStore();
    const results = await reader.query([1, 0, 0], 1);

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("a.ts#f");
    expect(results[0].content).toBe("function f() {}");
  });

  it("starts empty when the JSON file is corrupt, without throwing", async () => {
    await writeFile(dataFile, "{not json", "utf8");
    const store = makeStore();
    expect(await store.size()).toBe(0);
  });

  it("clears persisted entries when the stored embedding model differs", async () => {
    const oldModelStore = new JsonVectorStore(dataFile, {
      modelId: "old-model",
      dimension: 3,
    });
    await oldModelStore.upsert([
      { chunk: chunk("a.ts", "f"), vector: [1, 0, 0] },
    ]);

    const store = makeStore();
    expect(await store.size()).toBe(0);
  });

  it("writes valid JSON containing the model id", async () => {
    const store = makeStore();
    await store.upsert([{ chunk: chunk("a.ts", "f"), vector: [1, 0, 0] }]);

    const persisted = JSON.parse(await readFile(dataFile, "utf8"));
    expect(persisted.modelId).toBe("test-model");
    expect(persisted.entries).toHaveLength(1);
  });

  it("rejects vectors whose dimension does not match the store", async () => {
    const store = makeStore();
    await expect(
      store.upsert([{ chunk: chunk("a.ts", "f"), vector: [1, 0] }]),
    ).rejects.toThrow(/dimension/i);
  });
});
