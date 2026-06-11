import os from "node:os";
import path from "node:path";

process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "test-key";
// Keep tests away from the project's .rag-data directory.
process.env.RAG_DATA_DIR = path.join(os.tmpdir(), "rag-system-tests");
