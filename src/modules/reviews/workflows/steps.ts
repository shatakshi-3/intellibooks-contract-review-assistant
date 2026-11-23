import { db } from "@/lib/db";
import {
  reviews,
  reviewFindings,
  contractVersions,
  documentChunks,
  type ChecklistItem,
} from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireContractOwnership } from "@/lib/auth/protect";
import { getAIConfig } from "@/ai/types";
import { EvidenceRetriever } from "../evidence-retriever";
import { ReviewEngine } from "../engine";
import { logger } from "@/lib/logger";
import { FatalError } from "workflow";

export interface InitReviewOutput {
  reviewId: string;
  contractVersionId: string;
  contentHash: string;
  fullExtractedText: string;
  totalChunks: number;
}

export interface EvaluateCategoryOutput {
  category: ChecklistItem;
  status: "found" | "not_found" | "unclear";
  findingId: string;
}

/**
 * Step 1: Initialize review, pin contract version and hash, prevent duplicate processing.
 */
export async function initReviewStep(input: {
  contractId: string;
  userId: string;
  contractVersionId?: string;
}): Promise<InitReviewOutput> {
  "use step";

  const { contractId, userId, contractVersionId } = input;
  const contract = await requireContractOwnership(contractId, userId);

  if (contract.status !== "ready") {
    throw new FatalError(`Cannot review contract: status is '${contract.status}', must be 'ready'`);
  }

  // Fetch target or latest contract version
  const [version] = contractVersionId
    ? await db
        .select()
        .from(contractVersions)
        .where(
          and(
            eq(contractVersions.id, contractVersionId),
            eq(contractVersions.contractId, contractId)
          )
        )
        .limit(1)
    : await db
        .select()
        .from(contractVersions)
        .where(eq(contractVersions.contractId, contractId))
        .orderBy(desc(contractVersions.versionNumber))
        .limit(1);

  if (!version) {
    throw new FatalError(`No valid contract version found for contract ${contractId}`);
  }

  const fullExtractedText = version.extractedText || contract.extractedText || "";
  if (!fullExtractedText || fullExtractedText.trim().length === 0) {
    throw new FatalError(`Contract version ${version.id} contains no extracted text`);
  }

  const contentHash = version.contentHash || contract.contentHash || "unknown_hash";
  const aiConfig = getAIConfig();

  // Check if an in-progress review already exists for this exact contract and version
  const [existingActiveReview] = await db
    .select()
    .from(reviews)
    .where(
      and(
        eq(reviews.contractId, contractId),
        eq(reviews.contractVersionId, version.id),
        eq(reviews.userId, userId),
        eq(reviews.overallStatus, "processing")
      )
    )
    .limit(1);

  let reviewId: string;
  if (existingActiveReview) {
    reviewId = existingActiveReview.id;
  } else {
    const [createdReview] = await db
      .insert(reviews)
      .values({
        contractId,
        userId,
        contractVersionId: version.id,
        contentHash,
        modelId: aiConfig.reviewModel,
        promptVersion: aiConfig.promptVersion,
        embeddingModel: aiConfig.embeddingModel,
        overallStatus: "processing",
      })
      .returning();
    reviewId = createdReview.id;
  }

  // Count chunks
  const [chunkCountRecord] = await db
    .select({ id: documentChunks.id })
    .from(documentChunks)
    .where(
      and(
        eq(documentChunks.contractId, contractId),
        eq(documentChunks.contractVersionId, version.id),
        eq(documentChunks.userId, userId)
      )
    )
    .limit(1);

  const totalChunks = chunkCountRecord ? 1 : 0;

  logger.info("Initialized contract review run", {
    reviewId,
    contractId,
    versionId: version.id,
    contentHash,
  });

  return {
    reviewId,
    contractVersionId: version.id,
    contentHash,
    fullExtractedText,
    totalChunks,
  };
}

/**
 * Step 2: Evaluate a single checklist category.
 */
