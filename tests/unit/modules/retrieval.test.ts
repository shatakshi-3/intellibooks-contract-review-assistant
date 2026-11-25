/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RetrievalService,
  IncompatibleEmbeddingModelError,
} from "@/modules/retrieval/service";
import { db } from "@/lib/db";
import { EmbeddingService, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "@/modules/embeddings";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    selectDistinct: vi.fn(),
  },
}));

vi.mock("@/modules/embeddings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/embeddings")>();
  return {
    ...actual,
    EmbeddingService: {
      generateEmbeddings: vi.fn(),
    },
  };
});

describe("RetrievalService Embedding Model Consistency & Asymmetric Retrieval", () => {
  const contractId = "contract-123";
  const userId = "user-456";
  const dummyVector = new Array(EMBEDDING_DIMENSIONS).fill(0.02);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects retrieval when stored chunks use a different embedding model", async () => {
    // Contract chunks were indexed with a different model than currently configured
    const storedModel = "legacy-model/text-embedding-old";

    vi.mocked(db.selectDistinct).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { embeddingModel: storedModel },
        ]),
      }),
    } as any);

    await expect(
      RetrievalService.searchSimilarChunks("What is the payment schedule?", contractId, userId)
    ).rejects.toThrow(IncompatibleEmbeddingModelError);

    // Ensure query embedding generation was NOT called
    expect(EmbeddingService.generateEmbeddings).not.toHaveBeenCalled();
  });

  it("provides detailed error message indicating stored vs configured model", async () => {
    const storedModel = "openai/text-embedding-ada-002";

    vi.mocked(db.selectDistinct).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ embeddingModel: storedModel }]),
      }),
    } as any);

    try {
      await RetrievalService.searchSimilarChunks("termination clause", contractId, userId);
      expect.fail("Should have thrown IncompatibleEmbeddingModelError");
    } catch (err) {
      expect(err).toBeInstanceOf(IncompatibleEmbeddingModelError);
      const modelErr = err as IncompatibleEmbeddingModelError;
      expect(modelErr.storedModel).toBe(storedModel);
      expect(modelErr.configuredModel).toBe(EMBEDDING_MODEL);
      expect(modelErr.message).toContain("Incompatible embedding model");
      expect(modelErr.message).toContain(storedModel);
      expect(modelErr.message).toContain(EMBEDDING_MODEL);
      expect(modelErr.message).toContain("Chunks must be re-embedded before retrieval can proceed");
    }
  });

  it("rejects retrieval when contract has mixed inconsistent embedding models across chunks", async () => {
    // Chunks contain a mix of models
    vi.mocked(db.selectDistinct).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { embeddingModel: "model-a" },
          { embeddingModel: "model-b" },
        ]),
      }),
    } as any);

    await expect(
      RetrievalService.searchSimilarChunks("governing law", contractId, userId)
    ).rejects.toThrow(/Inconsistent embedding models detected across chunks/i);
  });

  it("checks all distinct embedding models across an entire contract without chunk limit (e.g. > 100 chunks)", async () => {
    // Contract has > 100 chunks. selectDistinct scans all chunks without any row limit.
    vi.mocked(db.selectDistinct).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { embeddingModel: EMBEDDING_MODEL },
          { embeddingModel: "mismatched-model-at-chunk-150" },
        ]),
      }),
    } as any);

    await expect(
      RetrievalService.searchSimilarChunks("termination clause", contractId, userId)
    ).rejects.toThrow(/Inconsistent embedding models detected across chunks/i);
  });

  it("returns empty array without throwing when contract has 0 chunks", async () => {
    vi.mocked(db.selectDistinct).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as any);

    const results = await RetrievalService.searchSimilarChunks("any query", contractId, userId);
    expect(results).toEqual([]);
    expect(EmbeddingService.generateEmbeddings).not.toHaveBeenCalled();
  });

  it("generates query vector using inputType: 'query' when models match", async () => {
    const mockRows = [
      {
        id: "chk-1",
        chunkIndex: 0,
        content: "Payment is net 30 days.",
        pageNumber: 2,
        sectionTitle: "3. Payment",
        startCharOffset: 50,
        endCharOffset: 120,
        similarity: 0.88,
        embeddingModel: EMBEDDING_MODEL,
      },
    ];

    vi.mocked(db.selectDistinct).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ embeddingModel: EMBEDDING_MODEL }]),
      }),
    } as any);

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockRows),
          }),
        }),
      }),
    } as any);

    vi.mocked(EmbeddingService.generateEmbeddings).mockResolvedValue([dummyVector]);

    const results = await RetrievalService.searchSimilarChunks(
      "When is payment due?",
      contractId,
      userId,
      { limit: 3, minSimilarity: 0.5 }
    );

    expect(results).toHaveLength(1);
    expect(results[0].content).toContain("Payment is net 30 days");
    expect(results[0].similarity).toBe(0.88);

    // Verify asymmetric "query" mode was passed
    expect(EmbeddingService.generateEmbeddings).toHaveBeenCalledWith(
      ["When is payment due?"],
      {
        model: EMBEDDING_MODEL,
        expectedDimensions: EMBEDDING_DIMENSIONS,
        inputType: "query",
      }
    );
  });
});
