import crypto from "crypto";
import { db } from "@/lib/db";
import { contracts, contractVersions, documentChunks, processingJobs } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireContractOwnership } from "@/lib/auth/protect";
import { extractDocument, type ExtractionResult } from "../extractors";
import { DocumentChunker, type DocumentChunkData } from "../chunker";
import { EmbeddingService, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "@/modules/embeddings";
import { logger } from "@/lib/logger";
import { FatalError } from "workflow";

export interface DownloadStepOutput {
  contractId: string;
  userId: string;
  fileType: "pdf" | "docx" | "txt";
  bufferBase64: string;
  storageKey: string | null;
}

export interface ExtractStepOutput {
  fullText: string;
  pageCount: number;
  charCount: number;
  wordCount: number;
  contentHash: string;
  pages: Array<{
    pageNumber: number;
    text: string;
    startOffset: number;
    endOffset: number;
  }>;
  sections: Array<{
    title: string;
    level: number;
    startOffset: number;
    endOffset: number;
    pageNumber?: number;
  }>;
}

export interface SerializableChunkItem {
  id: string;
  chunkIndex: number;
  content: string;
  pageNumber: number;
  sectionTitle?: string;
  startCharOffset: number;
  endCharOffset: number;
  metadata?: Record<string, unknown>;
}

/**
 * Step 1: Validate contract ownership and fetch document buffer
 */
export async function validateAndDownloadStep(input: {
  contractId: string;
  userId: string;
  customBufferBase64?: string;
}): Promise<DownloadStepOutput> {
  "use step";

  const { contractId, userId, customBufferBase64 } = input;
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

  let bufferBase64 = customBufferBase64;
  if (!bufferBase64) {
    if (!contract.blobUrl) {
      throw new FatalError("Contract record is missing blobUrl for storage retrieval");
    }
    const { downloadBlobBuffer } = await import("@/lib/storage/blob");
    const downloadedBuffer = await downloadBlobBuffer(contract.blobUrl);
    bufferBase64 = downloadedBuffer.toString("base64");
  }

  return {
    contractId,
    userId,
    fileType: contract.fileType as "pdf" | "docx" | "txt",
    bufferBase64,
    storageKey: contract.storageKey,
  };
}

/**
 * Step 2: Extract text and structure from file buffer
 */
export async function extractDocumentStep(input: {
  fileType: "pdf" | "docx" | "txt";
  bufferBase64: string;
}): Promise<ExtractStepOutput> {
  "use step";

  const fileBuffer = Buffer.from(input.bufferBase64, "base64");
  const extraction: ExtractionResult = await extractDocument(fileBuffer, input.fileType);

  if (!extraction.fullText || extraction.fullText.trim().length === 0) {
    throw new FatalError("Extraction returned empty text content");
  }

  const contentHash = crypto.createHash("sha256").update(extraction.fullText).digest("hex");

  return {
    fullText: extraction.fullText,
    pageCount: extraction.pageCount,
    charCount: extraction.metadata.charCount,
    wordCount: extraction.metadata.wordCount,
    contentHash,
    pages: extraction.pages.map((p) => ({
      pageNumber: p.pageNumber,
      text: p.text,
      startOffset: p.startOffset,
      endOffset: p.endOffset,
    })),
    sections: extraction.sections.map((s) => ({
      title: s.title,
      level: s.level,
      startOffset: s.startOffset,
      endOffset: s.endOffset,
      pageNumber: s.pageNumber,
    })),
  };
}

/**
 * Step 3: Persist document version and update contract extracted text
 */
export async function persistExtractionStep(input: {
  contractId: string;
  userId: string;
  fullText: string;
  pageCount: number;
  contentHash: string;
  sections: Array<{
    title: string;
    level: number;
    startOffset: number;
    endOffset: number;
    pageNumber?: number;
  }>;
}): Promise<{ versionId: string }> {
  "use step";

  const { contractId, fullText, pageCount, contentHash, sections } = input;

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
        extractedText: fullText,
        contentHash,
        pageCount,
        structureMetadata: {
          sections: sections.map((s) => ({
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
        extractedText: fullText,
        contentHash,
        pageCount,
        structureMetadata: {
          sections: sections.map((s) => ({
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

  await db
    .update(contracts)
    .set({
      extractedText: fullText,
      contentHash,
      pageCount,
      updatedAt: new Date(),
    })
    .where(eq(contracts.id, contractId));

  return { versionId };
}

/**
 * Step 4: Chunk document structure-aware and persist chunks
 */
export async function chunkAndPersistStep(input: {
  contractId: string;
  userId: string;
  versionId: string;
  fullText: string;
  pageCount: number;
  fileType?: "pdf" | "docx" | "txt";
  pages?: Array<{
    pageNumber: number;
    text: string;
    startOffset: number;
    endOffset: number;
  }>;
  sections: Array<{
    title: string;
    level: number;
    startOffset: number;
    endOffset: number;
    pageNumber?: number;
  }>;
}): Promise<{ chunkCount: number; chunks: SerializableChunkItem[] }> {
  "use step";

  const { contractId, userId, versionId, fullText, pageCount, sections, fileType, pages } = input;

  const chunker = new DocumentChunker();
  const chunksData: DocumentChunkData[] = chunker.chunk({
    fullText,
    pageCount,
    pages: pages ?? [],
    sections,
    metadata: {
      fileType: fileType ?? "pdf",
      charCount: fullText.length,
      wordCount: fullText.split(/\s+/).length,
    },
  });

  if (chunksData.length === 0) {
    throw new FatalError("Chunking produced 0 valid chunks from extracted text");
  }

  // Remove existing chunks for this version to prevent duplicates on retries
  await db
    .delete(documentChunks)
    .where(and(eq(documentChunks.contractId, contractId), eq(documentChunks.contractVersionId, versionId)));

  const insertPayload = chunksData.map((c) => ({
    contractVersionId: versionId,
    contractId,
    userId,
    chunkIndex: c.chunkIndex,
    content: c.content,
    pageNumber: c.pageNumber ?? 1,
    sectionTitle: c.sectionTitle,
    startCharOffset: c.startCharOffset,
    endCharOffset: c.endCharOffset,
    embedding: null,
    embeddingModel: EMBEDDING_MODEL,
    metadata: c.metadata,
  }));

  const inserted = await db.insert(documentChunks).values(insertPayload).returning();

  return {
    chunkCount: inserted.length,
    chunks: inserted.map((row) => ({
      id: row.id,
      chunkIndex: row.chunkIndex,
      content: row.content,
      pageNumber: row.pageNumber ?? 1,
      sectionTitle: row.sectionTitle ?? undefined,
      startCharOffset: row.startCharOffset ?? 0,
      endCharOffset: row.endCharOffset ?? 0,
      metadata: (row.metadata as Record<string, unknown>) ?? undefined,
    })),
  };
}

/**
 * Step 5: Generate and save 1536-dimensional embeddings
 */
export async function generateAndSaveEmbeddingsStep(input: {
  contractId: string;
  userId: string;
  versionId: string;
  chunks: SerializableChunkItem[];
}): Promise<{ embeddedCount: number }> {
  "use step";

  const { userId, chunks } = input;
  const chunkContents = chunks.map((c) => c.content);

  const embeddings = await EmbeddingService.generateEmbeddings(chunkContents, {
    batchSize: 20,
    model: EMBEDDING_MODEL,
    expectedDimensions: EMBEDDING_DIMENSIONS,
    inputType: "passage",
  });

  if (embeddings.length !== chunks.length) {
    throw new Error(`Embedding count mismatch: expected ${chunks.length}, got ${embeddings.length}`);
  }

  // Persist embeddings for each chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];

    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new FatalError(`Invalid vector dimension: chunk ${chunk.chunkIndex} received ${embedding?.length}`);
    }

    await db
      .update(documentChunks)
      .set({
        embedding,
        embeddingModel: EMBEDDING_MODEL,
      })
      .where(and(eq(documentChunks.id, chunk.id), eq(documentChunks.userId, userId)));
  }

  return { embeddedCount: embeddings.length };
}

/**
 * Step 6: Finalize contract and verify complete vector persistence
 */
export async function finalizeContractStep(input: {
  contractId: string;
  userId: string;
  versionId: string;
}): Promise<{ success: boolean }> {
  "use step";

  const { contractId, userId, versionId } = input;

  // Verify that all chunks for this version possess non-null embeddings
  const remainingChunks = await db
    .select({ id: documentChunks.id, embedding: documentChunks.embedding })
    .from(documentChunks)
    .where(and(eq(documentChunks.contractId, contractId), eq(documentChunks.contractVersionId, versionId)));

  if (remainingChunks.length === 0) {
    throw new FatalError("Cannot finalize contract: zero chunks found");
  }

  const missingEmbeddings = remainingChunks.filter((c) => !c.embedding || c.embedding.length !== EMBEDDING_DIMENSIONS);
  if (missingEmbeddings.length > 0) {
    throw new FatalError(
      `Cannot finalize contract: ${missingEmbeddings.length}/${remainingChunks.length} chunks lack ${EMBEDDING_DIMENSIONS}-dim embeddings`
    );
  }

  // Update contract status to ready
  await db
    .update(contracts)
    .set({ status: "ready", updatedAt: new Date() })
    .where(and(eq(contracts.id, contractId), eq(contracts.userId, userId)));

  // Update processing jobs to completed
  await db
    .update(processingJobs)
    .set({
      status: "completed",
      currentStep: "completed",
      completedAt: new Date(),
    })
    .where(and(eq(processingJobs.contractId, contractId), eq(processingJobs.userId, userId)));

  logger.info("Durable contract processing workflow finalized successfully", {
    contractId,
    userId,
    chunkCount: remainingChunks.length,
  });

  return { success: true };
}

/**
 * Step 7: Record failure state
 */
export async function handleWorkflowErrorStep(input: {
  contractId: string;
  userId: string;
  error: string;
}): Promise<{ recorded: boolean }> {
  "use step";

  const { contractId, userId, error } = input;

  logger.error("Durable contract processing workflow recorded failure", {
    contractId,
    userId,
    error,
  });

  await db
    .update(contracts)
    .set({ status: "failed", updatedAt: new Date() })
    .where(and(eq(contracts.id, contractId), eq(contracts.userId, userId)));

  await db
    .update(processingJobs)
    .set({
      status: "failed",
      errorMessage: error,
      completedAt: new Date(),
    })
    .where(and(eq(processingJobs.contractId, contractId), eq(processingJobs.userId, userId)));

  return { recorded: true };
}
