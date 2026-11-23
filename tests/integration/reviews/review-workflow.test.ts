/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReviewEngine } from "@/modules/reviews/engine";
import {
  initReviewStep,
  evaluateCategoryStep,
  finalizeReviewStep,
  handleReviewErrorStep,
} from "@/modules/reviews/workflows/steps";
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

// Mock @/ai
const mockGenerateStructured = vi.fn();
vi.mock("@/ai", () => ({
  getAIProvider: vi.fn().mockReturnValue({
    generateStructured: (...args: any[]) => mockGenerateStructured(...args),
  }),
}));

import { db } from "@/lib/db";
import { requireContractOwnership } from "@/lib/auth/protect";

describe("Review Engine & Durable Workflow Integration Tests", () => {
  const userId = "usr_00000000-0000-0000-0000-000000000001";
  const contractId = "123e4567-e89b-12d3-a456-426614174000";
  const versionId = "123e4567-e89b-12d3-a456-426614174002";
  const reviewId = "123e4567-e89b-12d3-a456-426614174001";
  const fixturesDir = path.join(__dirname, "../../fixtures/contracts");

  const completeContractText = fs.readFileSync(
    path.join(fixturesDir, "review-complete-contract.txt"),
    "utf-8"
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ReviewEngine Unit & Gate Logic", () => {
    it("accepts verbatim quote and preserves exact offsets and found status", async () => {
      const verbatimQuote = "This Agreement shall automatically renew for successive one (1) year terms unless either party gives written notice of non-renewal at least thirty (30) days prior to the end of the then-current term.";

      mockGenerateStructured.mockResolvedValueOnce({
        status: "found",
        summary: "Contract automatically renews for successive 1-year terms with 30-day notice.",
        quote: verbatimQuote,
        reasoning: "Section 8 explicitly states automatic renewal terms.",
        confidence: "high",
        sectionReference: "8. AUTO-RENEWAL",
        pageNumber: 1,
      });

      const mockEvidence = {
        category: "auto_renewal" as const,
        chunks: [
          {
            id: "chk-auto",
            chunkIndex: 7,
            content: verbatimQuote,
            pageNumber: 1,
            sectionTitle: "8. AUTO-RENEWAL",
            startCharOffset: completeContractText.indexOf(verbatimQuote),
            endCharOffset: completeContractText.indexOf(verbatimQuote) + verbatimQuote.length,
          },
        ],
        examinedChunkCount: 1,
        totalChunkCount: 8,
        documentCoverageRatio: 1.0,
        hasSufficientCoverageForNotFound: true,
      };

      const result = await ReviewEngine.analyzeCategory({
        category: "auto_renewal",
        fullExtractedText: completeContractText,
        evidence: mockEvidence,
      });

      expect(result.status).toBe("found");
      expect(result.quoteVerified).toBe(true);
      expect(result.exactQuote).toBe(verbatimQuote);
      expect(result.verificationMethod).toBe("exact_match");
      expect(result.confidenceLabel).toBe("high");
      expect(result.startCharOffset).toBeGreaterThan(0);
    });

    it("falls back to unclear if LLM hallucinates or paraphrases quote", async () => {
      // Model says found, but gives a paraphrased quote not in the document!
      mockGenerateStructured.mockResolvedValueOnce({
        status: "found",
        summary: "Liability is capped to fees paid.",
        quote: "Neither party will have to pay more than what was paid in the last year.",
        reasoning: "Found liability limitation clause.",
        confidence: "high",
        sectionReference: "5. LIMITATION OF LIABILITY",
      });

      const mockEvidence = {
        category: "limitation_of_liability" as const,
        chunks: [
          {
            id: "chk-liab",
            chunkIndex: 4,
            content: "TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE TOTAL FEES PAID",
            pageNumber: 1,
            sectionTitle: "5. LIMITATION OF LIABILITY",
            startCharOffset: 100,
            endCharOffset: 200,
          },
        ],
        examinedChunkCount: 1,
        totalChunkCount: 8,
        documentCoverageRatio: 1.0,
        hasSufficientCoverageForNotFound: true,
      };

      const result = await ReviewEngine.analyzeCategory({
        category: "limitation_of_liability",
        fullExtractedText: completeContractText,
        evidence: mockEvidence,
      });

      // Must be forced to 'unclear' because quote verification failed!
      expect(result.status).toBe("unclear");
      expect(result.quoteVerified).toBe(false);
      expect(result.verificationMethod).toBe("verification_failed");
      expect(result.exactQuote).toBeNull();
      expect(result.reasoning).toContain("Quote verification failed");
    });

    it("falls back to unclear when not_found is claimed with insufficient coverage", async () => {
      mockGenerateStructured.mockResolvedValueOnce({
        status: "not_found",
        summary: "No governing law clause was observed in excerpts.",
        quote: null,
        reasoning: "None in provided text.",
        confidence: "medium",
      });

      const mockEvidence = {
        category: "governing_law" as const,
        chunks: [
          {
            id: "chk-1",
            chunkIndex: 1,
            content: "Some general contract terms.",
            pageNumber: 1,
            startCharOffset: 0,
            endCharOffset: 100,
          },
        ],
        examinedChunkCount: 2,
        totalChunkCount: 50,
        documentCoverageRatio: 0.04, // 4% coverage
        hasSufficientCoverageForNotFound: false, // Incomplete coverage!
      };

      const result = await ReviewEngine.analyzeCategory({
        category: "governing_law",
        fullExtractedText: completeContractText,
        evidence: mockEvidence,
      });

      // Must be forced to 'unclear' because absence cannot be proven with 4% coverage!
      expect(result.status).toBe("unclear");
      expect(result.reasoning).toContain("Conservative fallback to unclear");
    });
  });

  describe("Durable Workflow Steps", () => {
    it("pins contractVersionId and extracted content hash in initReviewStep", async () => {
      vi.mocked(requireContractOwnership).mockResolvedValueOnce({
        id: contractId,
        userId,
        status: "ready",
        extractedText: completeContractText,
        contentHash: "hash_abcdef123456",
      } as any);

      vi.mocked(db.select)
        // 1. version
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: versionId,
                  contractId,
                  versionNumber: 1,
                  extractedText: completeContractText,
                  contentHash: "hash_abcdef123456",
                },
              ]),
            }),
          }),
        } as any)
        // 2. existing active review (none)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        } as any)
        // 3. chunk count
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "chk_001" }]),
            }),
          }),
        } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: reviewId }]),
        }),
      } as any);

      const initOutput = await initReviewStep({
        contractId,
        userId,
        contractVersionId: versionId,
      });

      expect(initOutput.reviewId).toBe(reviewId);
      expect(initOutput.contractVersionId).toBe(versionId);
      expect(initOutput.contentHash).toBe("hash_abcdef123456");
      expect(initOutput.fullExtractedText).toBe(completeContractText);
    });

    it("cleans existing category finding before re-inserting to guarantee idempotency in evaluateCategoryStep", async () => {
      const deleteWhere = vi.fn().mockResolvedValue({});
      vi.mocked(db.delete).mockReturnValue({ where: deleteWhere } as any);

      const insertValues = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "find_001" }]),
      });
      vi.mocked(db.insert).mockReturnValue({ values: insertValues } as any);

      // Mock EvidenceRetriever DB call inside step
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await evaluateCategoryStep({
        reviewId,
        contractId,
        userId,
        contractVersionId: versionId,
        fullExtractedText: completeContractText,
        category: "parties",
      });

      expect(deleteWhere).toHaveBeenCalled();
      expect(result.category).toBe("parties");
      expect(result.findingId).toBe("find_001");
    });

    it("finalizes review with complete overallStatus when all categories are recorded", async () => {
      const updateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) });
      vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);

      // Return 8 findings
      const mockFindings = Array.from({ length: 8 }, (_, i) => ({
        id: `f_${i}`,
        status: "found",
      }));

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockFindings),
        }),
      } as any);

      const result = await finalizeReviewStep({
        reviewId,
        contractId,
        userId,
        durationMs: 1500,
      });

      expect(result.success).toBe(true);
      expect(result.overallStatus).toBe("complete");
      expect(updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ overallStatus: "complete", durationMs: 1500 })
      );
    });

    it("records overallStatus = 'failed' on handleReviewErrorStep", async () => {
      const updateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) });
      vi.mocked(db.update).mockReturnValue({ set: updateSet } as any);

      const result = await handleReviewErrorStep({
        reviewId,
        error: "OpenRouter rate limit 429",
      });

      expect(result.recorded).toBe(true);
      expect(updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ overallStatus: "failed" })
      );
    });
  });
});
