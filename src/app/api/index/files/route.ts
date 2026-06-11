import { indexFiles } from "@/lib/rag/pipeline";
import { IndexFilesRequestSchema } from "@/lib/server/api-schemas";
import { handleJsonRoute } from "@/lib/server/route-helpers";
import { getServices } from "@/lib/server/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleJsonRoute(request, IndexFilesRequestSchema, async (body) => {
    return indexFiles(getServices(), body.files);
  });
}
