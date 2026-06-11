import { GOLDEN_DATASET } from "@/lib/eval/golden/dataset";
import { SAMPLE_FILES } from "@/lib/eval/golden/samples";
import { runEvaluation } from "@/lib/eval/runner";
import { indexFiles } from "@/lib/rag/pipeline";
import { EvaluateRequestSchema } from "@/lib/server/api-schemas";
import { handleJsonRoute } from "@/lib/server/route-helpers";
import { getServices } from "@/lib/server/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleJsonRoute(request, EvaluateRequestSchema, async (body) => {
    const services = getServices();
    const usingBundledDataset = !body.dataset;

    if (usingBundledDataset && body.indexSampleCode) {
      await indexFiles(services, SAMPLE_FILES);
    }

    return runEvaluation(services, body.dataset ?? GOLDEN_DATASET, {
      k: body.k,
      skipJudge: body.skipJudge,
    });
  });
}
