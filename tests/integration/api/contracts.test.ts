/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as createContract, GET as listContracts } from "@/app/api/contracts/route";
import { GET as getContract, DELETE as deleteContract } from "@/app/api/contracts/[id]/route";
import { GET as getContractStatus } from "@/app/api/contracts/[id]/status/route";
import { ContractsService } from "@/modules/contracts/service";
import { AppError } from "@/lib/errors";

// Mock @/lib/auth/protect
vi.mock("@/lib/auth/protect", () => ({
  requireAuth: vi.fn(),
  requireContractOwnership: vi.fn(),
}));

// Mock @/modules/contracts/service
vi.mock("@/modules/contracts/service", () => ({
  ContractsService: {
    createPendingContract: vi.fn(),
    listContracts: vi.fn(),
    getContractById: vi.fn(),
    deleteContract: vi.fn(),
    getContractStatus: vi.fn(),
  },
}));

import { requireAuth } from "@/lib/auth/protect";

describe("Contracts API Endpoints Integration Tests", () => {
  const userId = "usr_00000000-0000-0000-0000-000000000001";
  const contractId = "123e4567-e89b-12d3-a456-426614174000";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({ userId, clerkId: "clerk_1" });
  });

  describe("POST /api/contracts", () => {
    it("creates pending contract when valid metadata is submitted", async () => {
      const mockCreated = {
        id: contractId,
        userId,
        originalFilename: "terms.pdf",
        fileType: "pdf",
        fileSizeBytes: 1024 * 50,
        status: "pending_upload",
      };

      vi.mocked(ContractsService.createPendingContract).mockResolvedValue(mockCreated as any);

      const req = new Request("http://localhost:3000/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "terms.pdf",
          fileSize: 1024 * 50,
          fileType: "pdf",
          contentType: "application/pdf",
        }),
      });

      const res = await createContract(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.contract.id).toBe(contractId);
    });

    it("returns 400 when filename has disallowed extension", async () => {
      const req = new Request("http://localhost:3000/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "malicious_script.sh",
          fileSize: 1024,
          fileType: "pdf",
          contentType: "application/pdf",
        }),
      });

      const res = await createContract(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Validation failed");
    });

    it("returns 400 when file size exceeds 20 MB", async () => {
      const req = new Request("http://localhost:3000/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "huge_agreement.pdf",
          fileSize: 25 * 1024 * 1024, // 25 MB
          fileType: "pdf",
          contentType: "application/pdf",
        }),
      });

      const res = await createContract(req);
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/contracts", () => {
    it("returns paginated list of user contracts", async () => {
      const mockResult = {
        data: [{ id: contractId, originalFilename: "agreement.pdf" }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      vi.mocked(ContractsService.listContracts).mockResolvedValue(mockResult as any);

      const req = new Request("http://localhost:3000/api/contracts?page=1&limit=20");
      const res = await listContracts(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(json.pagination.total).toBe(1);
    });
  });

  describe("GET /api/contracts/[id]", () => {
    it("returns contract detail when owned by user", async () => {
      const mockContract = { id: contractId, userId, originalFilename: "contract.pdf" };
      vi.mocked(ContractsService.getContractById).mockResolvedValue(mockContract as any);

      const res = await getContract(new Request("http://localhost/api/contracts/" + contractId), {
        params: Promise.resolve({ id: contractId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.contract.id).toBe(contractId);
    });

    it("returns 404 when requested by unauthorized tenant (anti-leak protection)", async () => {
      vi.mocked(ContractsService.getContractById).mockRejectedValue(AppError.notFound("Contract not found"));

      const res = await getContract(new Request("http://localhost/api/contracts/" + contractId), {
        params: Promise.resolve({ id: contractId }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.code).toBe("NOT_FOUND");
    });
  });

  describe("DELETE /api/contracts/[id]", () => {
    it("deletes contract successfully for owner", async () => {
      vi.mocked(ContractsService.deleteContract).mockResolvedValue({ success: true });

      const res = await deleteContract(new Request("http://localhost/api/contracts/" + contractId), {
        params: Promise.resolve({ id: contractId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it("returns 404 when attempting to delete another tenant's contract", async () => {
      vi.mocked(ContractsService.deleteContract).mockRejectedValue(AppError.notFound("Contract not found"));

      const res = await deleteContract(new Request("http://localhost/api/contracts/" + contractId), {
        params: Promise.resolve({ id: contractId }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/contracts/[id]/status", () => {
    it("returns status object with current processing stage", async () => {
      const mockStatus = {
        id: contractId,
        status: "uploaded",
        filename: "test.pdf",
        job: { status: "queued", currentStep: "awaiting_workflow" },
      };

      vi.mocked(ContractsService.getContractStatus).mockResolvedValue(mockStatus as any);

      const res = await getContractStatus(new Request("http://localhost/api/contracts/" + contractId + "/status"), {
        params: Promise.resolve({ id: contractId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("uploaded");
      expect(json.job.status).toBe("queued");
    });
  });
});
