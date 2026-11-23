import { PDFExtractor } from "./pdf";
import { DOCXExtractor } from "./docx";
import { TXTExtractor } from "./txt";
import type { ExtractionResult } from "./types";

export * from "./types";
export { PDFExtractor } from "./pdf";
export { DOCXExtractor } from "./docx";
export { TXTExtractor } from "./txt";

const pdfExtractor = new PDFExtractor();
const docxExtractor = new DOCXExtractor();
const txtExtractor = new TXTExtractor();

/**
 * Dispatch text extraction to the appropriate extractor based on verified file type.
 */
export async function extractDocument(
  buffer: Buffer,
  fileType: "pdf" | "docx" | "txt"
): Promise<ExtractionResult> {
  switch (fileType) {
    case "pdf":
      return await pdfExtractor.extract(buffer);
    case "docx":
      return await docxExtractor.extract(buffer);
    case "txt":
      return await txtExtractor.extract(buffer);
    default:
      throw new Error(`Unsupported document type for extraction: ${fileType}`);
  }
}
