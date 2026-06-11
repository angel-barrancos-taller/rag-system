import { answerQuestion, type RagDeps } from "@/lib/rag/pipeline";

import type { GoldenItem } from "./golden/dataset";
import { judgeAnswer, type JudgeVerdict } from "./judge";
import {
  mean,
  meanReciprocalRank,
  precisionAtK,
  recallAtK,
  reciprocalRank,
} from "./metrics";

export interface EvalOptions {
  k?: number;
  /** Retrieval depth; defaults to max(k, 5). */
  topK?: number;
  skipJudge?: boolean;
}

export interface EvalQuestionReport {
  id: string;
  question: string;
  retrieved: { chunkId: string; score: number }[];
  precisionAtK: number;
  recallAtK: number;
  reciprocalRank: number;
  answer: string;
  judge: JudgeVerdict | null;
  judgeError?: string;
}

export interface EvalReport {
  k: number;
  perQuestion: EvalQuestionReport[];
  aggregate: {
    precisionAtK: number;
    recallAtK: number;
    mrr: number;
    meanFaithfulness: number | null;
    meanRelevance: number | null;
  };
}

/**
 * Runs the full evaluation suite question by question (sequentially — the
 * dataset is small and this avoids hammering the LLM provider). Judge
 * failures are recorded per question and never abort the run.
 */
export async function runEvaluation(
  deps: RagDeps,
  dataset: GoldenItem[],
  opts?: EvalOptions,
): Promise<EvalReport> {
  const k = opts?.k ?? 5;
  const topK = opts?.topK ?? Math.max(k, 5);
  const skipJudge = opts?.skipJudge ?? false;

  const perQuestion: EvalQuestionReport[] = [];

  for (const item of dataset) {
    const result = await answerQuestion(deps, item.question, topK);
    const retrievedIds = result.sources.map((source) => source.chunkId);

    let judge: JudgeVerdict | null = null;
    let judgeError: string | undefined;
    if (!skipJudge) {
      try {
        judge = await judgeAnswer(deps.llm, {
          question: item.question,
          context: result.sources.map((source) => source.snippet),
          answer: result.answer,
          referenceAnswer: item.referenceAnswer,
        });
      } catch (error) {
        judgeError = error instanceof Error ? error.message : String(error);
      }
    }

    perQuestion.push({
      id: item.id,
      question: item.question,
      retrieved: result.sources.map((source) => ({
        chunkId: source.chunkId,
        score: source.score,
      })),
      precisionAtK: precisionAtK(retrievedIds, item.relevantChunkIds, k),
      recallAtK: recallAtK(retrievedIds, item.relevantChunkIds, k),
      reciprocalRank: reciprocalRank(retrievedIds, item.relevantChunkIds),
      answer: result.answer,
      judge,
      ...(judgeError ? { judgeError } : {}),
    });
  }

  const judged = perQuestion.filter((row) => row.judge !== null);

  return {
    k,
    perQuestion,
    aggregate: {
      precisionAtK: mean(perQuestion.map((row) => row.precisionAtK)),
      recallAtK: mean(perQuestion.map((row) => row.recallAtK)),
      mrr: meanReciprocalRank(
        dataset.map((item, i) => ({
          retrievedIds: perQuestion[i].retrieved.map((r) => r.chunkId),
          relevantIds: item.relevantChunkIds,
        })),
      ),
      meanFaithfulness: judged.length
        ? mean(judged.map((row) => row.judge!.faithfulness.score))
        : null,
      meanRelevance: judged.length
        ? mean(judged.map((row) => row.judge!.relevance.score))
        : null,
    },
  };
}
