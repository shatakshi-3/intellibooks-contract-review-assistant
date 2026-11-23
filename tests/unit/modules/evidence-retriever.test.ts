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

  it("correctly flags insufficient coverage for large documents where only few chunks match", async () => {
    // Generate 30 mock chunks
    const largeMockChunks = Array.from({ length: 30 }, (_, idx) => ({
      id: `chunk-${idx}`,
      chunkIndex: idx,
      content: idx === 12 ? "Termination for cause upon breach." : `Standard paragraph ${idx}.`,
      pageNumber: Math.floor(idx / 3) + 1,
      sectionTitle: idx === 12 ? "Termination" : `Section ${idx}`,
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

    vi.mocked(RetrievalService.searchSimilarChunks).mockResolvedValue([
      { chunkIndex: 12 } as any,
    ]);

    const result = await EvidenceRetriever.retrieveEvidenceForCategory({
      contractId,
      userId,
      contractVersionId,
      category: "termination",
      maxChunks: 4,
    });

    expect(result.totalChunkCount).toBe(30);
    expect(result.examinedChunkCount).toBeLessThan(10);
    // With 4 examined chunks out of 30, coverage is ~13%, well below the 65% threshold
    expect(result.hasSufficientCoverageForNotFound).toBe(false);
  });
});
