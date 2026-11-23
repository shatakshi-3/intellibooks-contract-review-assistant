/**
 * Deterministic Quote Verification Service.
 *
 * Verifies that AI-proposed quotes are authentic, verbatim substrings
 * of the original extracted document text:
 * - Exact string matching against full extracted text
 * - Resolution of source character offsets [startCharOffset, endCharOffset]
 * - Mapping to concrete evidence chunks
 * - Verification against claimed location metadata (page number, section heading)
 * - Narrow whitespace-normalization fallback without silent alteration
 * - Rejection of paraphrased, fabricated, or mislocated quotations
 */

export interface EvidenceChunkReference {
  id: string;
  chunkIndex: number;
  content: string;
  pageNumber?: number | null;
  sectionTitle?: string | null;
  startCharOffset: number;
  endCharOffset: number;
}

export interface LocationClaim {
  pageNumber?: number;
  sectionHeading?: string;
  paragraph?: number;
}

export interface QuoteVerificationResult {
  verified: boolean;
  exactQuote: string | null;
  startCharOffset?: number;
  endCharOffset?: number;
  matchedChunkId?: string;
  pageNumber?: number;
  sectionTitle?: string;
  method: "exact_match" | "normalized_match" | "verification_failed";
  failureReason?: string;
}

export class QuoteVerificationService {
  /**
   * Verify an AI-proposed quote against original document text and evidence chunks.
   */
  static verifyQuote(
    proposedQuote: string | null | undefined,
    fullExtractedText: string,
    evidenceChunks: EvidenceChunkReference[] = [],
    locationClaim?: LocationClaim
  ): QuoteVerificationResult {
    if (!proposedQuote || proposedQuote.trim().length === 0) {
      return {
        verified: false,
        exactQuote: null,
        method: "verification_failed",
        failureReason: "No quote provided",
      };
    }

    const trimmedQuote = proposedQuote.trim();

    // 1. Attempt Exact Verbatim Match
    const exactMatches = this.findAllOccurrences(fullExtractedText, trimmedQuote);

    if (exactMatches.length > 0) {
      // Pick best occurrence matching evidence chunks if multiple exist
      const bestMatch = this.selectBestMatch(
        exactMatches,
        trimmedQuote.length,
        evidenceChunks,
        locationClaim
      );

      // Verify location consistency if claimed
      const locationValidation = this.validateLocation(
        bestMatch.startOffset,
        bestMatch.endOffset,
        evidenceChunks,
        locationClaim
      );

      if (!locationValidation.valid) {
        return {
          verified: false,
          exactQuote: null,
          method: "verification_failed",
          failureReason: locationValidation.reason,
        };
      }

      return {
        verified: true,
        exactQuote: trimmedQuote,
        startCharOffset: bestMatch.startOffset,
        endCharOffset: bestMatch.endOffset,
        matchedChunkId: locationValidation.chunk?.id,
        pageNumber: locationValidation.pageNumber,
        sectionTitle: locationValidation.sectionTitle,
        method: "exact_match",
      };
    }

    // 2. Narrow Whitespace-Normalization Fallback
    // Only collapses variable inter-word whitespace and standardized newlines
    const normalizedQuote = this.collapseWhitespace(trimmedQuote);
    const normalizedDoc = this.collapseWhitespace(fullExtractedText);

    const normIndex = normalizedDoc.indexOf(normalizedQuote);
    if (normIndex !== -1) {
      // Find original text boundaries corresponding to normalized index
      const originalSpan = this.mapNormalizedSpanToOriginal(
        fullExtractedText,
        normIndex,
        normalizedQuote.length
      );

      if (originalSpan) {
        const verbatimOriginalSlice = fullExtractedText.substring(
          originalSpan.startOffset,
          originalSpan.endOffset
        );

        // Confirm difference is ONLY whitespace (no words or punctuation differed)
        if (this.collapseWhitespace(verbatimOriginalSlice) === normalizedQuote) {
          const locationValidation = this.validateLocation(
            originalSpan.startOffset,
            originalSpan.endOffset,
            evidenceChunks,
            locationClaim
          );

          if (!locationValidation.valid) {
            return {
              verified: false,
              exactQuote: null,
              method: "verification_failed",
              failureReason: locationValidation.reason,
            };
          }

          return {
            verified: true,
            exactQuote: verbatimOriginalSlice, // Return verbatim document slice
            startCharOffset: originalSpan.startOffset,
            endCharOffset: originalSpan.endOffset,
            matchedChunkId: locationValidation.chunk?.id,
            pageNumber: locationValidation.pageNumber,
            sectionTitle: locationValidation.sectionTitle,
            method: "normalized_match",
          };
        }
      }
    }

    // 3. Match failed: quote is paraphrased, fabricated, or altered
    return {
      verified: false,
      exactQuote: null,
      method: "verification_failed",
      failureReason: "Proposed quote does not exist verbatim in the original document text",
    };
  }

