import { EvalPanel } from "@/components/eval/eval-panel";
import { IndexingSection } from "@/components/indexing/indexing-section";
import { QuerySection } from "@/components/query/query-section";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6 sm:p-10">
      <header>
        <h1 className="text-3xl font-bold">Codebase RAG</h1>
        <p className="mt-1 text-neu-muted">
          Index your code, ask questions about it, and measure how well the answers hold up.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <IndexingSection />
        <QuerySection />
      </div>

      <EvalPanel />
    </main>
  );
}
