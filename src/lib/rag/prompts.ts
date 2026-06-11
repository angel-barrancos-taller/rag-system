import type { ScoredChunk } from "@/lib/types";

export const ANSWER_SYSTEM_PROMPT =
  "You are a precise codebase assistant. Answer questions using ONLY the provided code context. " +
  "Cite the file paths you used. If the context is insufficient, say " +
  '"I don\'t know based on the indexed code." Do not invent code that is not in the context.';

export function buildAnswerPrompt(
  question: string,
  chunks: ScoredChunk[],
): string {
  const context =
    chunks.length === 0
      ? "No code has been indexed yet, or nothing relevant was found."
      : chunks
          .map(
            (chunk, i) =>
              `[${i + 1}] ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}\n\`\`\`\n${chunk.content}\n\`\`\``,
          )
          .join("\n\n");

  return `Code context:\n\n${context}\n\nQuestion: ${question}`;
}
