import mammoth from "mammoth";
import type { DocumentExtractor, ExtractionResult, ExtractedSection } from "./types";

export class DOCXExtractor implements DocumentExtractor {
  async extract(buffer: Buffer): Promise<ExtractionResult> {
    if (!buffer || buffer.length === 0) {
      throw new Error("Cannot extract text from empty DOCX buffer");
    }

    try {
      // 1. Extract raw text for clean paragraph ordering
      const rawTextResult = await mammoth.extractRawText({ buffer });
      const fullText = rawTextResult.value.trim();

      if (!fullText) {
        throw new Error("Empty DOCX document: no readable text found");
      }

      // 2. Extract HTML to determine headings, sections, and tables
      const htmlResult = await mammoth.convertToHtml({ buffer });
      const html = htmlResult.value;

      const sections: ExtractedSection[] = [];

      // Parse headings (h1..h6) from HTML to extract heading hierarchy
      const headingRegex = /<h([1-6])>(.*?)<\/h\1>/gi;
      let match: RegExpExecArray | null;

      while ((match = headingRegex.exec(html)) !== null) {
        const level = parseInt(match[1], 10);
        // Strip inner tags from heading title
        const title = match[2].replace(/<[^>]+>/g, "").trim();

        if (title) {
          const startOffset = fullText.indexOf(title);
          if (startOffset !== -1) {
            sections.push({
              title,
              level,
              startOffset,
              endOffset: startOffset + title.length,
              // Note: Page numbers are explicitly NOT invented for DOCX
            });
          }
        }
      }

      const charCount = fullText.length;
      const wordCount = fullText.split(/\s+/).filter(Boolean).length;

      return {
        fullText,
        pageCount: 1, // Reliable rendering-based page numbering is not available in serverless DOCX, so we report 1 without guessing
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
          fileType: "docx",
          charCount,
          wordCount,
          isScannedOrImageOnly: false,
          customMetadata: {
            warnings: htmlResult.messages.map((m) => m.message),
          },
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (
        msg.includes("end of central directory") ||
        msg.includes("not a valid zip") ||
        msg.includes("Can't find end of central directory")
      ) {
        throw new Error("Corrupted or invalid DOCX file: unable to parse document archive");
      }
      throw error;
    }
  }
}
