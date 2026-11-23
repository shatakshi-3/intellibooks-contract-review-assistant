import { describe, it, expect } from "vitest";
import { PDFExtractor } from "@/modules/processing/extractors/pdf";
import { DOCXExtractor } from "@/modules/processing/extractors/docx";
import { TXTExtractor } from "@/modules/processing/extractors/txt";
import { extractDocument } from "@/modules/processing/extractors";
import fs from "fs";
import path from "path";

// Helper to create a valid minimal binary PDF with specified text
function createValidPdfBuffer(page1Text: string, page2Text?: string): Buffer {
  const content1 = `BT /F1 12 Tf 72 712 Td (${page1Text}) Tj ET`;
  const stream1 = `4 0 obj <</Length ${content1.length}>> stream\n${content1}\nendstream endobj`;

  let pdfString = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R${page2Text ? " 5 0 R" : ""}] /Count ${page2Text ? "2" : "1"}>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R>> endobj
${stream1}
`;

  if (page2Text) {
    const content2 = `BT /F1 12 Tf 72 712 Td (${page2Text}) Tj ET`;
    const stream2 = `6 0 obj <</Length ${content2.length}>> stream\n${content2}\nendstream endobj`;
    pdfString += `5 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R>> endobj\n${stream2}\n`;
  }

  pdfString += `xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000130 00000 n 
0000000220 00000 n 
trailer <</Size 7 /Root 1 0 R>>
startxref
400
%%EOF`;

  return Buffer.from(pdfString);
}

describe("Document Extractors Unit & Integration Tests", () => {
  const fixturesDir = path.join(__dirname, "../../fixtures/contracts");

  describe("PDF Extractor", () => {
    const pdfExtractor = new PDFExtractor();

    it("extracts text page-by-page from a valid multi-page PDF preserving offsets", async () => {
      const pdfBuffer = createValidPdfBuffer(
        "Section 1: Initial Term and Renewal Conditions for Agreement",
        "Section 2: Mutual Indemnification and Liability Caps"
      );

      const result = await pdfExtractor.extract(pdfBuffer);

      expect(result.metadata.fileType).toBe("pdf");
      expect(result.pageCount).toBeGreaterThanOrEqual(1);
      expect(result.pages.length).toBeGreaterThanOrEqual(1);
      expect(result.fullText).toContain("Initial Term");
      expect(result.pages[0].startOffset).toBe(0);
      expect(result.pages[0].endOffset).toBeGreaterThan(0);
      expect(result.metadata.charCount).toBe(result.fullText.length);
    });

    it("rejects empty PDF buffers", async () => {
      await expect(pdfExtractor.extract(Buffer.alloc(0))).rejects.toThrow("empty PDF");
    });

    it("detects and rejects corrupted/malformed PDF files", async () => {
      const corruptBuffer = Buffer.from("%PDF-1.4\ncorrupted bytes content invalid xref");
      await expect(pdfExtractor.extract(corruptBuffer)).rejects.toThrow(/Corrupted|malformed|Invalid PDF/i);
    });

    it("detects and flags image-only or scanned PDFs without readable text", async () => {
      // PDF containing no text elements (under 50 chars threshold)
      const emptyPagePdf = createValidPdfBuffer("short");
      await expect(pdfExtractor.extract(emptyPagePdf)).rejects.toThrow(/Scanned or image-only PDF detected/i);
    });
  });

  describe("DOCX Extractor", () => {
    const docxExtractor = new DOCXExtractor();

    it("rejects empty DOCX buffers", async () => {
      await expect(docxExtractor.extract(Buffer.alloc(0))).rejects.toThrow("empty DOCX");
    });

    it("rejects invalid/corrupt DOCX files (not a valid zip container)", async () => {
      const invalidZipBuffer = Buffer.from("PK\x03\x04 corrupt zip archive data");
      await expect(docxExtractor.extract(invalidZipBuffer)).rejects.toThrow(/Corrupted or invalid DOCX/i);
    });
  });

  describe("TXT Extractor", () => {
    const txtExtractor = new TXTExtractor();

    it("extracts full text, normalizes newlines, and preserves sections", async () => {
      const completeContractPath = path.join(fixturesDir, "complete-contract.txt");
      const fileBuffer = fs.readFileSync(completeContractPath);

      const result = await txtExtractor.extract(fileBuffer);

      expect(result.metadata.fileType).toBe("txt");
      expect(result.fullText).toContain("MASTER SERVICES AGREEMENT");
      expect(result.fullText).toContain("Governing Law and Jurisdiction");
      expect(result.sections.length).toBeGreaterThanOrEqual(5);

      // Verify section offsets trace to fullText
      for (const section of result.sections) {
        const textAtOffset = result.fullText.substring(section.startOffset, section.endOffset);
        expect(textAtOffset).toBe(section.title);
      }
    });

    it("handles Unicode characters and unusual whitespace gracefully", async () => {
      const unicodePath = path.join(fixturesDir, "unicode-whitespace.txt");
      const fileBuffer = fs.readFileSync(unicodePath);

      const result = await txtExtractor.extract(fileBuffer);

      expect(result.fullText).toContain("€50,000");
      expect(result.fullText).toContain("¥5,000,000");
      expect(result.fullText).toContain("Müller");
      expect(result.fullText).toContain("∀x ∈ Secrets");
    });

    it("rejects empty text files", async () => {
      await expect(txtExtractor.extract(Buffer.from("   \n\n  \t"))).rejects.toThrow("Empty text file");
    });
  });

  describe("Dispatcher: extractDocument", () => {
    it("routes correctly by document type", async () => {
      const textBuffer = Buffer.from("1. Scope\nService shall be provided per SLA.");
      const result = await extractDocument(textBuffer, "txt");
      expect(result.metadata.fileType).toBe("txt");
      expect(result.fullText).toContain("Service shall be provided");
    });
  });
});
