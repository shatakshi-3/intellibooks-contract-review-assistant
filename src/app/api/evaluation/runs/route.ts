import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/protect";
import { runEvaluationSchema, paginationQuerySchema } from "@/lib/validation/evaluation";
import { EvaluationRunner } from "@/modules/evaluation";
import { db } from "@/lib/db";
import { evaluationRuns } from "@/lib/db/schema";
import { desc, count } from "drizzle-orm";
import { AppError } from "@/lib/errors";

/**
 * POST /api/evaluation/runs
 * Trigger a new QA evaluation benchmark run.
 * Access: Clerk Auth + role: 'admin'
 */
export async function POST(req: Request) {
  try {
    const { userId } = await requireAuth();
    await requireRole(userId, "admin");

    let options = {};
    try {
      const body = await req.json();
      const parseResult = runEvaluationSchema.safeParse(body);
      if (parseResult.success) {
        options = parseResult.data;
      }
    } catch {
      // Body is optional
    }

    const result = await EvaluationRunner.runEvaluation(options);

    return NextResponse.json(
      {
        run: result.run,
        metrics: result.metrics,
        reportMarkdown: result.reportMarkdown,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/evaluation/runs
 * List historical evaluation benchmark runs.
 * Access: Clerk Auth + role: 'admin'
 */
export async function GET(req: Request) {
  try {
    const { userId } = await requireAuth();
    await requireRole(userId, "admin");

    const url = new URL(req.url);
    const parseQuery = paginationQuerySchema.safeParse({
      page: url.searchParams.get("page") || 1,
      limit: url.searchParams.get("limit") || 20,
    });

    const { page, limit } = parseQuery.success ? parseQuery.data : { page: 1, limit: 20 };
    const offset = (page - 1) * limit;

    const [totalResult] = await db.select({ total: count() }).from(evaluationRuns);
    const total = totalResult?.total || 0;

    const runs = await db
      .select()
      .from(evaluationRuns)
      .orderBy(desc(evaluationRuns.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      runs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