export async function evaluateCategoryStep(input: {
  reviewId: string;
  contractId: string;
  userId: string;
  contractVersionId: string;
  fullExtractedText: string;
  category: ChecklistItem;
}): Promise<EvaluateCategoryOutput> {
  "use step";

  const { reviewId, contractId, userId, contractVersionId, fullExtractedText, category } = input;

  // Validate review ownership and state inside the workflow step
  const [reviewRecord] = await db
    .select({ id: reviews.id, overallStatus: reviews.overallStatus })
    .from(reviews)
    .where(
      and(
        eq(reviews.id, reviewId),
        eq(reviews.contractId, contractId),
        eq(reviews.userId, userId)
      )
    )
    .limit(1);

  if (!reviewRecord) {
    throw new FatalError("Unauthorized: Review does not belong to specified contract and user");
  }

  // Idempotency guard: never overwrite findings on an already completed review
  if (reviewRecord.overallStatus === "complete") {
    return {
      category,
      status: "found",
      findingId: "already_completed",
    };
  }

  // Retrieve evidence
  const evidence = await EvidenceRetriever.retrieveEvidenceForCategory({
    contractId,
    userId,
    contractVersionId,
    category,
  });

  // Analyze with ReviewEngine (includes quote verification and coverage gates)
  const analysis = await ReviewEngine.analyzeCategory({
    category,
    fullExtractedText,
    evidence,
  });

  // Delete existing finding for this review and category (ensures retry idempotency)
  await db
    .delete(reviewFindings)
    .where(
      and(
        eq(reviewFindings.reviewId, reviewId),
        eq(reviewFindings.checklistItem, category)
      )
    );

  // Insert finding
  const [insertedFinding] = await db
    .insert(reviewFindings)
    .values({
      reviewId,
      contractVersionId,
      checklistItem: category,
      status: analysis.status,
      summary: analysis.summary,
      explanation: analysis.explanation,
      reasoning: analysis.reasoning,
      exactQuote: analysis.exactQuote,
      pageNumber: analysis.pageNumber,
      sectionReference: analysis.sectionReference,
      startCharOffset: analysis.startCharOffset,
      endCharOffset: analysis.endCharOffset,
      locationData: {
        pageNumber: analysis.pageNumber,
        sectionHeading: analysis.sectionReference,
        startCharOffset: analysis.startCharOffset,
        endCharOffset: analysis.endCharOffset,
      },
      quoteVerified: analysis.quoteVerified,
      verificationMethod: analysis.verificationMethod,
      confidenceScore: analysis.confidenceScore,
      confidenceLabel: analysis.confidenceLabel,
      rawEvidence: {
        retrievedChunks: evidence.chunks.map((c) => ({
          chunkId: c.id,
          content: c.content,
          similarity: 0.9,
          pageNumber: c.pageNumber ?? undefined,
          sectionTitle: c.sectionTitle ?? undefined,
        })),
        examinedChunkCount: evidence.examinedChunkCount,
        totalChunkCount: evidence.totalChunkCount,
        documentCoverageRatio: evidence.documentCoverageRatio,
      },
    })
    .returning();

  logger.info("Evaluated review checklist category", {
    reviewId,
    category,
    status: analysis.status,
    verified: analysis.quoteVerified,
  });

  return {
    category,
    status: analysis.status,
    findingId: insertedFinding.id,
  };
}

/**
 * Step 3: Finalize review status and duration.
 */
export async function finalizeReviewStep(input: {
  reviewId: string;
  contractId: string;
  userId: string;
  durationMs: number;
}): Promise<{ success: boolean; overallStatus: "complete" | "partial" }> {
  "use step";

  const { reviewId, contractId, userId, durationMs } = input;

  // Validate review ownership inside workflow step
  const [reviewRecord] = await db
    .select({ id: reviews.id, overallStatus: reviews.overallStatus })
    .from(reviews)
    .where(
      and(
        eq(reviews.id, reviewId),
        eq(reviews.contractId, contractId),
        eq(reviews.userId, userId)
      )
    )
    .limit(1);

  if (!reviewRecord) {
    throw new FatalError("Unauthorized: Review does not belong to specified contract and user");
  }

  if (reviewRecord.overallStatus === "complete") {
    return { success: true, overallStatus: "complete" };
  }

  const findings = await db
    .select({ id: reviewFindings.id, checklistItem: reviewFindings.checklistItem })
    .from(reviewFindings)
    .where(eq(reviewFindings.reviewId, reviewId));

  // Ensure review cannot become complete unless all 8 unique checklist categories are present
  const recordedCategories = new Set(findings.map((f) => f.checklistItem));
  const all8Present = (
    [
      "parties",
      "start_date_and_term",
      "payment_terms",
      "termination",
      "limitation_of_liability",
      "confidentiality",
      "governing_law",
      "auto_renewal",
    ] as const
  ).every((item) => recordedCategories.has(item));

  if (!all8Present) {
    throw new FatalError(
      `Cannot complete review: Expected 8 unique category findings, but found ${recordedCategories.size}/8`
    );
  }

  await db
    .update(reviews)
    .set({
      overallStatus: "complete",
      durationMs,
    })
    .where(eq(reviews.id, reviewId));

  logger.info("Finalized contract review run", {
    reviewId,
    overallStatus: "complete",
    findingsCount: findings.length,
    durationMs,
  });

  return { success: true, overallStatus: "complete" };
}

/**
 * Step 4: Handle unexpected workflow error and record failure state.
 */
export async function handleReviewErrorStep(input: {
  reviewId: string;
  error: string;
}): Promise<{ recorded: boolean }> {
  "use step";

  const { reviewId, error } = input;

  logger.error("Contract review workflow failed", { reviewId, error });

  // Only transition to failed if review is still in processing state;
  // prevent failed retries from damaging an already completed review!
  const [reviewRecord] = await db
    .select({ id: reviews.id, overallStatus: reviews.overallStatus })
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (reviewRecord && reviewRecord.overallStatus === "processing") {
    await db
      .update(reviews)
      .set({
        overallStatus: "failed",
      })
      .where(eq(reviews.id, reviewId));
  }

  return { recorded: true };
}
