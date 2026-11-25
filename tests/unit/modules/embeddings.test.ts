import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmbeddingService, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "@/modules/embeddings/service";
import type { AIProvider } from "@/ai";

describe("EmbeddingService Unit Tests", () => {
  const dummy1536 = new Array(1536).fill(0.05);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates 1536-dimensional embeddings passing model and dimensions", async () => {
    const mockProvider: AIProvider = {
      generateText: vi.fn(),
      generateStructured: vi.fn(),
      streamText: vi.fn(),
      generateEmbeddings: vi.fn().mockResolvedValue([dummy1536, dummy1536]),
    };

    const inputs = ["Clause 1: Confidentiality", "Clause 2: Indemnification"];
    const results = await EmbeddingService.generateEmbeddings(inputs, {
      provider: mockProvider,
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(mockProvider.generateEmbeddings).toHaveBeenCalledWith({
      model: EMBEDDING_MODEL,
      inputs,
      dimensions: EMBEDDING_DIMENSIONS,
      inputType: undefined,
    });
  });

  it("passes asymmetric inputType 'passage' for indexing and 'query' for search", async () => {
    const mockProvider: AIProvider = {
      generateText: vi.fn(),
      generateStructured: vi.fn(),
      streamText: vi.fn(),
      generateEmbeddings: vi.fn().mockResolvedValue([dummy1536]),
    };

    // Test passage mode
    await EmbeddingService.generateEmbeddings(["Document paragraph content"], {
      provider: mockProvider,
      inputType: "passage",
    });

    expect(mockProvider.generateEmbeddings).toHaveBeenLastCalledWith({
      model: EMBEDDING_MODEL,
      inputs: ["Document paragraph content"],
      dimensions: EMBEDDING_DIMENSIONS,
      inputType: "passage",
    });

    // Test query mode
    await EmbeddingService.generateEmbeddings(["Search query clause"], {
      provider: mockProvider,
      inputType: "query",
    });

    expect(mockProvider.generateEmbeddings).toHaveBeenLastCalledWith({
      model: EMBEDDING_MODEL,
      inputs: ["Search query clause"],
      dimensions: EMBEDDING_DIMENSIONS,
      inputType: "query",
    });
  });

  it("supports configurable model and expected dimensions option", async () => {
    const customDim = 1024;
    const dummy1024 = new Array(customDim).fill(0.01);
    const mockProvider: AIProvider = {
      generateText: vi.fn(),
      generateStructured: vi.fn(),
      streamText: vi.fn(),
      generateEmbeddings: vi.fn().mockResolvedValue([dummy1024]),
    };

    const results = await EmbeddingService.generateEmbeddings(["Custom test"], {
      provider: mockProvider,
      model: "nvidia/nemotron-3.5-embed-1b:free",
      expectedDimensions: customDim,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toHaveLength(customDim);
    expect(mockProvider.generateEmbeddings).toHaveBeenCalledWith({
      model: "nvidia/nemotron-3.5-embed-1b:free",
      inputs: ["Custom test"],
      dimensions: customDim,
    });
  });

  it("splits large batches into controlled batch sizes (default 20)", async () => {
    const mockProvider: AIProvider = {
      generateText: vi.fn(),
      generateStructured: vi.fn(),
      streamText: vi.fn(),
      generateEmbeddings: vi.fn().mockImplementation(async ({ inputs }) => {
        return inputs.map(() => dummy1536);
      }),
    };

    // 45 items with batchSize = 20 -> 3 API calls (20, 20, 5)
    const inputs = Array.from({ length: 45 }, (_, i) => `Paragraph ${i + 1}`);
    const results = await EmbeddingService.generateEmbeddings(inputs, {
      provider: mockProvider,
      batchSize: 20,
    });

    expect(results).toHaveLength(45);
    expect(mockProvider.generateEmbeddings).toHaveBeenCalledTimes(3);
  });

  it("retries transient failures with exponential backoff before succeeding", async () => {
    let callCount = 0;
    const mockProvider: AIProvider = {
      generateText: vi.fn(),
      generateStructured: vi.fn(),
      streamText: vi.fn(),
      generateEmbeddings: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("429 Too Many Requests");
        }
        return [dummy1536];
      }),
    };

    const results = await EmbeddingService.generateEmbeddings(["Retry text"], {
      provider: mockProvider,
    });

    expect(results).toHaveLength(1);
    expect(callCount).toBe(2);
  });

  it("throws clear error when vector dimensions do not match expected dimensions", async () => {
    const invalidVector = new Array(768).fill(0.1); // Wrong dimension
    const mockProvider: AIProvider = {
      generateText: vi.fn(),
      generateStructured: vi.fn(),
      streamText: vi.fn(),
      generateEmbeddings: vi.fn().mockResolvedValue([invalidVector]),
    };

    await expect(
      EmbeddingService.generateEmbeddings(["Input text"], { provider: mockProvider })
    ).rejects.toThrow(/expected 1536 dimensions, got 768/i);
  });

  it("returns empty array when given empty inputs without calling provider", async () => {
    const mockProvider: AIProvider = {
      generateText: vi.fn(),
      generateStructured: vi.fn(),
      streamText: vi.fn(),
      generateEmbeddings: vi.fn(),
    };

    const results = await EmbeddingService.generateEmbeddings([], {
      provider: mockProvider,
    });

    expect(results).toEqual([]);
    expect(mockProvider.generateEmbeddings).not.toHaveBeenCalled();
  });
});
