# Codebase RAG System

A Next.js app that indexes TS/JS code files with **local embeddings**, answers questions about them with retrieval-augmented generation, and **evaluates** both retrieval quality (Precision@K, Recall@K, MRR) and answer quality (LLM-as-judge). Neumorphic UI, built test-first.

```
INDEXING    Code Files → AST Chunker → Local Embeddings → JSON Vector Store
QUERYING    Question → Embed → Cosine Search → Prompt → OpenRouter LLM → Answer + Sources
EVALUATION  Golden Dataset → RAG → Precision@K / Recall@K / MRR + LLM-as-judge (1–5)
```

## Setup

```bash
pnpm install
cp .env.example .env.local   # add your OPENROUTER_API_KEY
pnpm dev
```

`OPENROUTER_API_KEY` is the **only OpenRouter setting** — the key is pre-configured with its model on the OpenRouter side, so requests never specify one. Indexing works without the key (embeddings are local); only querying and the judge need it.

> **First index is slow:** the embedding model (~34MB quantized) is downloaded once from Hugging Face into `.rag-data/models`. Subsequent requests reuse the loaded model.

## Usage

Open http://localhost:3000:

- **Indexing** — drag & drop (or browse) `.ts/.tsx/.js/.jsx/.mjs/.cjs` files; each is split into function/class/method chunks (TypeScript compiler API) and embedded.
- **Querying** — chat-style Q&A; every answer lists the source chunks used, with file path, line range, similarity score, and an expandable code snippet.
- **Evaluation** — runs the bundled golden dataset (a small shopping-cart codebase + 8 questions) and shows aggregate metric cards plus per-question judge reasoning.

The index persists in `.rag-data/index.json` and survives restarts. Changing `EMBEDDING_MODEL` invalidates it automatically (a model mismatch clears the store).

## API

| Endpoint | Body | Returns |
|---|---|---|
| `POST /api/index/files` | `{ files: [{ path, content }] }` (≤50 files, ≤200KB each, ≤2MB total) | `{ filesIndexed, chunksIndexed, perFile }` |
| `POST /api/query` | `{ question, topK? }` | `{ answer, sources: [{ filePath, snippet, lines, score, chunkId }] }` |
| `POST /api/evaluate` | `{ dataset?, k?, skipJudge?, indexSampleCode? }` | per-question + aggregate metrics; omitted `dataset` → bundled golden dataset |

Errors: `400 {error:"ValidationError", issues}` (Zod), `502 {error:"UpstreamError"}` (OpenRouter), `500 {error:"InternalError"}`.

A custom evaluation dataset item: `{ id, question, relevantChunkIds, referenceAnswer }`. A relevant id is either an exact chunk id (`src/cart.ts#Cart.getTotal`) or a bare file path (`src/cart.ts`, matches any chunk of that file).

## Testing

```bash
pnpm test               # unit tests (no network, no model download, no LLM calls)
pnpm test:watch
pnpm test:integration   # opt-in: downloads the real model / calls OpenRouter
pnpm typecheck
pnpm lint
```

Unit tests run against deterministic fakes (`FakeEmbedder`, `FakeLLMClient`) injected through the `Embedder` / `LLMClient` / `VectorStore` interfaces; `@huggingface/transformers` and `@openrouter/sdk` are mapped to throwing stubs in Jest so an accidental real import fails loudly.

## Configuration (env vars)

| Variable | Default | Notes |
|---|---|---|
| `OPENROUTER_API_KEY` | — | required for querying/judging; the key's OpenRouter config decides the model |
| `EMBEDDING_MODEL` | `Xenova/bge-small-en-v1.5` | any transformers.js-compatible feature-extraction model. The code-specific `jina-embeddings-v2-base-code` models are HF-gated (need a logged-in download) |
| `EMBEDDING_DIMENSION` | `384` | must match the model (e.g. 768 for jina-base models) |
| `RAG_DATA_DIR` | `.rag-data` | index + model cache location |
| `TOP_K_DEFAULT` / `EVAL_K_DEFAULT` | `5` | retrieval depth / metrics cutoff |

## Architecture

```
src/lib/
├── chunker/         AST chunking (TS compiler API): function/class/method chunks,
│                    whole-file or sliding-window fallback
├── embeddings/      Embedder interface · FakeEmbedder · TransformersEmbedder (local ONNX)
├── vector-store/    VectorStore interface · cosineSimilarity · JsonVectorStore
│                    (in-memory + atomic JSON persistence)
├── llm/             LLMClient interface · FakeLLMClient · OpenRouterClient
├── rag/             indexFiles() / answerQuestion() — all dependencies injected
├── eval/            metrics (pure) · LLM judge (Zod-validated verdicts) · runner ·
│                    bundled golden dataset
└── server/          Zod API schemas · service singleton (globalThis-cached) · route helper
```

Design notes:

- **Chunk identity** is `"${filePath}#${name}"` — stable across re-indexing and the contract the evaluation dataset is written against.
- **Everything behind an interface**: swap `JsonVectorStore` for ChromaDB or the embedder for an API later without touching the pipeline.
- The embedding pipeline and store are cached on `globalThis` so dev-mode HMR doesn't reload the model or lose state; the JSON file recovers the index across full restarts.
