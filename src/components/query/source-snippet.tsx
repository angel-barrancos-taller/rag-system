"use client";

import { useState } from "react";

import type { SourceRef } from "@/lib/types";

export function SourceSnippet({ source }: { source: SourceRef }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl shadow-neu-inset-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left"
      >
        <span className="truncate font-mono text-xs text-neu-accent">
          {source.filePath}{" "}
          <span className="text-neu-muted">
            (lines {source.lines.start}–{source.lines.end})
          </span>
        </span>
        <span className="shrink-0 text-xs text-neu-muted">score {source.score.toFixed(2)}</span>
      </button>
      {open && (
        <pre className="overflow-x-auto px-4 pb-3 font-mono text-xs leading-5 text-neu-text">
          {source.snippet}
        </pre>
      )}
    </div>
  );
}
