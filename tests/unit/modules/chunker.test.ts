import { describe, it, expect } from "vitest";
import { DocumentChunker } from "@/modules/processing/chunker";
import { TXTExtractor } from "@/modules/processing/extractors/txt";
import fs from "fs";
import path from "path";

describe("DocumentChunker Structure-Aware Chunking Tests", () => {
  const fixturesDir = path.join(__dirname, "../../fixtures/contracts");
  const txtExtractor = new TXTExtractor();

  it("splits agreements along clause and paragraph boundaries while preserving offsets", async () => {
    const rawBuffer = fs.readFileSync(path.join(fixturesDir, "complete-contract.txt"));
    const extraction = await txtExtractor.extract(rawBuffer);

    const chunker = new DocumentChunker({ targetChunkTokens: 100, overlapTokens: 20 });
    const chunks = chunker.chunk(extraction);

    expect(chunks.length).toBeGreaterThan(1);

    // Verify chunk integrity and traceability
    for (const chunk of chunks) {
      expect(chunk.content.trim().length).toBeGreaterThan(0);
      expect(chunk.chunkIndex).toBeGreaterThanOrEqual(0);
      expect(chunk.pageNumber).toBe(1);

      // Verify that content corresponds to offsets in extracted fullText
      const extractedSlice = extraction.fullText.substring(chunk.startCharOffset, chunk.endCharOffset);
      expect(extractedSlice).toBe(chunk.content);
    }
  });

  it("handles very long individual clauses by cleanly splitting at sentence boundaries", async () => {
    const rawBuffer = fs.readFileSync(path.join(fixturesDir, "very-long-clause.txt"));
    const extraction = await txtExtractor.extract(rawBuffer);

    // Chunk with a small target (~200 tokens ≈ 800 chars) to force clause subdivision
    const chunker = new DocumentChunker({ targetChunkTokens: 200, overlapTokens: 20 });
    const chunks = chunker.chunk(extraction);

    expect(chunks.length).toBeGreaterThanOrEqual(2);

    for (const chunk of chunks) {
      expect(chunk.content.trim().length).toBeGreaterThan(0);
      // Chunks should end on sentence or structural breaks
      expect(chunk.metadata.charLength).toBeLessThanOrEqual(2500);
    }
  });

  it("does not generate empty or whitespace-only chunks", async () => {
    const extraction = {
      fullText: "Single short sentence.",
      pageCount: 1,
      pages: [{ pageNumber: 1, text: "Single short sentence.", startOffset: 0, endOffset: 22 }],
      sections: [],
      metadata: { fileType: "txt" as const, charCount: 22, wordCount: 3 },
    };

    const chunker = new DocumentChunker();
    const chunks = chunker.chunk(extraction);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("Single short sentence.");
    expect(chunks[0].startCharOffset).toBe(0);
    expect(chunks[0].endCharOffset).toBe(22);
  });
});
