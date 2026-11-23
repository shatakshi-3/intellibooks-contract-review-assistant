import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/protect";
import { db } from "@/lib/db";
import { evaluationRuns } from "@/lib/db/schema";
import { desc, count, sql } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { isDemoMode } from "@/demo";

/**
 * GET /api/evaluation/dashboard
 * Aggregated metrics and historical trends across all benchmark runs.
 * Access: Clerk Auth + role: 'admin'
 */
export async function GET() {
  try {
    const { userId } = await requireAuth();
    await requireRole(userId, "admin");

    if (isDemoMode()) {
      try {
        const [totalRunsResult] = await db.select({ total: count() }).from(evaluationRuns);
        if ((totalRunsResult?.total || 0) > 0) {
          // Proceed with database query
        } else {
          return NextResponse.json({
            totalRuns: 3,
            latestRun: {
              id: "eval-demo-01",
              runType: "full",
              modelId: "google/gemini-2.5-flash",
              passRate: 0.9688,
              statusAccuracy: 0.9688,
              quoteValidityRate: 1.0,
              precision: 0.9655,
              recall: 0.9655,
              f1Score: 0.9655,
              durationMs: 4210,
              totalCases: 32,
              passedCases: 31,
              failedCases: 1,
              detailedMetrics: {
                perCategory: {
                  parties: { total: 4, passed: 4, accuracy: 1.0, quoteValidity: 1.0 },
                  start_date_term: { total: 4, passed: 4, accuracy: 1.0, quoteValidity: 1.0 },
                  payment_terms: { total: 4, passed: 4, accuracy: 1.0, quoteValidity: 1.0 },
                  termination: { total: 4, passed: 4, accuracy: 1.0, quoteValidity: 1.0 },
                  limitation_of_liability: { total: 4, passed: 3, accuracy: 0.75, quoteValidity: 1.0 },
                  confidentiality: { total: 4, passed: 4, accuracy: 1.0, quoteValidity: 1.0 },
                  governing_law: { total: 4, passed: 4, accuracy: 1.0, quoteValidity: 1.0 },
                  auto_renewal: { total: 4, passed: 4, accuracy: 1.0, quoteValidity: 1.0 },
                },
              },
              createdAt: new Date().toISOString(),
            },
            recentRuns: [
              {
                id: "eval-demo-01",
                runType: "full",
                modelId: "google/gemini-2.5-flash",
                passRate: 0.9688,
                f1Score: 0.9655,
                quoteValidityRate: 1.0,
                durationMs: 4210,
                createdAt: new Date().toISOString(),
              },
            ],
            averageMetrics: {
              passRate: 0.9688,
              statusAccuracy: 0.9688,
              quoteValidityRate: 1.0,
              f1Score: 0.9655,
            },
          });
        }
      } catch {
        // Fall back to demo
      }
    }

    const [totalRunsResult] = await db.select({ total: count() }).from(evaluationRuns);
    const totalRuns = totalRunsResult?.total || 0;

    // Latest Run
    const [latestRun] = await db
      .select()
      .from(evaluationRuns)
      .orderBy(desc(evaluationRuns.createdAt))
      .limit(1);

    // Recent 10 runs for trend charts
    const recentRuns = await db
      .select({
        id: evaluationRuns.id,
        runType: evaluationRuns.runType,
        modelId: evaluationRuns.modelId,
        passRate: evaluationRuns.passRate,
        f1Score: evaluationRuns.f1Score,
        quoteValidityRate: evaluationRuns.quoteValidityRate,
        durationMs: evaluationRuns.durationMs,
        createdAt: evaluationRuns.createdAt,
      })
      .from(evaluationRuns)
      .orderBy(desc(evaluationRuns.createdAt))
      .limit(10);

    // Averages across all runs
    const [averages] = await db
      .select({
        avgPassRate: sql<number>`COALESCE(AVG(${evaluationRuns.passRate}), 0)`,
        avgStatusAccuracy: sql<number>`COALESCE(AVG(${evaluationRuns.statusAccuracy}), 0)`,
        avgQuoteValidityRate: sql<number>`COALESCE(AVG(${evaluationRuns.quoteValidityRate}), 0)`,
        avgF1Score: sql<number>`COALESCE(AVG(${evaluationRuns.f1Score}), 0)`,
      })
      .from(evaluationRuns);

    return NextResponse.json({
      totalRuns,
      latestRun: latestRun || null,
      recentRuns,
      averageMetrics: {
        passRate: Number(Number(averages?.avgPassRate || 0).toFixed(4)),
        statusAccuracy: Number(Number(averages?.avgStatusAccuracy || 0).toFixed(4)),
        quoteValidityRate: Number(Number(averages?.avgQuoteValidityRate || 0).toFixed(4)),
        f1Score: Number(Number(averages?.avgF1Score || 0).toFixed(4)),
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
