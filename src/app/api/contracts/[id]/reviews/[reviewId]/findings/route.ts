import { NextResponse } from "next/server";
import { requireAuth, requireContractOwnership } from "@/lib/auth/protect";
import { AppError } from "@/lib/errors";
import { db } from "@/lib/db";
import { reviews, reviewFindings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const paramsSchema = z.object({
  id: z.string(),
  reviewId: z.string(),
});

/**
 * GET /api/contracts/[id]/reviews/[reviewId]/findings
 * Fetches all checklist findings for a verified review.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const resolvedParams = await params;

    const parseResult = paramsSchema.safeParse(resolvedParams);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const { id: contractId, reviewId } = parseResult.data;
    await requireContractOwnership(contractId, userId);

    // Verify review belongs to this contract
    const [reviewRecord] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.id, reviewId), eq(reviews.contractId, contractId)))
      .limit(1);

    if (!reviewRecord) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const findings = await db
      .select()
      .from(reviewFindings)
      .where(eq(reviewFindings.reviewId, reviewId));

    return NextResponse.json({
      reviewId,
      contractId,
      findings,
    });
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
