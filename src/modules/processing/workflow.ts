/**
 * Durable Document Processing Pipeline.
 *
 * Implements the 10-step extraction, chunking, embedding, and vector storage workflow:
 * 1. Validate uploaded contract
 * 2. Retrieve private Blob object
 * 3. Extract document text
 * 4. Validate extraction output
 * 5. Persist extracted text and metadata
 * 6. Generate structure-aware chunks
 * 7. Persist chunks
 * 8. Generate embeddings in batches
 * 9. Persist embeddings
 * 10. Mark the contract ready
 */

import crypto from "crypto";
import { db } from "@/lib/db";
import { contracts, contractVersions, documentChunks, processingJobs } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireContractOwnership } from "@/lib/auth/protect";
import { extractDocument, type ExtractionResult } from "./extractors";
import { DocumentChunker, type DocumentChunkData } from "./chunker";
import { EmbeddingService, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "@/modules/embeddings";
import { logger } from "@/lib/logger";

export interface PipelineOptions {
  customBuffer?: Buffer;
  batchSize?: number;
}

export interface PipelineExecutionResult {
  contractId: string;
  versionId: string;
  status: "ready" | "failed";
  pageCount: number;
  chunkCount: number;
  embeddingCount: number;
  stages: Record<string, { status: string; durationMs: number; details?: Record<string, unknown> }>;
  error?: string;
}

export class DocumentProcessingPipeline {
  /**
   * Run the full processing pipeline for a contract with step-level durability and state recording.
   */
  static async processContract(
    contractId: string,
    userId: string,
    options?: PipelineOptions
  ): Promise<PipelineExecutionResult> {
    const startTime = Date.now();
    const stages: Record<string, { status: string; durationMs: number; details?: Record<string, unknown> }> = {};

    // 1. Validate contract ownership and existence
    const contract = await requireContractOwnership(contractId, userId);

    // Find or create processing job
    let [job] = await db
      .select()
      .from(processingJobs)
      .where(and(eq(processingJobs.contractId, contractId), eq(processingJobs.userId, userId)))
      .orderBy(desc(processingJobs.createdAt))
      .limit(1);

    if (!job) {
      [job] = await db
        .insert(processingJobs)
        .values({
          contractId,
          userId,
          jobType: "full_pipeline",
          status: "processing",
          currentStep: "downloading",
          startedAt: new Date(),
        })
        .returning();
    } else {
      await db
        .update(processingJobs)
        .set({
          status: "processing",
          currentStep: "downloading",
          attemptCount: job.attemptCount + 1,
          startedAt: new Date(),
          errorMessage: null,
        })
        .where(eq(processingJobs.id, job.id));
    }

    // Update contract status to processing
    await db
      .update(contracts)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(contracts.id, contractId));

    try {
      // 2. Retrieve document buffer (from memory if provided, or fetch from private blobUrl)
      const stepStartDownload = Date.now();
      await this.updateJobStep(job.id, "downloading");

      let fileBuffer = options?.customBuffer;
      if (!fileBuffer) {
        if (!contract.blobUrl) {
          throw new Error("Contract record is missing blobUrl for storage retrieval");
        }
        const response = await fetch(contract.blobUrl);
        if (!response.ok) {
          throw new Error(`Failed to download document from storage: ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      }

      stages.downloading = {
        status: "completed",
        durationMs: Date.now() - stepStartDownload,
        details: { byteSize: fileBuffer.length },
      };

      // 3. Extract text
      const stepStartExtract = Date.now();
      await this.updateJobStep(job.id, "extracting");

      const fileType = contract.fileType as "pdf" | "docx" | "txt";
      const extraction: ExtractionResult = await extractDocument(fileBuffer, fileType);

      // 4. Validate extraction output
      if (!extraction.fullText || extraction.fullText.trim().length === 0) {
        throw new Error("Extraction returned empty text content");
      }

      // Compute content hash for idempotency and change detection
      const contentHash = crypto.createHash("sha256").update(extraction.fullText).digest("hex");

      stages.extracting = {
        status: "completed",
        durationMs: Date.now() - stepStartExtract,
        details: {
          charCount: extraction.metadata.charCount,
          wordCount: extraction.metadata.wordCount,
          pageCount: extraction.pageCount,
        },
      };

      // 5. Persist extracted text and metadata
      const stepStartPersistExtract = Date.now();
      await this.updateJobStep(job.id, "persisting_extraction");

      // Retrieve or create contract_version record
      const [existingVersion] = await db
        .select()
        .from(contractVersions)
        .where(and(eq(contractVersions.contractId, contractId), eq(contractVersions.versionNumber, 1)))
        .limit(1);

      let versionId: string;
      if (existingVersion) {
        versionId = existingVersion.id;
        await db
          .update(contractVersions)
          .set({
            extractedText: extraction.fullText,
            contentHash,
            pageCount: extraction.pageCount,
            structureMetadata: {
              sections: extraction.sections.map((s) => ({
                title: s.title,
                number: String(s.level),
                startOffset: s.startOffset,
                endOffset: s.endOffset,
                pageNumber: s.pageNumber,
              })),
            },
          })
          .where(eq(contractVersions.id, versionId));
      } else {
        const [createdVersion] = await db
          .insert(contractVersions)
          .values({
            contractId,
            versionNumber: 1,
            blobUrl: contract.blobUrl,
            storageKey: contract.storageKey,
            extractedText: extraction.fullText,
            contentHash,
            pageCount: extraction.pageCount,
            structureMetadata: {
              sections: extraction.sections.map((s) => ({
                title: s.title,
                number: String(s.level),
                startOffset: s.startOffset,
                endOffset: s.endOffset,
                pageNumber: s.pageNumber,
              })),
            },
          })
          .returning();
        versionId = createdVersion.id;
      }

      // Update contract root record with extracted summary and hash
      await db
        .update(contracts)
        .set({
          extractedText: extraction.fullText,
          contentHash,
          pageCount: extraction.pageCount,
          updatedAt: new Date(),
        })
        .where(eq(contracts.id, contractId));

      stages.persisting_extraction = {
        status: "completed",
        durationMs: Date.now() - stepStartPersistExtract,
      };

      // 6. Generate structure-aware chunks
      const stepStartChunk = Date.now();
      await this.updateJobStep(job.id, "chunking");

      const chunker = new DocumentChunker();
      const chunksData: DocumentChunkData[] = chunker.chunk(extraction);

      if (chunksData.length === 0) {
        throw new Error("Chunking produced 0 valid chunks from extracted text");
      }

      stages.chunking = {
        status: "completed",
        durationMs: Date.now() - stepStartChunk,
        details: { chunkCount: chunksData.length },
      };

      // 7. Clean existing chunks for this version (prevents duplicates on job retries)
      await db
        .delete(documentChunks)
        .where(and(eq(documentChunks.contractId, contractId), eq(documentChunks.contractVersionId, versionId)));

      // 8. Generate embeddings in controlled batches with retries
      const stepStartEmbed = Date.now();
      await this.updateJobStep(job.id, "embedding");

      const chunkContents = chunksData.map((c) => c.content);
      const embeddings = await EmbeddingService.generateEmbeddings(chunkContents, {
        batchSize: options?.batchSize,
      });

      if (embeddings.length !== chunksData.length) {
        throw new Error(
          `Embedding mismatch: generated ${embeddings.length} embeddings for ${chunksData.length} chunks`
        );
      }

      stages.embedding = {
        status: "completed",
        durationMs: Date.now() - stepStartEmbed,
        details: { vectorCount: embeddings.length, dimensions: EMBEDDING_DIMENSIONS },
      };

      // 9. Persist chunks with vectors
      const stepStartPersistChunks = Date.now();
      await this.updateJobStep(job.id, "persisting_vectors");

      const insertRecords = chunksData.map((chunk, idx) => ({
        contractVersionId: versionId,
        contractId,
        userId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        pageNumber: chunk.pageNumber ?? 1,
        sectionTitle: chunk.sectionTitle,
        startCharOffset: chunk.startCharOffset,
        endCharOffset: chunk.endCharOffset,
        embedding: embeddings[idx],
        embeddingModel: EMBEDDING_MODEL,
        metadata: chunk.metadata,
      }));

      // Insert chunks in chunks of 50 to optimize database roundtrips
      const dbBatchSize = 50;
      for (let i = 0; i < insertRecords.length; i += dbBatchSize) {
        await db.insert(documentChunks).values(insertRecords.slice(i, i + dbBatchSize));
      }

      stages.persisting_vectors = {
        status: "completed",
        durationMs: Date.now() - stepStartPersistChunks,
      };

      // 10. Mark the contract ready & job completed
      await db
        .update(contracts)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(contracts.id, contractId));

      await db
        .update(processingJobs)
        .set({
          status: "completed",
          currentStep: "completed",
          completedAt: new Date(),
          stepResults: stages,
        })
        .where(eq(processingJobs.id, job.id));

      logger.info("Contract processing pipeline completed successfully", {
        contractId,
        userId,
        pageCount: extraction.pageCount,
        chunkCount: chunksData.length,
        totalDurationMs: Date.now() - startTime,
      });

      return {
        contractId,
        versionId,
        status: "ready",
        pageCount: extraction.pageCount,
        chunkCount: chunksData.length,
        embeddingCount: embeddings.length,
        stages,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error("Contract processing pipeline failed", {
        contractId,
        userId,
        error: errorMsg,
      });

      // Update job and contract to failed state
      await db
        .update(processingJobs)
        .set({
          status: "failed",
          errorMessage: errorMsg,
          completedAt: new Date(),
          stepResults: stages,
        })
        .where(eq(processingJobs.id, job.id));

      await db
        .update(contracts)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(contracts.id, contractId));

      return {
        contractId,
        versionId: "",
        status: "failed",
        pageCount: 0,
        chunkCount: 0,
        embeddingCount: 0,
        stages,
        error: errorMsg,
      };
    }
  }

  private static async updateJobStep(jobId: string, step: string) {
    await db
      .update(processingJobs)
      .set({ currentStep: step })
      .where(eq(processingJobs.id, jobId));
  }
}
