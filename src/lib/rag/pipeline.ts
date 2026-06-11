import { chunkFile } from "@/lib/chunker/chunker";
import type { Embedder } from "@/lib/embeddings/embedder";
import type { LLMClient } from "@/lib/llm/llm-client";
import type { QueryResult } from "@/lib/types";
import type { VectorStore } from "@/lib/vector-store/vector-store";

import { ANSWER_SYSTEM_PROMPT, buildAnswerPrompt } from "./prompts";

export interface RagDeps {
  embedder: Embedder;
  store: VectorStore;
  llm: LLMClient;
}

export interface IndexResult {
  filesIndexed: number;
  chunksIndexed: number;
  perFile: { path: string; chunks: number }[];
}

export async function indexFiles(
  deps: Pick<RagDeps, "embedder" | "store">,
  files: { path: string; content: string }[],
): Promise<IndexResult> {
  const perFile: IndexResult["perFile"] = [];

  for (const file of files) {
    // Replace any previous chunks of this file so re-indexing never accumulates.
    await deps.store.deleteByFilePath(file.path);
    const chunks = chunkFile(file.path, file.content);
    if (chunks.length > 0) {
      const vectors = await deps.embedder.embed(
        chunks.map((chunk) => chunk.content),
      );
      await deps.store.upsert(
        chunks.map((chunk, i) => ({ chunk, vector: vectors[i] })),
      );
    }
    perFile.push({ path: file.path, chunks: chunks.length });
  }

  return {
    filesIndexed: files.length,
    chunksIndexed: perFile.reduce((sum, f) => sum + f.chunks, 0),
    perFile,
  };
}

export async function answerQuestion(
  deps: RagDeps,
  question: string,
  topK = 5,
): Promise<QueryResult> {
  const [queryVector] = await deps.embedder.embed([question]);
  const chunks = await deps.store.query(queryVector, topK);

  const answer = await deps.llm.complete({
    system: ANSWER_SYSTEM_PROMPT,
    user: buildAnswerPrompt(question, chunks),
    temperature: 0.2,
  });

  return {
    answer,
    sources: chunks.map((chunk) => ({
      filePath: chunk.filePath,
      snippet: chunk.content,
      lines: { start: chunk.startLine, end: chunk.endLine },
      score: chunk.score,
      chunkId: chunk.id,
    })),
  };
}
