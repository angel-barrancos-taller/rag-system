import { NextResponse } from "next/server";
import { z } from "zod";

import { LLMError } from "@/lib/llm/llm-client";

/**
 * Shared route plumbing: JSON parse → Zod validation → handler, with the
 * common error envelope (400 validation, 502 upstream LLM, 500 internal).
 */
export async function handleJsonRoute<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
  handler: (body: z.infer<Schema>) => Promise<unknown>,
): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "ValidationError",
        issues: { errors: ["Request body must be valid JSON"] },
      },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "ValidationError", issues: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await handler(parsed.data));
  } catch (error) {
    if (error instanceof LLMError) {
      return NextResponse.json(
        { error: "UpstreamError", message: error.message },
        { status: 502 },
      );
    }
    console.error("[api] unhandled error:", error);
    return NextResponse.json({ error: "InternalError" }, { status: 500 });
  }
}
