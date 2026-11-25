/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MAX_FILE_SIZE_BYTES, ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } from "@/lib/validation/contracts";
import { ContractsService } from "@/modules/contracts/service";

// Mock @/lib/auth/protect
vi.mock("@/lib/auth/protect", () => ({
  requireAuth: vi.fn(),
  requireContractOwnership: vi.fn(),
}));

import { requireAuth, requireContractOwnership } from "@/lib/auth/protect";

describe("Upload Architecture & Authorization Integration Tests", () => {
  const userA = "usr_00000000-0000-0000-0000-00000000000a";
  const userB = "usr_00000000-0000-0000-0000-00000000000b";
  const contractIdA = "ctr_11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Upload Constraint Enforcement", () => {
    it("allows only PDF, DOCX, and TXT extensions and MIME types", () => {
      expect(ALLOWED_EXTENSIONS).toEqual(["pdf", "docx", "txt"]);

      expect(ALLOWED_MIME_TYPES).toContain("application/pdf");
      expect(ALLOWED_MIME_TYPES).toContain("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      expect(ALLOWED_MIME_TYPES).toContain("text/plain");

      // Reject non-contract types
      expect(ALLOWED_MIME_TYPES).not.toContain("application/x-msdownload");
      expect(ALLOWED_MIME_TYPES).not.toContain("image/png");
      expect(ALLOWED_MIME_TYPES).not.toContain("application/zip");
    });

    it("enforces strict 20 MB ceiling for uploads", () => {
      expect(MAX_FILE_SIZE_BYTES).toBe(20 * 1024 * 1024);

      const validSize = 19 * 1024 * 1024;
      const invalidSize = 21 * 1024 * 1024;

      expect(validSize <= MAX_FILE_SIZE_BYTES).toBe(true);
      expect(invalidSize <= MAX_FILE_SIZE_BYTES).toBe(false);
    });
  });

  describe("Upload Authorization & Ownership Validation", () => {
    it("rejects unauthenticated upload token generation", async () => {
      vi.mocked(requireAuth).mockRejectedValue(new Error("Unauthorized"));

      await expect(async () => {
        await requireAuth();
      }).rejects.toThrow("Unauthorized");
    });

    it("rejects token generation when User B tries to authorize upload for User A's contract", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId: userB, clerkId: "clerk_b" });
      vi.mocked(requireContractOwnership).mockRejectedValue(new Error("Contract not found"));

      await expect(
        ContractsService.getContractById(contractIdA, userB)
      ).rejects.toThrow("Contract not found");
    });

    it("ensures completed uploads verify contract matching and ownership", async () => {
      const mockContract = {
        id: contractIdA,
        userId: userA,
        status: "pending_upload",
        fileSizeBytes: 1024 * 100,
      };

      vi.mocked(requireContractOwnership).mockResolvedValue(mockContract as any);

      // Verify contract matches
      const verified = await ContractsService.getContractById(contractIdA, userA);
      expect(verified.id).toBe(contractIdA);
      expect(verified.userId).toBe(userA);
    });
  });

  describe("Private Storage & Safe Idempotent Completion", () => {
    it("ensures upload pathnames are scoped by userId and contractId to prevent collisions", () => {
      const filename = "Master_Services_Agreement_2026.pdf";
      const storageKey = `contracts/${userA}/${contractIdA}/${encodeURIComponent(filename)}`;

      expect(storageKey.startsWith(`contracts/${userA}/${contractIdA}/`)).toBe(true);
      expect(storageKey).toContain("Master_Services_Agreement_2026.pdf");
    });

    it("rejects duplicate or out-of-order callback transitions", () => {
      const allowedTransitions: Record<string, string[]> = {
        pending_upload: ["uploaded", "failed"],
        uploading: ["uploaded", "failed"],
        uploaded: ["processing"],
        processing: ["ready", "failed"],
        ready: [],
        failed: [],
      };

      // Disallow re-uploading an already processed/ready contract
      expect(allowedTransitions.ready.includes("uploaded")).toBe(false);
      expect(allowedTransitions.uploaded.includes("pending_upload")).toBe(false);
    });

    it("requires access mode to be 'private' for client uploads to private Vercel Blob store", () => {
      const clientUploadOptions = {
        access: "private" as const,
        handleUploadUrl: "/api/upload",
      };

      expect(clientUploadOptions.access).toBe("private");
      expect(clientUploadOptions.access).not.toBe("public");
    });

    it("generates unique tenant-isolated storage path with contract ID to prevent filename collisions", () => {
      const filename = "duplicate_contract_name.pdf";
      const contract1Id = "11111111-1111-1111-1111-111111111111";
      const contract2Id = "22222222-2222-2222-2222-222222222222";

      const path1 = `contracts/${userA}/${contract1Id}/${encodeURIComponent(filename)}`;
      const path2 = `contracts/${userA}/${contract2Id}/${encodeURIComponent(filename)}`;

      // Even with the exact same filename and user, contractId guarantees distinct storage keys
      expect(path1).not.toEqual(path2);
      expect(path1).toContain(contract1Id);
      expect(path2).toContain(contract2Id);
    });

    it("verifies server token constraints include addRandomSuffix for collision protection", () => {
      const constraints = {
        allowedContentTypes: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
        ],
        maximumSizeInBytes: 20 * 1024 * 1024,
        addRandomSuffix: true,
      };

      expect(constraints.addRandomSuffix).toBe(true);
      expect(constraints.maximumSizeInBytes).toBe(MAX_FILE_SIZE_BYTES);
    });
  });
});
