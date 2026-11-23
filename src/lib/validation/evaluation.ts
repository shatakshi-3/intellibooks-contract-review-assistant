import { z } from "zod";

export const runEvaluationSchema = z.object({
  runType: z.enum(["full", "checklist_only", "quote_only"]).default("full"),
  modelId: z.string().optional(),
  promptVersion: z.string().optional(),
});

export const evaluationRunIdSchema = z.object({
  id: z.string().uuid("Invalid evaluation run ID"),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
