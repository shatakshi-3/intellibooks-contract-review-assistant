import type { DocumentExtractor, ExtractionResult, ExtractedSection } from "./types";

export class TXTExtractor implements DocumentExtractor {
  async extract(buffer: Buffer): Promise<ExtractionResult> {
    if (!buffer || buffer.length === 0) {
      throw new Error("Cannot extract text from empty TXT file");
    }

    let decoded: string;
    try {
      // Decode UTF-8, fatal=true catches invalid encoding sequences
      const decoder = new TextDecoder("utf-8", { fatal: true });
      decoded = decoder.decode(buffer);
    } catch {
      // Fallback with replacement characters if strict UTF-8 fails
      const fallbackDecoder = new TextDecoder("utf-8", { fatal: false });
      decoded = fallbackDecoder.decode(buffer);
    }

    // Normalize newlines to standard LF
    const normalized = decoded.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const fullText = normalized.trim();

    if (!fullText) {
      throw new Error("Empty text file: contains only whitespace or control characters");
    }

    // Parse sections and track line offsets
    const sections: ExtractedSection[] = [];
    const lines = normalized.split("\n");
    let currentOffset = 0;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const trimmed = line.trim();

      // Heading patterns: "1. Term", "1.1 Definitions", "SECTION 1:", "ARTICLE II", etc.
      if (
        /^(?:section|\d+\.|\d+\.\d+|article|[ivx]+\.)\s+[a-z0-9]/i.test(trimmed) &&
        trimmed.length < 120
      ) {
        sections.push({
          title: trimmed,
          level: trimmed.includes(".") && trimmed.split(".")[1]?.trim() ? 2 : 1,
          startOffset: currentOffset + (line.length - line.trimStart().length),
          endOffset: currentOffset + line.length,
          pageNumber: 1,
        });
      }

      currentOffset += line.length + 1; // +1 for \n
    }

    const charCount = fullText.length;
    const wordCount = fullText.split(/\s+/).filter(Boolean).length;

    return {
      fullText,
      pageCount: 1,
      pages: [
        {
          pageNumber: 1,
          text: fullText,
          startOffset: 0,
          endOffset: fullText.length,
        },
      ],
      sections,
      metadata: {
        fileType: "txt",
        charCount,
        wordCount,
        isScannedOrImageOnly: false,
        customMetadata: {
          lineCount: lines.length,
        },
      },
    };
  }
}
