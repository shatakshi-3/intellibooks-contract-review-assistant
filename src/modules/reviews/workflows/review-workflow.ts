import { CHECKLIST_ITEMS } from "@/lib/db/schema";
import {
  initReviewStep,
  evaluateCategoryStep,
  finalizeReviewStep,
  handleReviewErrorStep,
} from "./steps";
import { FatalError } from "workflow";

export interface ReviewWorkflowInput {
  contractId: string;
  userId: string;
  contractVersionId?: string;
}

/**
 * Durable Contract Review Workflow.
 *
 * Implements Vercel Workflow SDK durable execution:
 * 1. Initializes review, locks version pin & extracted text hash.
 * 2. Evaluates each of the 8 checklist categories sequentially via retryable steps.
 * 3. Applies deterministic quote verification and coverage checks on each finding.
 * 4. Finalizes review state and persists audit metadata.
 */
export async function contractReviewWorkflow(input: ReviewWorkflowInput) {
  "use workflow";

  let reviewId = "";

  try {
    // Step 1: Initialize review & pin version
    const init = await initReviewStep(input);
    reviewId = init.reviewId;
    const startTime = Date.now();

    // Step 2: Iterate over all 8 checklist categories
    for (const category of CHECKLIST_ITEMS) {
      await evaluateCategoryStep({
        reviewId: init.reviewId,
        contractId: input.contractId,
        userId: input.userId,
        contractVersionId: init.contractVersionId,
        fullExtractedText: init.fullExtractedText,
        category,
      });
    }

    // Step 3: Finalize review status
    const durationMs = Date.now() - startTime;
    const finalization = await finalizeReviewStep({
      reviewId: init.reviewId,
      contractId: input.contractId,
      userId: input.userId,
      durationMs,
    });

    return {
      success: true,
      reviewId: init.reviewId,
      contractId: input.contractId,
      overallStatus: finalization.overallStatus,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (reviewId) {
      await handleReviewErrorStep({
        reviewId,
        error: errorMsg,
      });
    }

    throw new FatalError(`Contract review workflow failed: ${errorMsg}`);
  }
}
