"use client";

import { useState, type FormEvent } from "react";

import { NeuButton, NeuCard, NeuTextarea } from "@/components/neu/neu";
import type { QueryResult, SourceRef } from "@/lib/types";

import { SourceSnippet } from "./source-snippet";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[];
}

export function QuerySection() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || pending) return;

    setError(null);
    setPending(true);
    setMessages((previous) => [...previous, { role: "user", content: trimmed }]);
    setQuestion("");

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      if (!response.ok) {
        setError(`Query failed (HTTP ${response.status})`);
        return;
      }
      const result: QueryResult = await response.json();
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: result.answer, sources: result.sources },
      ]);
    } catch {
      setError("Query failed: could not reach the server");
    } finally {
      setPending(false);
    }
  }

  return (
    <NeuCard className="flex flex-col">
      <h2 className="mb-4 text-xl font-bold">Querying</h2>

      <div className="flex max-h-[28rem] flex-1 flex-col gap-3 overflow-y-auto pb-2" aria-label="Conversation">
        {messages.length === 0 && (
          <p className="text-sm text-neu-muted">Index some files, then ask anything about the code.</p>
        )}
        {messages.map((message, index) =>
          message.role === "user" ? (
            <div key={index} className="ml-8 self-end rounded-2xl px-4 py-2 shadow-neu-inset-sm">
              {message.content}
            </div>
          ) : (
            <div key={index} className="mr-8 flex flex-col gap-2 self-start rounded-2xl p-4 shadow-neu-sm">
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.sources && message.sources.length > 0 && (
                <div className="flex flex-col gap-2" aria-label="Sources">
                  {message.sources.map((source) => (
                    <SourceSnippet key={source.chunkId} source={source} />
                  ))}
                </div>
              )}
            </div>
          ),
        )}
      </div>

      {error && (
        <p role="alert" className="mb-2 text-sm font-medium text-neu-danger">
          {error}
        </p>
      )}

      <form onSubmit={onSubmit} className="flex items-end gap-3">
        <NeuTextarea
          aria-label="Ask a question about the indexed code"
          placeholder="How is the cart total calculated?"
          rows={2}
          className="flex-1 resize-none"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          disabled={pending}
        />
        <NeuButton type="submit" disabled={pending}>
          {pending ? "Thinking…" : "Ask"}
        </NeuButton>
      </form>
    </NeuCard>
  );
}
