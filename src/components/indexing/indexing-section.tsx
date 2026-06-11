"use client";

import { useRef, useState, type DragEvent } from "react";

import { NeuCard } from "@/components/neu/neu";

const SUPPORTED = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const MAX_FILE_BYTES = 200_000;

interface IndexedFile {
  path: string;
  chunks: number;
}

export function IndexingSection() {
  const [indexedFiles, setIndexedFiles] = useState<IndexedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(files: File[]) {
    setError(null);
    if (files.length === 0) return;

    const unsupported = files.filter((file) => !SUPPORTED.test(file.name));
    if (unsupported.length > 0) {
      setError(`Only TS/JS files are supported (rejected: ${unsupported.map((f) => f.name).join(", ")})`);
      return;
    }
    const oversized = files.filter((file) => file.size > MAX_FILE_BYTES);
    if (oversized.length > 0) {
      setError(`Files over 200KB are not supported (rejected: ${oversized.map((f) => f.name).join(", ")})`);
      return;
    }

    setBusy(true);
    try {
      const payload = {
        files: await Promise.all(
          files.map(async (file) => ({ path: file.name, content: await file.text() })),
        ),
      };
      const response = await fetch("/api/index/files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setError(`Indexing failed (HTTP ${response.status})`);
        return;
      }
      const result: { perFile: IndexedFile[] } = await response.json();
      setIndexedFiles((previous) => [
        ...previous.filter((f) => !result.perFile.some((r) => r.path === f.path)),
        ...result.perFile,
      ]);
    } catch {
      setError("Indexing failed: could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    void uploadFiles([...event.dataTransfer.files]);
  }

  return (
    <NeuCard aria-busy={busy}>
      <h2 className="mb-4 text-xl font-bold">Indexing</h2>

      <div
        data-testid="dropzone"
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center gap-3 rounded-2xl p-8 text-center transition-shadow ${
          dragActive ? "shadow-neu-inset" : "shadow-neu-inset-sm"
        }`}
      >
        <p className="text-neu-muted">
          {busy ? "Indexing…" : "Drag & drop TS/JS files here, or"}
        </p>
        <label className="cursor-pointer rounded-2xl bg-neu-base px-5 py-2.5 font-semibold text-neu-accent shadow-neu-sm transition-shadow hover:shadow-neu">
          Browse files
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".ts,.tsx,.js,.jsx,.mjs,.cjs"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              void uploadFiles([...(event.target.files ?? [])]);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm font-medium text-neu-danger">
          {error}
        </p>
      )}

      {indexedFiles.length > 0 && (
        <ul className="mt-4 space-y-2" aria-label="Indexed files">
          {indexedFiles.map((file) => (
            <li
              key={file.path}
              className="flex items-center justify-between rounded-xl px-4 py-2 shadow-neu-inset-sm"
            >
              <span className="font-mono text-sm">{file.path}</span>
              <span className="text-sm text-neu-muted">{file.chunks} chunks</span>
            </li>
          ))}
        </ul>
      )}
    </NeuCard>
  );
}
