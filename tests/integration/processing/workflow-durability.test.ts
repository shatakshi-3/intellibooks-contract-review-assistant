/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/contracts/[id]/process/route";
import {
  chunkAndPersistStep,
  generateAndSaveEmbeddingsStep,
  finalizeContractStep,
  handleWorkflowErrorStep,
} from "@/modules/processing/workflows/steps";
import { HookConflictError } from "workflow/errors";

// Mock @/lib/auth/protect
vi.mock("@/lib/auth/protect", () => ({
  requireAuth: vi.fn(),
  requireContractOwnership: vi.fn(),
}));

// Mock workflow/api
vi.mock("workflow/api", () => ({
  start: vi.fn(),
}));

// Mock @/lib/db
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock @/modules/embeddings
const dummyVector = new Array(1536).fill(0.01);
vi.mock("@/modules/embeddings", () => ({
  EMBEDDING_MODEL: "openai/text-embedding-3-small",
  EMBEDDING_DIMENSIONS: 1536,
  EmbeddingService: {
    generateEmbeddings: vi.fn(),
  },
}));

import { requireAuth, requireContractOwnership } from "@/lib/auth/protect";
import { start } from "workflow/api";
import { db } from "@/lib/db";
import { EmbeddingService } from "@/modules/embeddings";

describe("Vercel Workflow Durability, Failure Simulation & Idempotency", () => {
  const userId = "usr_00000000-0000-0000-0000-000000000001";
  const otherUserId = "usr_99999999-9999-9999-9999-999999999999";
  const contractId = "123e4567-e89b-12d3-a456-426614174000";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("API Route Handler: POST /api/contracts/[id]/process", () => {
    it("dispatches workflow run via start() and returns 202 Accepted immediately without blocking", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireContractOwnership).mockResolvedValue({
        id: contractId,
        userId,
        status: "uploaded",
        blobUrl: "https://blob.vercel.com/contract.pdf",
        fileType: "pdf",
      } as any);

      vi.mocked(start).mockResolvedValue({
        runId: "run_test_12345",
      } as any);

      const request = new Request("http://localhost:3000/api/contracts/" + contractId + "/process", {
        method: "POST",
      });

      const response = await POST(request, { params: Promise.resolve({ id: contractId }) });
      expect(response.status).toBe(202);

      const body = await response.json();
      expect(body.started).toBe(true);
      expect(body.runId).toBe("run_test_12345");
      expect(body.status).toBe("processing");
      expect(body.contractId).toBe(contractId);

      // Verify start was called with experimental_hook idempotency token
      expect(start).toHaveBeenCalledWith(
        expect.any(Function),
        [{ contractId, userId }],
        { experimental_hook: { token: `contract-processing:${contractId}` } }
      );
    });

    it("handles duplicate workflow invocations gracefully using HookConflictError (409 Conflict)", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireContractOwnership).mockResolvedValue({
        id: contractId,
        userId,
        status: "processing",
        blobUrl: "https://blob.vercel.com/contract.pdf",
        fileType: "pdf",
      } as any);

      const conflictError = new HookConflictError(
        `contract-processing:${contractId}`,
        "run_existing_owner_999"
      );
      vi.mocked(start).mockRejectedValue(conflictError);

      const request = new Request("http://localhost:3000/api/contracts/" + contractId + "/process", {
        method: "POST",
      });

      const response = await POST(request, { params: Promise.resolve({ id: contractId }) });
      expect(response.status).toBe(409);

      const body = await response.json();
      expect(body.started).toBe(false);
      expect(body.runId).toBe("run_existing_owner_999");
      expect(body.status).toBe("already_running");
    });

    it("returns 200 immediately if the contract is already processed and ready", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireContractOwnership).mockResolvedValue({
        id: contractId,
        userId,
        status: "ready",
      } as any);

      const request = new Request("http://localhost:3000/api/contracts/" + contractId + "/process", {
        method: "POST",
      });

      const response = await POST(request, { params: Promise.resolve({ id: contractId }) });
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.status).toBe("ready");
      expect(start).not.toHaveBeenCalled();
    });

    it("blocks cross-user trigger attempts and enforces tenant isolation", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId: otherUserId } as any);
      vi.mocked(requireContractOwnership).mockRejectedValue(
        new Error("Contract not found or unauthorized")
      );

      const request = new Request("http://localhost:3000/api/contracts/" + contractId + "/process", {
        method: "POST",
      });

      const response = await POST(request, { params: Promise.resolve({ id: contractId }) });
      expect(response.status).toBe(500);
      expect(start).not.toHaveBeenCalled();
    });
  });

  describe("Failure Simulation & Database State Consistency", () => {
    it("deletes existing chunks before re-inserting during step retries to prevent duplicate chunks", async () => {
      const deleteWhere = vi.fn().mockResolvedValue({});
      vi.mocked(db.delete).mockReturnValue({ where: deleteWhere } as any);

      const insertValues = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: "chk_001",
            chunkIndex: 0,
            content: "Section 1 content",
            pageNumber: 1,
            startCharOffset: 0,
            endCharOffset: 17,
          },
        ]),
      });
      vi.mocked(db.insert).mockReturnValue({ values: insertValues } as any);

      const result = await chunkAndPersistStep({
        contractId,
        userId,
        versionId: "ver_001",
        fullText: "Section 1 content. This is a complete test paragraph for contract review.",
        pageCount: 1,
        sections: [{ title: "Section 1", level: 1, startOffset: 0, endOffset: 74, pageNumber: 1 }],
      });

      expect(deleteWhere).toHaveBeenCalled();
      expect(result.chunkCount).toBe(1);
    });

    it("throws and stops pipeline when embedding generation fails on batch 2", async () => {
      vi.mocked(EmbeddingService.generateEmbeddings).mockRejectedValue(
        new Error("OpenRouter API 500: Internal server error on batch 2")
      );

      const chunks = [
        { id: "chk_001", chunkIndex: 0, content: "Test chunk", pageNumber: 1, startCharOffset: 0, endCharOffset: 10 },
      ];

      await expect(
        generateAndSaveEmbeddingsStep({
          contractId,
          userId,
          versionId: "ver_001",
          chunks,
        })
      ).rejects.toThrow("OpenRouter API 500");
    });

    it("ensures a contract CANNOT become ready if any chunk is missing a valid 1536-dim embedding", async () => {
      // Mock db.select returning 2 chunks, but one has a null embedding
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: "chk_001", embedding: dummyVector },
            { id: "chk_002", embedding: null }, // Missing embedding!
          ]),
        }),
      } as any);

      await expect(
        finalizeContractStep({
          contractId,
          userId,
          versionId: "ver_001",
        })
      ).rejects.toThrow("chunks lack 1536-dim embeddings");
    });

    it("records failure state in both contracts and processing_jobs when error handler executes", async () => {
      const updateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) });
      vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);

      const result = await handleWorkflowErrorStep({
        contractId,
        userId,
        error: "Corrupted document extraction failure",
      });

      expect(result.recorded).toBe(true);
      expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
    });
  });
});
