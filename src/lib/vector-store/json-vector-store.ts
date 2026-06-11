import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ScoredChunk } from "@/lib/types";

import {
  cosineSimilarity,
  type VectorEntry,
  type VectorStore,
} from "./vector-store";

interface PersistedIndex {
  version: 1;
  modelId: string;
  dimension: number;
  entries: VectorEntry[];
}

export interface ModelInfo {
  modelId: string;
  dimension: number;
}

/**
 * In-memory cosine-similarity store persisted to a single JSON file.
 * Loads lazily on first use; every mutation is saved atomically
 * (tmp file + rename) and writes are serialized through a promise chain.
 */
export class JsonVectorStore implements VectorStore {
  private entries = new Map<string, VectorEntry>();
  private loaded: Promise<void> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly dataFilePath: string,
    private readonly model: ModelInfo,
  ) {}

  async upsert(entries: VectorEntry[]): Promise<void> {
    await this.ensureLoaded();
    for (const entry of entries) {
      if (entry.vector.length !== this.model.dimension) {
        throw new RangeError(
          `Vector dimension ${entry.vector.length} does not match store dimension ${this.model.dimension}`,
        );
      }
      this.entries.set(entry.chunk.id, entry);
    }
    await this.save();
  }

  async query(vector: number[], topK: number): Promise<ScoredChunk[]> {
    await this.ensureLoaded();
    const scored: ScoredChunk[] = [];
    for (const { chunk, vector: stored } of this.entries.values()) {
      scored.push({ ...chunk, score: cosineSimilarity(vector, stored) });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  async deleteByFilePath(filePath: string): Promise<void> {
    await this.ensureLoaded();
    for (const [id, entry] of this.entries) {
      if (entry.chunk.filePath === filePath) this.entries.delete(id);
    }
    await this.save();
  }

  async listFiles(): Promise<{ filePath: string; chunkCount: number }[]> {
    await this.ensureLoaded();
    const counts = new Map<string, number>();
    for (const { chunk } of this.entries.values()) {
      counts.set(chunk.filePath, (counts.get(chunk.filePath) ?? 0) + 1);
    }
    return [...counts].map(([filePath, chunkCount]) => ({
      filePath,
      chunkCount,
    }));
  }

  async clear(): Promise<void> {
    await this.ensureLoaded();
    this.entries.clear();
    await this.save();
  }

  async size(): Promise<number> {
    await this.ensureLoaded();
    return this.entries.size;
  }

  private ensureLoaded(): Promise<void> {
    this.loaded ??= this.load();
    return this.loaded;
  }

  private async load(): Promise<void> {
    let raw: string;
    try {
      raw = await readFile(this.dataFilePath, "utf8");
    } catch {
      return; // no index yet — start empty
    }
    try {
      const persisted = JSON.parse(raw) as PersistedIndex;
      if (
        persisted.modelId !== this.model.modelId ||
        persisted.dimension !== this.model.dimension
      ) {
        console.warn(
          `[JsonVectorStore] embedding model changed (${persisted.modelId} → ${this.model.modelId}); clearing index`,
        );
        return;
      }
      for (const entry of persisted.entries) {
        this.entries.set(entry.chunk.id, entry);
      }
    } catch {
      console.warn(
        `[JsonVectorStore] could not parse ${this.dataFilePath}; starting empty`,
      );
    }
  }

  private save(): Promise<void> {
    const snapshot: PersistedIndex = {
      version: 1,
      modelId: this.model.modelId,
      dimension: this.model.dimension,
      entries: [...this.entries.values()],
    };
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(path.dirname(this.dataFilePath), { recursive: true });
      const tmpPath = `${this.dataFilePath}.tmp`;
      await writeFile(tmpPath, JSON.stringify(snapshot), "utf8");
      await rename(tmpPath, this.dataFilePath);
    });
    return this.writeQueue;
  }
}
