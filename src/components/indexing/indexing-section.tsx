"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";

import { NeuCard } from "@/components/neu/neu";

const SUPPORTED = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const MAX_FILE_BYTES = 200_000;

interface IndexedFile {
  path: string;
  chunks: number;
  content: string;
}

function FileModal({ file, onClose }: { file: IndexedFile; onClose: () => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-3xl bg-neu-base shadow-neu"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neu-base px-6 py-4">
          <span className="font-mono text-sm font-semibold">{file.path}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-1 text-neu-muted shadow-neu-sm transition-shadow hover:shadow-neu"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <pre className="overflow-auto p-6 text-sm leading-relaxed">
          <code>{file.content}</code>
        </pre>
      </div>
    </div>
  );
}

const STORAGE_KEY = "rag:indexed-files";

function loadStored(): IndexedFile[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveStored(files: IndexedFile[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  } catch {
    // storage quota exceeded — silently ignore
  }
}

export function IndexingSection() {
  const [indexedFiles, setIndexedFiles] = useState<IndexedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [openFile, setOpenFile] = useState<IndexedFile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIndexedFiles(loadStored());
  }, []);

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
      const fileData = await Promise.all(
        files.map(async (file) => ({ path: file.name, content: await file.text() })),
      );
      const response = await fetch("/api/index/files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ files: fileData }),
      });
      if (!response.ok) {
        setError(`Indexing failed (HTTP ${response.status})`);
        return;
      }
      const result: { perFile: Array<{ path: string; chunks: number }> } = await response.json();
      const withContent: IndexedFile[] = result.perFile.map((r) => ({
        ...r,
        content: fileData.find((f) => f.path === r.path)?.content ?? "",
      }));
      setIndexedFiles((previous) => {
        const next = [
          ...previous.filter((f) => !withContent.some((r) => r.path === f.path)),
          ...withContent,
        ];
        saveStored(next);
        return next;
      });
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
    <>
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
              <li key={file.path}>
                <button
                  type="button"
                  onClick={() => setOpenFile(file)}
                  className="flex w-full items-center justify-between rounded-xl px-4 py-2 shadow-neu-inset-sm transition-shadow hover:shadow-neu-inset"
                >
                  <span className="font-mono text-sm">{file.path}</span>
                  <span className="text-sm text-neu-muted">{file.chunks} chunks</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </NeuCard>

      {openFile && <FileModal file={openFile} onClose={() => setOpenFile(null)} />}
    </>
  );
}
