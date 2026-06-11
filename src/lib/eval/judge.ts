import { z } from "zod";

import type { LLMClient } from "@/lib/llm/llm-client";

const ScoreSchema = z.object({
  score: z.number().int().min(1).max(5),
  reasoning: z.string().min(1),
});

export const JudgeVerdictSchema = z.object({
  faithfulness: ScoreSchema,
  relevance: ScoreSchema,
});

export type JudgeVerdict = z.infer<typeof JudgeVerdictSchema>;

export class JudgeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JudgeParseError";
  }
}

export interface JudgeInput {
  question: string;
  context: string[];
  answer: string;
  referenceAnswer?: string;
}

const JUDGE_SYSTEM_PROMPT =
  "You are an impartial evaluator of RAG answers about a codebase. Score two rubrics from 1 to 5:\n" +
  "- faithfulness: every claim in the answer is supported by the provided code context. " +
  "5 = fully grounded, 1 = mostly fabricated.\n" +
  "- relevance: the answer directly addresses the question. 5 = fully answers it, 1 = off-topic or evasive.\n" +
  "Respond with ONLY a JSON object of this exact shape:\n" +
  '{"faithfulness":{"score":1-5,"reasoning":"..."},"relevance":{"score":1-5,"reasoning":"..."}}';

export async function judgeAnswer(
  llm: LLMClient,
  input: JudgeInput,
): Promise<JudgeVerdict> {
  const contextBlock =
    input.context.length === 0
      ? "(no context was retrieved)"
      : input.context.map((c, i) => `[${i + 1}]\n${c}`).join("\n\n");

  const userPrompt =
    `Question: ${input.question}\n\n` +
    `Retrieved code context:\n${contextBlock}\n\n` +
    `Answer to evaluate: ${input.answer}` +
    (input.referenceAnswer
      ? `\n\nReference answer (for comparison): ${input.referenceAnswer}`
      : "");

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const reminder =
      attempt === 0
        ? ""
        : "\n\nYour previous reply was invalid. Return ONLY valid JSON in the required shape.";
    const raw = await llm.complete({
      system: JUDGE_SYSTEM_PROMPT,
      user: userPrompt + reminder,
      temperature: 0,
      jsonMode: true,
    });

    try {
      const parsed: unknown = JSON.parse(stripFences(raw));
      const verdict = JudgeVerdictSchema.safeParse(parsed);
      if (verdict.success) return verdict.data;
      lastError = verdict.error.message;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new JudgeParseError(`Judge returned invalid JSON twice: ${lastError}`);
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}
