/**
 * Common types and interface for document extractors.
 */

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  startOffset: number;
  endOffset: number;
}

export interface ExtractedSection {
  title: string;
  level: number;
  startOffset: number;
  endOffset: number;
  pageNumber?: number;
}

export interface ExtractionResult {
  fullText: string;
  pageCount: number;
  pages: ExtractedPage[];
  sections: ExtractedSection[];
  metadata: {
    fileType: "pdf" | "docx" | "txt";
    charCount: number;
    wordCount: number;
    isScannedOrImageOnly?: boolean;
    customMetadata?: Record<string, unknown>;
  };
}

export interface DocumentExtractor {
  extract(buffer: Buffer): Promise<ExtractionResult>;
}
