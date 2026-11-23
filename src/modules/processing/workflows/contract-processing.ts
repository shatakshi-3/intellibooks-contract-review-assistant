import { FatalError } from "workflow";
import {
  validateAndDownloadStep,
  extractDocumentStep,
  persistExtractionStep,
  chunkAndPersistStep,
  generateAndSaveEmbeddingsStep,
  finalizeContractStep,
  handleWorkflowErrorStep,
} from "./steps";

export interface WorkflowInput {
  contractId: string;
  userId: string;
  customBufferBase64?: string;
}

/**
 * Durable Contract Processing Workflow.
 *
 * Implements the Vercel Workflow SDK durable execution pattern:
 * - Deterministic replay with "use workflow"
 * - Isolated, retryable steps marked with "use step"
 * - Event log persistence across suspension and function termination
 * - Zero synchronous processing blocking API Route Handlers
 */
export async function contractProcessingWorkflow(input: WorkflowInput) {
  "use workflow";

  try {
    // Step 1: Validate contract & download buffer
    const downloaded = await validateAndDownloadStep(input);

    // Step 2: Extract text and structural metadata
    const extracted = await extractDocumentStep({
      fileType: downloaded.fileType,
      bufferBase64: downloaded.bufferBase64,
    });

    // Step 3: Persist document version & extracted text
    const version = await persistExtractionStep({
      contractId: input.contractId,
      userId: input.userId,
      fullText: extracted.fullText,
      pageCount: extracted.pageCount,
      contentHash: extracted.contentHash,
      sections: extracted.sections,
    });

    // Step 4: Chunk text structure-aware & persist chunks
    const chunked = await chunkAndPersistStep({
      contractId: input.contractId,
      userId: input.userId,
      versionId: version.versionId,
      fullText: extracted.fullText,
      pageCount: extracted.pageCount,
      pages: extracted.pages,
      sections: extracted.sections,
      fileType: downloaded.fileType,
    });

    // Step 5: Generate and save 1536-dimensional embeddings
    await generateAndSaveEmbeddingsStep({
      contractId: input.contractId,
      userId: input.userId,
      versionId: version.versionId,
      chunks: chunked.chunks,
    });

    // Step 6: Finalize contract verification & transition to 'ready'
    await finalizeContractStep({
      contractId: input.contractId,
      userId: input.userId,
      versionId: version.versionId,
    });

    return {
      success: true,
      contractId: input.contractId,
      chunkCount: chunked.chunkCount,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    await handleWorkflowErrorStep({
      contractId: input.contractId,
      userId: input.userId,
      error: errorMsg,
    });

    // Throw FatalError so non-recoverable pipeline failures are not retried indefinitely
    throw new FatalError(`Contract processing failed: ${errorMsg}`);
  }
}
