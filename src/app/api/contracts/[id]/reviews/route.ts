import { NextResponse } from "next/server";
import { requireAuth, requireContractOwnership } from "@/lib/auth/protect";
import { checkRateLimit } from "@/lib/rate-limit";
import { contractIdSchema } from "@/lib/validation/contracts";
import { AppError } from "@/lib/errors";
import { start } from "workflow/api";
import { HookConflictError } from "workflow/errors";
import { contractReviewWorkflow } from "@/modules/reviews/workflows/review-workflow";
import { db } from "@/lib/db";
import { reviews, contractVersions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { isDemoMode, DemoService } from "@/demo";

/**
 * POST /api/contracts/[id]/reviews
 * Initiates an automated contract review run using the Vercel Workflow SDK.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();

    const rateLimit = checkRateLimit(userId, "review");
    if (rateLimit.limited) {
      return NextResponse.json(
        {
          error: "Review rate limit exceeded. Please wait shortly before triggering another review.",
          code: "RATE_LIMITED",
        },
        { status: 429 }
      );
    }
    const resolvedParams = await params;

    const parseResult = contractIdSchema.safeParse(resolvedParams);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid contract ID" }, { status: 400 });
    }

    const contractId = parseResult.data.id;
    const contract = await requireContractOwnership(contractId, userId);

    if (contract.status !== "ready") {
      return NextResponse.json(
        {
          error: `Contract is not ready for review. Current status: '${contract.status}'`,
          code: "CONTRACT_NOT_READY",
        },
        { status: 400 }
      );
    }

    // Get active contract version
    const [version] = await db
      .select({ id: contractVersions.id })
      .from(contractVersions)
      .where(eq(contractVersions.contractId, contractId))
      .orderBy(desc(contractVersions.versionNumber))
      .limit(1);

    if (!version) {
      return NextResponse.json(
        { error: "Contract version not found", code: "VERSION_NOT_FOUND" },
        { status: 404 }
      );
    }

    const hookToken = `contract-review:${contractId}:${version.id}`;

    try {
      const run = await start(contractReviewWorkflow, [
        {
          contractId,
          userId,
          contractVersionId: version.id,
        },
      ], {
        experimental_hook: { token: hookToken },
      });

      return NextResponse.json(
        {
          started: true,
          runId: run.runId,
          status: "processing",
          contractId,
          versionId: version.id,
        },
        { status: 202 }
      );
    } catch (startError) {
      if (HookConflictError.is(startError)) {
        return NextResponse.json(
          {
            started: false,
            runId: startError.conflictingRunId,
            status: "already_running",
            contractId,
            versionId: version.id,
          },
          { status: 409 }
        );
      }
      throw startError;
    }
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/contracts/[id]/reviews
 * Lists review history for this contract, ordered by createdAt DESC.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();

    const rateLimit = checkRateLimit(userId, "review");
    if (rateLimit.limited) {
      return NextResponse.json(
        {
          error: "Review rate limit exceeded. Please wait shortly before triggering another review.",
          code: "RATE_LIMITED",
        },
        { status: 429 }
      );
    }
    const resolvedParams = await params;

    const parseResult = contractIdSchema.safeParse(resolvedParams);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid contract ID" }, { status: 400 });
    }

    const contractId = parseResult.data.id;
    await requireContractOwnership(contractId, userId);

    if (isDemoMode()) {
      try {
        const reviewList = await db
          .select()
          .from(reviews)
          .where(eq(reviews.contractId, contractId))
          .orderBy(desc(reviews.createdAt));
        if (reviewList.length > 0) {
          return NextResponse.json({ reviews: reviewList });
        }
      } catch {
        // Fall back to demo fixtures
      }
      const { review } = DemoService.getReview(contractId);
      return NextResponse.json({ reviews: review ? [review] : [] });
    }

    const reviewList = await db
      .select()
      .from(reviews)
      .where(eq(reviews.contractId, contractId))
      .orderBy(desc(reviews.createdAt));

    return NextResponse.json({ reviews: reviewList });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
