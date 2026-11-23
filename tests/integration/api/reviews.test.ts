/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, GET as listReviewsGET } from "@/app/api/contracts/[id]/reviews/route";
import { GET as singleReviewGET } from "@/app/api/contracts/[id]/reviews/[reviewId]/route";
import { GET as findingsGET } from "@/app/api/contracts/[id]/reviews/[reviewId]/findings/route";
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

import { requireAuth, requireContractOwnership } from "@/lib/auth/protect";
import { start } from "workflow/api";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

describe("Review API Route Handlers Integration Tests", () => {
  const userId = "usr_00000000-0000-0000-0000-000000000001";
  const contractId = "123e4567-e89b-12d3-a456-426614174000";
  const reviewId = "123e4567-e89b-12d3-a456-426614174001";
  const versionId = "123e4567-e89b-12d3-a456-426614174002";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/contracts/[id]/reviews", () => {
    it("dispatches review workflow and returns 202 Accepted", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireContractOwnership).mockResolvedValue({
        id: contractId,
        userId,
        status: "ready",
      } as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: versionId }]),
            }),
          }),
        }),
      } as any);

      vi.mocked(start).mockResolvedValue({
        runId: "run_review_12345",
      } as any);

      const req = new Request(`http://localhost:3000/api/contracts/${contractId}/reviews`, {
        method: "POST",
      });

      const res = await POST(req, { params: Promise.resolve({ id: contractId }) });
      expect(res.status).toBe(202);

      const json = await res.json();
      expect(json.started).toBe(true);
      expect(json.runId).toBe("run_review_12345");
      expect(json.contractId).toBe(contractId);
      expect(json.versionId).toBe(versionId);

      // Verify hook token used for run deduplication
      expect(start).toHaveBeenCalledWith(
        expect.any(Function),
        [{ contractId, userId, contractVersionId: versionId }],
        { experimental_hook: { token: `contract-review:${contractId}:${versionId}` } }
      );
    });

    it("rejects review initiation if contract status is not 'ready'", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireContractOwnership).mockResolvedValue({
        id: contractId,
        userId,
        status: "processing", // Not ready yet!
      } as any);

      const req = new Request(`http://localhost:3000/api/contracts/${contractId}/reviews`, {
        method: "POST",
      });

      const res = await POST(req, { params: Promise.resolve({ id: contractId }) });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.code).toBe("CONTRACT_NOT_READY");
      expect(start).not.toHaveBeenCalled();
    });

    it("handles duplicate active review with 409 Conflict using HookConflictError", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireContractOwnership).mockResolvedValue({
        id: contractId,
        userId,
        status: "ready",
      } as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: versionId }]),
            }),
          }),
        }),
      } as any);

      const conflictError = new HookConflictError(
        `contract-review:${contractId}:${versionId}`,
        "run_conflict_888"
      );
      vi.mocked(start).mockRejectedValue(conflictError);

      const req = new Request(`http://localhost:3000/api/contracts/${contractId}/reviews`, {
        method: "POST",
      });

      const res = await POST(req, { params: Promise.resolve({ id: contractId }) });
      expect(res.status).toBe(409);

      const json = await res.json();
      expect(json.started).toBe(false);
      expect(json.runId).toBe("run_conflict_888");
      expect(json.status).toBe("already_running");
    });

    it("rejects cross-tenant review initiation with 404 Not Found when user does not own contract", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId: "usr_attacker_9999" } as any);
      vi.mocked(requireContractOwnership).mockRejectedValue(
        AppError.notFound("Contract not found")
      );

      const req = new Request(`http://localhost:3000/api/contracts/${contractId}/reviews`, {
        method: "POST",
      });

      const res = await POST(req, { params: Promise.resolve({ id: contractId }) });
      expect(res.status).toBe(404);
      expect(start).not.toHaveBeenCalled();
    });

    it("rejects unauthenticated review initiation with 401 Unauthorized", async () => {
      vi.mocked(requireAuth).mockRejectedValue(AppError.unauthorized());

      const req = new Request(`http://localhost:3000/api/contracts/${contractId}/reviews`, {
        method: "POST",
      });

      const res = await POST(req, { params: Promise.resolve({ id: contractId }) });
      expect(res.status).toBe(401);
      expect(start).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/contracts/[id]/reviews", () => {
    it("returns review history list for authenticated contract owner", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireContractOwnership).mockResolvedValue({
        id: contractId,
        userId,
      } as any);

      const mockList = [
        { id: reviewId, contractId, overallStatus: "complete", createdAt: new Date() },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockList),
          }),
        }),
      } as any);

      const req = new Request(`http://localhost:3000/api/contracts/${contractId}/reviews`);
      const res = await listReviewsGET(req, { params: Promise.resolve({ id: contractId }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.reviews).toHaveLength(1);
      expect(json.reviews[0].id).toBe(reviewId);
    });

    it("returns single review details via singleReviewGET", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireContractOwnership).mockResolvedValue({
        id: contractId,
        userId,
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: reviewId, contractId, overallStatus: "complete" },
            ]),
          }),
        }),
      } as any);

      const req = new Request(`http://localhost:3000/api/contracts/${contractId}/reviews/${reviewId}`);
      const res = await singleReviewGET(req, {
        params: Promise.resolve({ id: contractId, reviewId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.review.id).toBe(reviewId);
    });

    it("rejects cross-tenant access with 404 Not Found when contract is not owned by user", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireContractOwnership).mockRejectedValue(
        AppError.notFound("Contract not found")
      );

      const req = new Request(`http://localhost:3000/api/contracts/${contractId}/reviews`);
      const res = await listReviewsGET(req, { params: Promise.resolve({ id: contractId }) });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.code).toBe("NOT_FOUND");
    });
  });

  describe("GET /api/contracts/[id]/reviews/[reviewId]/findings", () => {
    it("returns all checklist findings for verified review", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireContractOwnership).mockResolvedValue({
        id: contractId,
        userId,
      } as any);

      // Mock verify review exists on this contract
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: reviewId }]),
          }),
        }),
      } as any);

      // Mock findings
      const mockFindings = [
        { id: "find-1", checklistItem: "parties", status: "found", exactQuote: "Party A & Party B" },
      ];
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockFindings),
        }),
      } as any);

      const req = new Request(`http://localhost:3000/api/contracts/${contractId}/reviews/${reviewId}/findings`);
      const res = await findingsGET(req, {
        params: Promise.resolve({ id: contractId, reviewId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.findings).toHaveLength(1);
      expect(json.findings[0].checklistItem).toBe("parties");
    });

    it("rejects cross-tenant access to findings with 404 Not Found", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId: "usr_attacker" } as any);
      vi.mocked(requireContractOwnership).mockRejectedValue(
        AppError.notFound("Contract not found")
      );

      const req = new Request(`http://localhost:3000/api/contracts/${contractId}/reviews/${reviewId}/findings`);
      const res = await findingsGET(req, {
        params: Promise.resolve({ id: contractId, reviewId }),
      });

      expect(res.status).toBe(404);
    });
  });
});
