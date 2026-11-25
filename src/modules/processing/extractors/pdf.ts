import "./pdf-polyfill";
import { setupPdfEnvironment } from "./pdf-polyfill";
import type { DocumentExtractor, ExtractionResult, ExtractedPage, ExtractedSection } from "./types";
import { logger } from "@/lib/logger";

export class PDFExtractor implements DocumentExtractor {
  async extract(buffer: Buffer): Promise<ExtractionResult> {
    if (!buffer || buffer.length === 0) {
      throw new Error("Cannot extract text from empty PDF buffer");
    }

    // Ensure DOMMatrix, ImageData, Path2D, and geometry environment are initialized
    setupPdfEnvironment();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let doc: any = null;

    try {
      const { extractText, getDocumentProxy, getMeta } = await import("unpdf");
      doc = await getDocumentProxy(new Uint8Array(buffer));

      const textResult = await extractText(doc, { mergePages: false });
      const meta = await getMeta(doc).catch(() => null);

      const pageTexts = Array.isArray(textResult.text) ? textResult.text : [textResult.text];
      const pages: ExtractedPage[] = [];
      const sections: ExtractedSection[] = [];
      let fullText = "";
      let currentOffset = 0;

      // Extract text page by page preserving boundaries and offsets
      for (let i = 0; i < pageTexts.length; i++) {
        const pageNum = i + 1;
        const pageText = (pageTexts[i] || "").trim();

        const startOffset = currentOffset;
        const endOffset = startOffset + pageText.length;

        pages.push({
          pageNumber: pageNum,
          text: pageText,
          startOffset,
          endOffset,
        });

        // Search for section headings within this page text (e.g. "1. Term", "Section 2")
        const lines = pageText.split("\n");
        let lineOffset = startOffset;
        for (const line of lines) {
          const trimmed = line.trim();
          if (
            /^(?:section|\d+\.|\d+\.\d+|article|[ivx]+\.)\s+[a-z0-9]/i.test(trimmed) &&
            trimmed.length < 120
          ) {
            sections.push({
              title: trimmed,
              level: trimmed.includes(".") && trimmed.split(".")[1]?.trim() ? 2 : 1,
              startOffset: lineOffset,
              endOffset: lineOffset + trimmed.length,
              pageNumber: pageNum,
            });
          }
          lineOffset += line.length + 1; // +1 for \n
        }

        fullText += (i > 0 ? "\n\n" : "") + pageText;
        currentOffset = fullText.length;
      }

      const charCount = fullText.trim().length;
      const wordCount = fullText.trim().split(/\s+/).filter(Boolean).length;
      const pageCount = pages.length || 1;

      // Detect empty or image-only scanned PDFs
      if (pageCount >= 1 && charCount < 50) {
        logger.warn("Scanned or image-only PDF detected (insufficient text extracted)", {
          pageCount,
          charCount,
        });
        throw new Error(
          "Scanned or image-only PDF detected. OCR is not supported; please upload a text-searchable PDF."
        );
      }

      return {
        fullText,
        pageCount,
        pages,
        sections,
        metadata: {
          fileType: "pdf",
          charCount,
          wordCount,
          isScannedOrImageOnly: false,
          customMetadata: meta?.info
            ? {
                title: (meta.info as unknown as Record<string, unknown>).Title,
                author: (meta.info as unknown as Record<string, unknown>).Author,
              }
            : undefined,
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const errObj = error as Record<string, unknown> | null;
      const isPassword =
        msg.toLowerCase().includes("password") ||
        errObj?.name === "PasswordException";

      if (isPassword) {
        throw new Error("Encrypted or password-protected PDFs are not supported");
      }
      if (
        msg.includes("Invalid PDF structure") ||
        msg.includes("FormatError") ||
        msg.includes("corrupted") ||
        errObj?.name === "FormatError" ||
        errObj?.name === "InvalidPDFException"
      ) {
        throw new Error(`Corrupted or malformed PDF: ${msg}`);
      }
      throw error;
    } finally {
      if (doc) {
        await doc.destroy?.().catch(() => {});
      }
    }
  }
}
