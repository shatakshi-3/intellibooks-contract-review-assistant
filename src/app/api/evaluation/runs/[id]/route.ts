import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/protect";
import { evaluationRunIdSchema } from "@/lib/validation/evaluation";
import { db } from "@/lib/db";
import { evaluationRuns, evaluationCases, type ChecklistItem, type FindingStatus } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { EvaluationReporter, type EvaluationReportMetadata } from "@/modules/evaluation/reporter";
import type { EvaluationMetricsSummary } from "@/modules/evaluation/comparator";

interface RouteProps {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/evaluation/runs/[id]
 * Get detailed evaluation run findings, cases, and formatted report.
 * Access: Clerk Auth + role: 'admin'
 */
export async function GET(_req: Request, { params }: RouteProps) {
  try {
    const { userId } = await requireAuth();
    await requireRole(userId, "admin");

    const resolvedParams = await params;
    const parseResult = evaluationRunIdSchema.safeParse(resolvedParams);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid evaluation run ID" }, { status: 400 });
    }

    const runId = parseResult.data.id;

    const [run] = await db
      .select()
      .from(evaluationRuns)
      .where(eq(evaluationRuns.id, runId))
      .limit(1);

    if (!run) {
      throw AppError.notFound("Evaluation run not found");
    }

    const cases = await db
      .select()
      .from(evaluationCases)
      .where(eq(evaluationCases.runId, runId));

    const metadata: EvaluationReportMetadata = {
      runId: run.id,
      runType: run.runType,
      modelId: run.modelId,
      promptVersion: run.promptVersion,
      embeddingModel: run.embeddingModel ?? undefined,
      durationMs: run.durationMs ?? 0,
      timestamp: run.createdAt.toISOString(),
    };

    const metrics = run.detailedMetrics as unknown as EvaluationMetricsSummary;

    const reportMarkdown = EvaluationReporter.generateMarkdownReport(
      metadata,
      metrics,
      cases.map((c) => ({
        fixtureName: c.fixtureName,
        checklistItem: c.checklistItem as ChecklistItem,
        expectedStatus: c.expectedStatus as FindingStatus,
        actualStatus: (c.actualStatus as FindingStatus) || "not_found",
        statusMatch: !!c.statusMatch,
        expectedQuoteSubstring: c.expectedQuoteSubstring ?? undefined,
        actualQuote: c.actualQuote,
        quoteValid: !!c.quoteValid,
        locationAccurate: !!c.locationAccurate,
        expectedPage: c.expectedPage ?? undefined,
        actualPage: c.actualPage,
        passed: !!c.statusMatch && !!c.quoteValid && !!c.locationAccurate,
        failureReason: c.failureReason ?? undefined,
        rawComparison: (c.rawComparison as Record<string, unknown>) || {},
      }))
    );

    return NextResponse.json({
      run,
      cases,
      metrics,
      reportMarkdown,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
