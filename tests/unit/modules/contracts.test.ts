/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContractsService } from "@/modules/contracts/service";
import { AppError } from "@/lib/errors";

// Mock @/lib/db
vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock @/lib/storage/blob
vi.mock("@/lib/storage/blob", () => ({
  safeDeleteBlob: vi.fn().mockResolvedValue(true),
}));

// Mock @/lib/auth/protect
vi.mock("@/lib/auth/protect", () => ({
  requireContractOwnership: vi.fn(),
}));

import { db } from "@/lib/db";
import { safeDeleteBlob } from "@/lib/storage/blob";
import { requireContractOwnership } from "@/lib/auth/protect";

describe("ContractsService Unit Tests", () => {
  const userId = "usr_00000000-0000-0000-0000-000000000001";
  const contractId = "ctr_11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPendingContract", () => {
    it("creates contract record with status pending_upload and assigns unique storage key", async () => {
      const mockContract = {
        id: contractId,
        userId,
        originalFilename: "consulting_agreement.pdf",
        fileType: "pdf",
        fileSizeBytes: 1024 * 500,
        status: "pending_upload",
      };

      const mockUpdated = {
        ...mockContract,
        storageKey: `contracts/${userId}/${contractId}/consulting_agreement.pdf`,
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockContract]),
        }),
      } as any);

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUpdated]),
          }),
        }),
      } as any);

      const result = await ContractsService.createPendingContract({
        userId,
        filename: "consulting_agreement.pdf",
        fileSize: 1024 * 500,
        fileType: "pdf",
        contentType: "application/pdf",
      });

      expect(result.id).toBe(contractId);
      expect(result.status).toBe("pending_upload");
      expect(result.storageKey).toContain(`contracts/${userId}/${contractId}`);
    });
  });

  describe("getContractById", () => {
    it("returns contract when ownership is verified", async () => {
      const mockContract = { id: contractId, userId, originalFilename: "nda.docx" };
      vi.mocked(requireContractOwnership).mockResolvedValue(mockContract as any);

      const result = await ContractsService.getContractById(contractId, userId);
      expect(result).toEqual(mockContract);
      expect(requireContractOwnership).toHaveBeenCalledWith(contractId, userId);
    });

    it("throws 404 when requested by a different user (tenant protection)", async () => {
      vi.mocked(requireContractOwnership).mockRejectedValue(AppError.notFound("Contract not found"));

      await expect(
        ContractsService.getContractById(contractId, "usr_another_tenant")
      ).rejects.toThrow(AppError);
    });
  });

  describe("deleteContract", () => {
    it("deletes blob object and database records cleanly", async () => {
      const mockContract = {
        id: contractId,
        userId,
        blobUrl: "https://blob.vercel.com/contracts/contract.pdf",
      };
      vi.mocked(requireContractOwnership).mockResolvedValue(mockContract as any);

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      } as any);

      const result = await ContractsService.deleteContract(contractId, userId);

      expect(safeDeleteBlob).toHaveBeenCalledWith("https://blob.vercel.com/contracts/contract.pdf");
      expect(db.delete).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("proceeds with database cleanup even if blob deletion fails (safe cleanup)", async () => {
      const mockContract = {
        id: contractId,
        userId,
        blobUrl: "https://blob.vercel.com/contracts/missing.pdf",
      };
      vi.mocked(requireContractOwnership).mockResolvedValue(mockContract as any);
      vi.mocked(safeDeleteBlob).mockResolvedValue(false); // Blob delete failed/missing

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      } as any);

      const result = await ContractsService.deleteContract(contractId, userId);
      expect(result.success).toBe(true);
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe("verifyAndCompleteUpload", () => {
    it("transitions status to uploaded and queues initial processing job", async () => {
      const mockContract = {
        id: contractId,
        userId,
        status: "pending_upload",
        fileSizeBytes: 1000,
      };
      vi.mocked(requireContractOwnership).mockResolvedValue(mockContract as any);

      const mockUpdated = { ...mockContract, status: "uploaded", blobUrl: "https://blob.url/1" };
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockUpdated]),
          }),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue({}),
      } as any);

      const result = await ContractsService.verifyAndCompleteUpload({
        contractId,
        userId,
        blobUrl: "https://blob.url/1",
      });

      expect(result.isNewCompletion).toBe(true);
      expect(result.contract.status).toBe("uploaded");
      expect(db.insert).toHaveBeenCalledTimes(2); // contract_versions and processing_jobs
    });

    it("handles duplicate callbacks idempotently without duplicating jobs", async () => {
      const alreadyUploadedContract = {
        id: contractId,
        userId,
        status: "uploaded",
        blobUrl: "https://blob.url/1",
      };
      vi.mocked(requireContractOwnership).mockResolvedValue(alreadyUploadedContract as any);

      const result = await ContractsService.verifyAndCompleteUpload({
        contractId,
        userId,
        blobUrl: "https://blob.url/1",
      });

      expect(result.isNewCompletion).toBe(false);
      expect(db.update).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe("getContractStatus", () => {
    it("returns contract status and latest processing job information", async () => {
      const mockContract = {
        id: contractId,
        userId,
        originalFilename: "service_sla.pdf",
        status: "processing",
        fileSizeBytes: 2048,
        updatedAt: new Date(),
      };
      vi.mocked(requireContractOwnership).mockResolvedValue(mockContract as any);

      const mockJob = {
        id: "job_999",
        status: "extracting",
        currentStep: "extract_text",
        attemptCount: 1,
        errorMessage: null,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockJob]),
            }),
          }),
        }),
      } as any);

      const result = await ContractsService.getContractStatus(contractId, userId);
      expect(result.status).toBe("processing");
      expect(result.job?.currentStep).toBe("extract_text");
    });
  });

  describe("markUploadFailed", () => {
    it("transitions pending_upload contract to failed and persists uploadError in metadata", async () => {
      const mockContract = {
        id: contractId,
        userId,
        status: "pending_upload",
        metadata: { contentType: "application/pdf" },
      };
      const mockFailed = {
        ...mockContract,
        status: "failed",
        metadata: { contentType: "application/pdf", uploadError: "Vercel Blob PUT 400 Bad Request" },
      };

      vi.mocked(requireContractOwnership).mockResolvedValue(mockContract as any);
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockFailed]),
          }),
        }),
      } as any);

      const result = await ContractsService.markUploadFailed(
        contractId,
        userId,
        "Vercel Blob PUT 400 Bad Request"
      );

      expect(result.status).toBe("failed");
      expect((result.metadata as any).uploadError).toBe("Vercel Blob PUT 400 Bad Request");
      expect(db.update).toHaveBeenCalled();
    });

    it("does not overwrite contracts that have already advanced to processing or ready", async () => {
      const readyContract = {
        id: contractId,
        userId,
        status: "ready",
      };
      vi.mocked(requireContractOwnership).mockResolvedValue(readyContract as any);

      const result = await ContractsService.markUploadFailed(contractId, userId, "Delayed error");
      expect(result.status).toBe("ready");
      expect(db.update).not.toHaveBeenCalled();
    });
  });
});
