/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EvidenceRetriever } from "@/modules/reviews/evidence-retriever";

// Mock @/lib/db
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

// Mock @/modules/retrieval
vi.mock("@/modules/retrieval", () => ({
  RetrievalService: {
    searchSimilarChunks: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from "@/lib/db";
import { RetrievalService } from "@/modules/retrieval";

describe("EvidenceRetriever Unit Tests", () => {
  const contractId = "123e4567-e89b-12d3-a456-426614174000";
  const userId = "usr_00000000-0000-0000-0000-000000000001";
  const contractVersionId = "ver_12345678-1234-1234-1234-123456789000";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(RetrievalService.searchSimilarChunks).mockResolvedValue([]);
  });

  it("retrieves evidence by keyword synonyms and expands neighboring chunks", async () => {
    const mockChunks = [
      {
        id: "chunk-0",
        chunkIndex: 0,
        content: "Introductory remarks regarding the relationship.",
        pageNumber: 1,
        sectionTitle: "Introduction",
        startCharOffset: 0,
        endCharOffset: 50,
      },
      {
        id: "chunk-1",
        chunkIndex: 1,
        content: "Governing Law: This agreement is governed by the laws of California.",
        pageNumber: 1,
        sectionTitle: "Governing Law",
        startCharOffset: 50,
        endCharOffset: 120,
      },
      {
        id: "chunk-2",
        chunkIndex: 2,
        content: "Dispute resolution: All disputes will be heard in San Francisco courts.",
        pageNumber: 2,
        sectionTitle: "Disputes",
        startCharOffset: 120,
        endCharOffset: 195,
      },
      {
        id: "chunk-3",
        chunkIndex: 3,
        content: "General miscellaneous boilerplate provisions.",
        pageNumber: 2,
        sectionTitle: "General",
        startCharOffset: 195,
        endCharOffset: 250,
      },
    ];

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockChunks),
        }),
      }),
    } as any);

    const result = await EvidenceRetriever.retrieveEvidenceForCategory({
      contractId,
      userId,
      contractVersionId,
      category: "governing_law",
    });

    expect(result.category).toBe("governing_law");
    expect(result.totalChunkCount).toBe(4);
    // Because totalChunkCount <= 15, all chunks are examined for 100% coverage
    expect(result.hasSufficientCoverageForNotFound).toBe(true);
    expect(result.documentCoverageRatio).toBe(1.0);

    const chunkIds = result.chunks.map((c) => c.id);
    expect(chunkIds).toContain("chunk-1");
  });

  it("correctly flags insufficient coverage for large documents when candidate chunks exceed maxChunks budget", async () => {
    // Generate 30 mock chunks where 6 chunks have candidate keywords but maxChunks is 4
    const candidateIndices = [5, 10, 15, 20, 25, 28];
    const largeMockChunks = Array.from({ length: 30 }, (_, idx) => ({
      id: `chunk-${idx}`,
      chunkIndex: idx,
      content: candidateIndices.includes(idx)
        ? `Termination and cancellation terms in section ${idx}.`
        : `Standard operational paragraph ${idx}.`,
      pageNumber: Math.floor(idx / 3) + 1,
      sectionTitle: candidateIndices.includes(idx) ? `Termination Part ${idx}` : `Section ${idx}`,
      startCharOffset: idx * 100,
      endCharOffset: (idx + 1) * 100,
    }));

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(largeMockChunks),
        }),
      }),
    } as any);

    const result = await EvidenceRetriever.retrieveEvidenceForCategory({
      contractId,
      userId,
      contractVersionId,
      category: "termination",
      maxChunks: 4,
    });

    expect(result.totalChunkCount).toBe(30);
    expect(result.examinedChunkCount).toBe(4);
    // Because candidate chunks 20, 25, 28 were left unexamined due to maxChunks budget,
    // absence cannot be asserted with confidence
    expect(result.hasSufficientCoverageForNotFound).toBe(false);
  });

  describe("Long Document Spatial Dispersion Tests (Beginning, Middle, End, Absent)", () => {
    // 30 chunks representing a long 15-page agreement
    const create30Chunks = (overrides: Record<number, { content: string; sectionTitle: string }>) =>
      Array.from({ length: 30 }, (_, idx) => ({
        id: `chk-${idx}`,
        chunkIndex: idx,
        content: overrides[idx]?.content ?? `Standard boilerplate text in section ${idx}.`,
        pageNumber: Math.floor(idx / 2) + 1,
        sectionTitle: overrides[idx]?.sectionTitle ?? `Section ${idx}`,
        startCharOffset: idx * 200,
        endCharOffset: (idx + 1) * 200,
      }));

    it("retrieves clause located near the beginning (chunk 1) of a long document", async () => {
      const chunks = create30Chunks({
        1: {
          content: "Parties: This Master Agreement is entered into by and between Enterprise Corp and Tech LLC.",
          sectionTitle: "1. PARTIES",
        },
      });

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(chunks),
          }),
        }),
      } as any);

      const result = await EvidenceRetriever.retrieveEvidenceForCategory({
        contractId,
        userId,
        contractVersionId,
        category: "parties",
      });

      const chunkIndices = result.chunks.map((c) => c.chunkIndex);
      expect(chunkIndices).toContain(1);
    });

    it("retrieves clause located in the middle (chunk 15) of a long document", async () => {
      const chunks = create30Chunks({
        15: {
          content: "Confidentiality: Recipient shall hold all proprietary information in strict confidence.",
          sectionTitle: "15. CONFIDENTIALITY",
        },
      });

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(chunks),
          }),
        }),
      } as any);

      const result = await EvidenceRetriever.retrieveEvidenceForCategory({
        contractId,
        userId,
        contractVersionId,
        category: "confidentiality",
      });

      const chunkIndices = result.chunks.map((c) => c.chunkIndex);
      expect(chunkIndices).toContain(15);
    });

    it("retrieves clause located near the end (chunk 28) of a long document", async () => {
      const chunks = create30Chunks({
        28: {
          content: "Governing Law: This Agreement shall be governed by the laws of the State of Delaware.",
          sectionTitle: "28. GOVERNING LAW",
        },
      });

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(chunks),
          }),
        }),
      } as any);

      const result = await EvidenceRetriever.retrieveEvidenceForCategory({
        contractId,
        userId,
        contractVersionId,
        category: "governing_law",
      });

      const chunkIndices = result.chunks.map((c) => c.chunkIndex);
      expect(chunkIndices).toContain(28);
    });

    it("establishes sufficient coverage for absence when zero keywords appear across all 30 chunks", async () => {
      // Completely generic text with NO auto-renewal keywords anywhere
      const chunks = create30Chunks({});

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(chunks),
          }),
        }),
      } as any);

      const result = await EvidenceRetriever.retrieveEvidenceForCategory({
        contractId,
        userId,
        contractVersionId,
        category: "auto_renewal",
      });

      // Because 100% of chunks were scanned and 0 candidate mentions exist, absence is defensible
      expect(result.hasSufficientCoverageForNotFound).toBe(true);
      expect(result.chunks).toHaveLength(0);
    });
  });
});
