import { describe, it, expect } from "vitest";
import {
  QuoteVerificationService,
  type EvidenceChunkReference,
} from "@/modules/reviews/quote-verifier";

describe("QuoteVerificationService Unit Tests", () => {
  const sampleDoc = `
AGREEMENT BETWEEN ACME CORP AND BETA LLC

1. PARTIES
This Consulting Agreement (the "Agreement") is entered into as of January 15, 2025,
by and between Acme Corporation, a Delaware corporation ("Client"), and Beta LLC,
a California limited liability company ("Consultant").

2. TERM AND TERMINATION
The term of this Agreement shall commence on February 1, 2025 and continue for one (1) year.
Either party may terminate this Agreement without cause upon thirty (30) days' written notice.

3. LIMITATION OF LIABILITY
IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
OR CONSEQUENTIAL DAMAGES, INCLUDING LOSS OF PROFITS, ARISING OUT OF OR IN CONNECTION WITH THIS AGREEMENT.
TOTAL AGGREGATE LIABILITY UNDER THIS AGREEMENT SHALL BE LIMITED TO THE FEES PAID IN THE PRIOR TWELVE MONTHS.

4. GOVERNING LAW
This Agreement shall be governed by and construed in accordance with the laws of the State of New York,
without regard to its conflict of law principles.
`.trim();

  const mockChunks: EvidenceChunkReference[] = [
    {
      id: "chunk-1",
      chunkIndex: 0,
      content: sampleDoc.substring(0, 300),
      pageNumber: 1,
      sectionTitle: "1. PARTIES",
      startCharOffset: 0,
      endCharOffset: 300,
    },
    {
      id: "chunk-2",
      chunkIndex: 1,
      content: sampleDoc.substring(300, 600),
      pageNumber: 1,
      sectionTitle: "2. TERM AND TERMINATION",
      startCharOffset: 300,
      endCharOffset: 600,
    },
    {
      id: "chunk-3",
      chunkIndex: 2,
      content: sampleDoc.substring(600),
      pageNumber: 2,
      sectionTitle: "3. LIMITATION OF LIABILITY",
      startCharOffset: 600,
      endCharOffset: sampleDoc.length,
    },
  ];

  it("verifies an exact verbatim quotation successfully", () => {
    const proposedQuote = "Either party may terminate this Agreement without cause upon thirty (30) days' written notice.";
    const result = QuoteVerificationService.verifyQuote(
      proposedQuote,
      sampleDoc,
      mockChunks,
      { pageNumber: 1, sectionHeading: "2. TERM AND TERMINATION" }
    );

    expect(result.verified).toBe(true);
    expect(result.method).toBe("exact_match");
    expect(result.exactQuote).toBe(proposedQuote);
    expect(result.startCharOffset).toBeGreaterThan(0);
    expect(result.endCharOffset).toBe(result.startCharOffset! + proposedQuote.length);
    expect(result.matchedChunkId).toBe("chunk-2");
    expect(result.pageNumber).toBe(1);
  });

  it("rejects paraphrased text that does not exist verbatim", () => {
    const paraphrasedQuote = "Either party can cancel this contract without reason with 30 days notice.";
    const result = QuoteVerificationService.verifyQuote(
      paraphrasedQuote,
      sampleDoc,
      mockChunks
    );

    expect(result.verified).toBe(false);
    expect(result.method).toBe("verification_failed");
    expect(result.exactQuote).toBeNull();
    expect(result.failureReason).toContain("does not exist verbatim");
  });

  it("rejects quote with punctuation alteration", () => {
    // Missing period and altered quotes
    const alteredPunctuation = "This Consulting Agreement (the Agreement) is entered into as of January 15, 2025";
    const result = QuoteVerificationService.verifyQuote(
      alteredPunctuation,
      sampleDoc,
      mockChunks
    );

    expect(result.verified).toBe(false);
    expect(result.method).toBe("verification_failed");
  });

  it("supports narrow whitespace normalization across line breaks while preserving exact text", () => {
    // Single space instead of newline between '2025,' and 'by and between'
    const quoteWithNormalizedWhitespace = "January 15, 2025, by and between Acme Corporation";
    const result = QuoteVerificationService.verifyQuote(
      quoteWithNormalizedWhitespace,
      sampleDoc,
      mockChunks
    );

    expect(result.verified).toBe(true);
    // Method reflects normalized matching
    expect(result.method).toBe("normalized_match");
    // Returns exact verbatim characters from the document
    expect(result.exactQuote).toContain("January 15, 2025");
    expect(result.exactQuote).toContain("by and between Acme Corporation");
  });

  it("rejects quote with incorrect or fabricated location claim", () => {
    const proposedQuote = "TOTAL AGGREGATE LIABILITY UNDER THIS AGREEMENT SHALL BE LIMITED TO THE FEES PAID";
    // Claiming page 5 when chunk is on page 2
    const result = QuoteVerificationService.verifyQuote(
      proposedQuote,
      sampleDoc,
      mockChunks,
      { pageNumber: 5, sectionHeading: "3. LIMITATION OF LIABILITY" }
    );

    expect(result.verified).toBe(false);
    expect(result.method).toBe("verification_failed");
    expect(result.failureReason).toContain("Location conflict");
    expect(result.failureReason).toContain("Claimed page 5");
  });

  it("disambiguates duplicate occurrences of a clause correctly", () => {
    const duplicateDoc = `
Clause A: The parties agree to mediate disputes.
... several paragraphs ...
Clause B: The parties agree to mediate disputes.
`.trim();

    const chunks: EvidenceChunkReference[] = [
      {
        id: "chunk-a",
        chunkIndex: 0,
        content: "Clause A: The parties agree to mediate disputes.",
        pageNumber: 1,
        startCharOffset: 0,
        endCharOffset: 48,
      },
      {
        id: "chunk-b",
        chunkIndex: 5,
        content: "Clause B: The parties agree to mediate disputes.",
        pageNumber: 3,
        startCharOffset: 70,
        endCharOffset: 130,
      },
    ];

    const result = QuoteVerificationService.verifyQuote(
      "The parties agree to mediate disputes.",
      duplicateDoc,
      [chunks[1]], // specifically examining chunk-b on page 3
      { pageNumber: 3 }
    );

    expect(result.verified).toBe(true);
    expect(result.pageNumber).toBe(3);
    expect(result.matchedChunkId).toBe("chunk-b");
    expect(result.startCharOffset).toBeGreaterThan(50);
  });

  it("handles Unicode characters such as em-dashes and curly quotes", () => {
    const unicodeDoc = `Payment shall be made via ACH transfer — within 30 days of receipt of “valid invoice”.`;
    const unicodeChunks: EvidenceChunkReference[] = [
      {
        id: "chunk-u",
        chunkIndex: 0,
        content: unicodeDoc,
        pageNumber: 1,
        startCharOffset: 0,
        endCharOffset: unicodeDoc.length,
      },
    ];

    const quote = `ACH transfer — within 30 days of receipt of “valid invoice”`;
    const result = QuoteVerificationService.verifyQuote(quote, unicodeDoc, unicodeChunks);

    expect(result.verified).toBe(true);
    expect(result.exactQuote).toBe(quote);
    expect(result.method).toBe("exact_match");
  });
});
