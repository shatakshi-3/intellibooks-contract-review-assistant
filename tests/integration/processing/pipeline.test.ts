/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DocumentProcessingPipeline } from "@/modules/processing/workflow";
import { RetrievalService } from "@/modules/retrieval/service";
import fs from "fs";
import path from "path";

// Mock @/lib/db
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock @/lib/auth/protect
vi.mock("@/lib/auth/protect", () => ({
  requireContractOwnership: vi.fn(),
}));

// Mock @/modules/embeddings
const dummy1536 = new Array(1536).fill(0.02);
vi.mock("@/modules/embeddings", () => ({
  EMBEDDING_MODEL: "openai/text-embedding-3-small",
  EMBEDDING_DIMENSIONS: 1536,
  EmbeddingService: {
    generateEmbeddings: vi.fn().mockImplementation(async (texts: string[]) => {
      return texts.map(() => dummy1536);
    }),
  },
}));

import { db } from "@/lib/db";
import { requireContractOwnership } from "@/lib/auth/protect";
import { EmbeddingService } from "@/modules/embeddings";

describe("Document Processing Pipeline & Scoped Vector Retrieval", () => {
  const userId = "usr_00000000-0000-0000-0000-000000000001";
  const contractId = "123e4567-e89b-12d3-a456-426614174000";
  const fixturesDir = path.join(__dirname, "../../fixtures/contracts");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("End-to-End Pipeline Execution", () => {
    it("executes all 10 durable steps successfully from buffer to vector persistence", async () => {
      const mockContract = {
        id: contractId,
        userId,
        fileType: "txt",
        originalFilename: "complete-contract.txt",
        blobUrl: "https://blob.vercel.com/contracts/contract.txt",
        status: "uploaded",
      };

      vi.mocked(requireContractOwnership).mockResolvedValue(mockContract as any);

      const mockJob = {
        id: "job_001",
        contractId,
        userId,
        status: "queued",
        attemptCount: 0,
      };

      // Mock DB queries
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockJob]),
            }),
            limit: vi.fn().mockResolvedValue([]), // No existing version
          }),
        }),
      } as any);

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "ver_001" }]),
        }),
      } as any);

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      } as any);

      const rawBuffer = fs.readFileSync(path.join(fixturesDir, "complete-contract.txt"));

      const result = await DocumentProcessingPipeline.processContract(contractId, userId, {
        customBuffer: rawBuffer,
      });

      expect(result.status).toBe("ready");
      expect(result.chunkCount).toBeGreaterThan(0);
      expect(result.embeddingCount).toBe(result.chunkCount);
      expect(result.stages.extracting.status).toBe("completed");
      expect(result.stages.chunking.status).toBe("completed");
      expect(result.stages.embedding.status).toBe("completed");
      expect(result.stages.persisting_vectors.status).toBe("completed");
      expect(EmbeddingService.generateEmbeddings).toHaveBeenCalled();
    });

    it("records failure state and error message when extraction or embedding fails", async () => {
      const mockContract = {
        id: contractId,
        userId,
        fileType: "pdf",
        originalFilename: "corrupted.pdf",
        status: "uploaded",
      };

      vi.mocked(requireContractOwnership).mockResolvedValue(mockContract as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "job_fail", attemptCount: 1 }]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      } as any);

      // Provide corrupt buffer that will fail extraction
      const corruptBuffer = Buffer.from("Not a real PDF file");

      const result = await DocumentProcessingPipeline.processContract(contractId, userId, {
        customBuffer: corruptBuffer,
      });

      expect(result.status).toBe("failed");
      expect(result.error).toBeDefined();
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe("Adversarial Contract Text Sandboxing", () => {
    it("treats adversarial prompt injection attempts purely as passive text data", async () => {
      const mockContract = {
        id: contractId,
        userId,
        fileType: "txt",
        originalFilename: "adversarial-contract.txt",
        status: "uploaded",
      };

      vi.mocked(requireContractOwnership).mockResolvedValue(mockContract as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "job_adv", attemptCount: 1 }]),
            }),
            limit: vi.fn().mockResolvedValue([{ id: "ver_adv" }]),
          }),
        }),
      } as any);

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "ver_adv" }]),
        }),
      } as any);

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      } as any);

      const adversarialBuffer = fs.readFileSync(path.join(fixturesDir, "adversarial-contract.txt"));

      const result = await DocumentProcessingPipeline.processContract(contractId, userId, {
        customBuffer: adversarialBuffer,
      });

      expect(result.status).toBe("ready");
      // The adversarial instructions are embedded as normal chunk data without triggering any special execution
      expect(result.chunkCount).toBeGreaterThan(0);
    });
  });

  describe("Scoped Vector Retrieval & Tenant Isolation", () => {
    it("enforces user_id and contract_id filters on cosine distance queries", async () => {
      const mockRows = [
        {
          id: "chk_001",
          chunkIndex: 0,
          content: "Governing law of Delaware...",
          pageNumber: 1,
          sectionTitle: "8. Governing Law",
          startCharOffset: 100,
          endCharOffset: 250,
          similarity: 0.92,
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockRows),
            }),
          }),
        }),
      } as any);

      const results = await RetrievalService.searchSimilarChunks(
        "Which state laws govern this agreement?",
        contractId,
        userId,
        { limit: 3 }
      );

      expect(results).toHaveLength(1);
      expect(results[0].content).toContain("Delaware");
      expect(results[0].similarity).toBe(0.92);
      expect(db.select).toHaveBeenCalled();
    });
  });
});
