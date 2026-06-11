import { z } from "zod";

import { GOLDEN_DATASET } from "@/lib/eval/golden/dataset";

export const MAX_FILE_BYTES = 200_000;
export const MAX_FILES = 50;
export const MAX_TOTAL_BYTES = 2_000_000;
export const SUPPORTED_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
];

export const CodeFileSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(500)
    .regex(/\.(ts|tsx|js|jsx|mjs|cjs)$/, "Only TS/JS files are supported")
    .refine((p) => !p.includes("..") && !p.startsWith("/"), {
      message: "Path must be relative and must not contain '..'",
    }),
  content: z
    .string()
    .max(MAX_FILE_BYTES, `File exceeds ${MAX_FILE_BYTES / 1000}KB`),
});

export const IndexFilesRequestSchema = z
  .object({
    files: z.array(CodeFileSchema).min(1).max(MAX_FILES),
  })
  .refine(
    (body) =>
      body.files.reduce((sum, f) => sum + f.content.length, 0) <=
      MAX_TOTAL_BYTES,
    {
      message: "Total payload exceeds 2MB",
    },
  );

export type IndexFilesRequest = z.infer<typeof IndexFilesRequestSchema>;

export const QueryRequestSchema = z.object({
  question: z.string().min(3).max(2000),
  topK: z.number().int().min(1).max(20).optional(),
});

export type QueryRequest = z.infer<typeof QueryRequestSchema>;

export const GoldenItemSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(3),
  relevantChunkIds: z.array(z.string().min(1)).min(1),
  referenceAnswer: z.string().min(1),
});

export const EvaluateRequestSchema = z.object({
  /** Omitted → the bundled golden dataset. */
  dataset: z.array(GoldenItemSchema).min(1).optional(),
  k: z.number().int().min(1).max(20).default(5),
  skipJudge: z.boolean().default(false),
  /** Index the bundled sample files before evaluating (default dataset only). */
  indexSampleCode: z.boolean().default(true),
});

export type EvaluateRequest = z.infer<typeof EvaluateRequestSchema>;

export { GOLDEN_DATASET };