  /**
   * Find all exact substring offsets of searchStr in sourceText.
   */
  private static findAllOccurrences(sourceText: string, searchStr: string): number[] {
    const indices: number[] = [];
    let pos = sourceText.indexOf(searchStr);
    while (pos !== -1) {
      indices.push(pos);
      pos = sourceText.indexOf(searchStr, pos + 1);
    }
    return indices;
  }

  /**
   * Disambiguate duplicate quote occurrences by selecting the one within evidence chunks or claimed location.
   */
  private static selectBestMatch(
    occurrences: number[],
    quoteLength: number,
    evidenceChunks: EvidenceChunkReference[],
    locationClaim?: LocationClaim
  ): { startOffset: number; endOffset: number } {
    if (occurrences.length === 1) {
      return { startOffset: occurrences[0], endOffset: occurrences[0] + quoteLength };
    }

    // Find occurrence falling inside one of the evidence chunks
    for (const pos of occurrences) {
      const endPos = pos + quoteLength;
      for (const chunk of evidenceChunks) {
        if (pos >= chunk.startCharOffset && endPos <= chunk.endCharOffset + 50) {
          // If location claim has page number, check chunk page number
          if (locationClaim?.pageNumber && chunk.pageNumber) {
            if (chunk.pageNumber === locationClaim.pageNumber) {
              return { startOffset: pos, endOffset: endPos };
            }
          } else {
            return { startOffset: pos, endOffset: endPos };
          }
        }
      }
    }

    // Fallback to first occurrence
    return { startOffset: occurrences[0], endOffset: occurrences[0] + quoteLength };
  }

  /**
   * Validate that offsets correspond to evidence chunks and match claimed location metadata.
   */
  private static validateLocation(
    startOffset: number,
    endOffset: number,
    evidenceChunks: EvidenceChunkReference[],
    locationClaim?: LocationClaim
  ): {
    valid: boolean;
    reason?: string;
    chunk?: EvidenceChunkReference;
    pageNumber?: number;
    sectionTitle?: string;
  } {
    // Locate enclosing or closest chunk
    let matchingChunk = evidenceChunks.find(
      (c) => startOffset >= c.startCharOffset && startOffset <= c.endCharOffset
    );

    if (!matchingChunk && evidenceChunks.length > 0) {
      // Find chunk with minimal offset distance
      matchingChunk = evidenceChunks.reduce((prev, curr) => {
        const prevDist = Math.abs(prev.startCharOffset - startOffset);
        const currDist = Math.abs(curr.startCharOffset - startOffset);
        return currDist < prevDist ? curr : prev;
      });
    }

    const resolvedPage = matchingChunk?.pageNumber ?? locationClaim?.pageNumber;
    const resolvedSection = matchingChunk?.sectionTitle ?? locationClaim?.sectionHeading;

    // Check if location claim blatantly conflicts with verified chunk page
    if (
      locationClaim?.pageNumber &&
      matchingChunk?.pageNumber &&
      locationClaim.pageNumber !== matchingChunk.pageNumber
    ) {
      return {
        valid: false,
        reason: `Location conflict: Claimed page ${locationClaim.pageNumber}, but quote is located on page ${matchingChunk.pageNumber}`,
      };
    }

    return {
      valid: true,
      chunk: matchingChunk,
      pageNumber: resolvedPage ?? undefined,
      sectionTitle: resolvedSection ?? undefined,
    };
  }

  /**
   * Collapse whitespace: replace newlines and multiple spaces with a single space.
   */
  private static collapseWhitespace(text: string): string {
    return text.replace(/\s+/g, " ").trim();
  }

  /**
   * Map normalized character span back to original document text offsets.
   */
  private static mapNormalizedSpanToOriginal(
    originalText: string,
    normStart: number,
    normLength: number
  ): { startOffset: number; endOffset: number } | null {
    let normIndex = 0;
    let origStart: number | null = null;
    let origEnd: number | null = null;
    let inWhitespace = false;

    for (let origI = 0; origI < originalText.length; origI++) {
      const char = originalText[origI];
      const isWs = /\s/.test(char);

      if (isWs) {
        if (!inWhitespace) {
          if (normIndex === normStart && origStart === null) {
            origStart = origI;
          }
          normIndex++;
          inWhitespace = true;
        }
      } else {
        inWhitespace = false;
        if (normIndex === normStart && origStart === null) {
          origStart = origI;
        }
        normIndex++;
      }

      if (normIndex >= normStart + normLength && origEnd === null) {
        origEnd = origI + 1;
        break;
      }
    }

    if (origStart !== null && origEnd !== null) {
      return { startOffset: origStart, endOffset: origEnd };
    }
    return null;
  }
}
