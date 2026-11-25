/**
 * Contract domain service.
 *
 * Implements core lifecycle operations for contracts:
 * creation, listing, ownership-enforced retrieval, upload verification, and deletion.
 */

import { db } from "@/lib/db";
import { contracts, contractVersions, processingJobs, type Contract } from "@/lib/db/schema";
import { eq, and, desc, asc, count } from "drizzle-orm";
import { requireContractOwnership } from "@/lib/auth/protect";
import { safeDeleteBlob } from "@/lib/storage/blob";
import { logger } from "@/lib/logger";
import type { CreateContractInput, ListContractsInput } from "@/lib/validation/contracts";

export interface CreateContractParams extends CreateContractInput {
  userId: string;
}

export class ContractsService {
  /**
   * Create a pending contract record before client upload.
   */
  static async createPendingContract(params: CreateContractParams): Promise<Contract> {
    const { userId, filename, fileSize, fileType, contentType } = params;

    const [contract] = await db
      .insert(contracts)
      .values({
        userId,
        originalFilename: filename,
        fileType,
        fileSizeBytes: fileSize,
        status: "pending_upload",
        metadata: { contentType },
      })
      .returning();

    // Assign a clean, unique storage key
    const storageKey = `contracts/${userId}/${contract.id}/${encodeURIComponent(filename)}`;

    const [updated] = await db
      .update(contracts)
      .set({ storageKey })
      .where(eq(contracts.id, contract.id))
      .returning();

    logger.info("Created pending contract record", {
      contractId: contract.id,
      userId,
      filename,
      storageKey,
    });

    return updated;
  }

  /**
   * List contracts for a specific user with pagination and sorting.
   */
  static async listContracts(userId: string, query: ListContractsInput) {
    const { page, limit, status, sortBy, sortOrder } = query;
    const offset = (page - 1) * limit;

    const whereClause = status
      ? and(eq(contracts.userId, userId), eq(contracts.status, status))
      : eq(contracts.userId, userId);

    // Determine sort column
    const orderFn = sortOrder === "asc" ? asc : desc;
    let orderClause = orderFn(contracts.createdAt);
    if (sortBy === "original_filename") {
      orderClause = orderFn(contracts.originalFilename);
    } else if (sortBy === "status") {
      orderClause = orderFn(contracts.status);
    }

    const [items, totalResult] = await Promise.all([
      db
        .select()
        .from(contracts)
        .where(whereClause)
        .orderBy(orderClause)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(contracts)
        .where(whereClause),
    ]);

    const total = totalResult[0]?.count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieve contract detail, strictly enforcing ownership.
   */
  static async getContractById(contractId: string, userId: string): Promise<Contract> {
    return await requireContractOwnership(contractId, userId);
  }

  /**
   * Delete contract, its Vercel Blob file, and cascade all database relations.
   */
  static async deleteContract(contractId: string, userId: string): Promise<{ success: boolean }> {
    const contract = await requireContractOwnership(contractId, userId);

    // 1. Delete associated blob storage object safely
    const storageTarget = contract.blobUrl || contract.storageKey;
    if (storageTarget) {
      await safeDeleteBlob(storageTarget);
    }

    // 2. Cascade delete from database (contract_versions, document_chunks, processing_jobs, reviews)
    await db
      .delete(contracts)
      .where(and(eq(contracts.id, contractId), eq(contracts.userId, userId)));

    logger.info("Deleted contract and storage objects", { contractId, userId });

    return { success: true };
  }

  /**
   * Verify and complete an upload callback.
   * Handles duplicate callbacks idempotently.
   */
  static async verifyAndCompleteUpload(params: {
    contractId: string;
    userId: string;
    blobUrl: string;
    storageKey?: string;
    fileSizeBytes?: number;
    contentType?: string;
  }): Promise<{ contract: Contract; isNewCompletion: boolean }> {
    const { contractId, userId, blobUrl, storageKey, fileSizeBytes } = params;

    const contract = await requireContractOwnership(contractId, userId);

    // Idempotency: If already uploaded or processing, do not re-process
    if (contract.status !== "pending_upload" && contract.status !== "uploading") {
      logger.info("Upload completion callback already processed (idempotent)", {
        contractId,
        currentStatus: contract.status,
      });
      return { contract, isNewCompletion: false };
    }

    // Update contract status to 'uploaded'
    const [updatedContract] = await db
      .update(contracts)
      .set({
        status: "uploaded",
        blobUrl,
        storageKey: storageKey || contract.storageKey,
        fileSizeBytes: fileSizeBytes || contract.fileSizeBytes,
        updatedAt: new Date(),
      })
      .where(and(eq(contracts.id, contractId), eq(contracts.userId, userId)))
      .returning();

    // Create the initial version record
    await db.insert(contractVersions).values({
      contractId,
      versionNumber: 1,
      blobUrl,
      storageKey: storageKey || contract.storageKey,
    });

    // Create queued processing job record
    await db.insert(processingJobs).values({
      contractId,
      userId,
      jobType: "full_pipeline",
      status: "queued",
      attemptCount: 0,
      currentStep: "awaiting_workflow",
    });

    logger.info("Contract upload verified and marked uploaded", {
      contractId,
      userId,
      blobUrl,
    });

    return { contract: updatedContract, isNewCompletion: true };
  }

  /**
   * Get processing status for polling.
   */
  static async getContractStatus(contractId: string, userId: string) {
    const contract = await requireContractOwnership(contractId, userId);

    const jobs = await db
      .select()
      .from(processingJobs)
      .where(and(eq(processingJobs.contractId, contractId), eq(processingJobs.userId, userId)))
      .orderBy(desc(processingJobs.createdAt))
      .limit(1);

    const latestJob = jobs[0] || null;

    return {
      id: contract.id,
      status: contract.status,
      filename: contract.originalFilename,
      fileSize: contract.fileSizeBytes,
      updatedAt: contract.updatedAt,
      job: latestJob
        ? {
            id: latestJob.id,
            status: latestJob.status,
            currentStep: latestJob.currentStep,
            attemptCount: latestJob.attemptCount,
            errorMessage: latestJob.errorMessage,
          }
        : null,
    };
  }

  /**
   * Mark contract upload as failed if client upload or processing initialization fails.
   */
  static async markUploadFailed(
    contractId: string,
    userId: string,
    errorMessage?: string
  ): Promise<Contract> {
    const contract = await requireContractOwnership(contractId, userId);

    // Only update if still in pending/uploading status to prevent overwriting active processing
    if (contract.status === "pending_upload" || contract.status === "uploading") {
      const [updated] = await db
        .update(contracts)
        .set({
          status: "failed",
          metadata: {
            ...((contract.metadata as Record<string, unknown>) || {}),
            uploadError: errorMessage || "Upload failed before completion",
          },
          updatedAt: new Date(),
        })
        .where(and(eq(contracts.id, contractId), eq(contracts.userId, userId)))
        .returning();

      logger.warn("Marked contract upload as failed", {
        contractId,
        userId,
        error: errorMessage,
      });

      return updated;
    }

    return contract;
  }
}
