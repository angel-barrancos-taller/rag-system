import { getConfig } from "@/lib/config";
import { answerQuestion } from "@/lib/rag/pipeline";
import { QueryRequestSchema } from "@/lib/server/api-schemas";
import { handleJsonRoute } from "@/lib/server/route-helpers";
import { getServices } from "@/lib/server/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleJsonRoute(request, QueryRequestSchema, async (body) => {
    return answerQuestion(
      getServices(),
      body.question,
      body.topK ?? getConfig().TOP_K_DEFAULT,
    );
  });
}
