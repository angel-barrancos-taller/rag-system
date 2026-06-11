"use client";

import { useState } from "react";

import { NeuButton, NeuCard, NeuInput } from "@/components/neu/neu";
import type { EvalReport, EvalQuestionReport } from "@/lib/eval/runner";

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl px-6 py-4 shadow-neu-sm">
      <span className="text-3xl font-bold text-neu-accent">{value}</span>
      <span className="text-sm text-neu-muted">{label}</span>
    </div>
  );
}

function QuestionRow({ row }: { row: EvalQuestionReport }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl shadow-neu-inset-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-2 text-left"
      >
        <span className="text-sm font-medium">{row.question}</span>
        <span className="font-mono text-xs text-neu-muted">
          P {row.precisionAtK.toFixed(2)} · R {row.recallAtK.toFixed(2)} · RR {row.reciprocalRank.toFixed(2)}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 px-4 pb-3 text-sm">
          <p className="whitespace-pre-wrap">{row.answer}</p>
          {row.judge ? (
            <dl className="grid gap-1 text-xs text-neu-muted">
              <div>
                <dt className="inline font-semibold">Faithfulness {row.judge.faithfulness.score}/5: </dt>
                <dd className="inline">{row.judge.faithfulness.reasoning}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Relevance {row.judge.relevance.score}/5: </dt>
                <dd className="inline">{row.judge.relevance.reasoning}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-xs text-neu-danger">
              {row.judgeError ? `Judge error: ${row.judgeError}` : "Not judged."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function EvalPanel() {
  // Kept as a string so clearing the input doesn't snap back to a number.
  const [kText, setKText] = useState("5");
  const [skipJudge, setSkipJudge] = useState(false);
  const [report, setReport] = useState<EvalReport | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runEvaluation() {
    setError(null);
    setPending(true);
    try {
      const k = Math.min(20, Math.max(1, Number(kText) || 5));
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ k, skipJudge }),
      });
      if (!response.ok) {
        setError(`Evaluation failed (HTTP ${response.status})`);
        return;
      }
      setReport(await response.json());
    } catch {
      setError("Evaluation failed: could not reach the server");
    } finally {
      setPending(false);
    }
  }

  return (
    <NeuCard>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Evaluation</h2>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            K
            <NeuInput
              type="number"
              min={1}
              max={20}
              value={kText}
              onChange={(event) => setKText(event.target.value)}
              className="w-20 py-1.5"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={skipJudge}
              onChange={(event) => setSkipJudge(event.target.checked)}
            />
            Skip LLM judge
          </label>
          <NeuButton onClick={runEvaluation} disabled={pending}>
            {pending ? "Running…" : "Run evaluation"}
          </NeuButton>
        </div>
      </div>

      <p className="mb-4 text-sm text-neu-muted">
        Runs the bundled golden dataset (sample shopping-cart code) through the pipeline and scores
        retrieval (Precision@K, Recall@K, MRR) plus answer quality via LLM-as-judge.
      </p>

      {error && (
        <p role="alert" className="mb-4 text-sm font-medium text-neu-danger">
          {error}
        </p>
      )}

      {report && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <MetricCard label={`Precision@${report.k}`} value={report.aggregate.precisionAtK.toFixed(2)} />
            <MetricCard label={`Recall@${report.k}`} value={report.aggregate.recallAtK.toFixed(2)} />
            <MetricCard label="MRR" value={report.aggregate.mrr.toFixed(2)} />
            <MetricCard
              label="Faithfulness"
              value={report.aggregate.meanFaithfulness?.toFixed(1) ?? "—"}
            />
            <MetricCard label="Relevance" value={report.aggregate.meanRelevance?.toFixed(1) ?? "—"} />
          </div>
          <div className="flex flex-col gap-2" aria-label="Per-question results">
            {report.perQuestion.map((row) => (
              <QuestionRow key={row.id} row={row} />
            ))}
          </div>
        </>
      )}
    </NeuCard>
  );
}
