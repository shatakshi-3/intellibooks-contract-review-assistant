import { describe, it, expect } from "vitest";
import { PDFExtractor } from "@/modules/processing/extractors/pdf";
import { DOCXExtractor } from "@/modules/processing/extractors/docx";
import { TXTExtractor } from "@/modules/processing/extractors/txt";
import { extractDocument } from "@/modules/processing/extractors";
import { DOMMatrixPolyfill } from "@/modules/processing/extractors/pdf-polyfill";
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

// Helper to create an encrypted/password-protected minimal PDF
function createEncryptedPdfBuffer(): Buffer {
  const pdfString = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>> endobj
4 0 obj <</Filter /Standard /V 1 /R 2 /O (12345678901234567890123456789012) /U (12345678901234567890123456789012) /P -44>> endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000120 00000 n 
0000000190 00000 n 
trailer <</Size 5 /Root 1 0 R /Encrypt 4 0 R /ID [<1234><1234>]>>
startxref
320
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
      expect(result.pageCount).toBe(2);
      expect(result.pages.length).toBe(2);
      expect(result.fullText).toContain("Initial Term");
      expect(result.fullText).toContain("Mutual Indemnification");
      expect(result.pages[0].startOffset).toBe(0);
      expect(result.pages[0].endOffset).toBeGreaterThan(0);
      expect(result.pages[1].startOffset).toBeGreaterThanOrEqual(result.pages[0].endOffset);
      expect(result.metadata.charCount).toBe(result.fullText.length);
      expect(result.sections.length).toBeGreaterThanOrEqual(2);
    });

    it("extracts text from a single-page valid PDF", async () => {
      const singlePagePdf = createValidPdfBuffer(
        "Section 1: Master Confidentiality and Non-Disclosure Agreement for Proprietary Assets"
      );

      const result = await pdfExtractor.extract(singlePagePdf);

      expect(result.metadata.fileType).toBe("pdf");
      expect(result.pageCount).toBe(1);
      expect(result.pages.length).toBe(1);
      expect(result.fullText).toContain("Master Confidentiality");
      expect(result.sections.length).toBe(1);
      expect(result.sections[0].title).toContain("Section 1");
    });

    it("rejects empty PDF buffers", async () => {
      await expect(pdfExtractor.extract(Buffer.alloc(0))).rejects.toThrow("empty PDF");
    });

    it("detects and rejects corrupted/malformed PDF files", async () => {
      const corruptBuffer = Buffer.from("%PDF-1.4\ncorrupted bytes content invalid xref");
      await expect(pdfExtractor.extract(corruptBuffer)).rejects.toThrow(/Corrupted|malformed|Invalid PDF/i);
    });

    it("detects and flags image-only or scanned PDFs without readable text", async () => {
      // PDF containing under 50 chars threshold
      const emptyPagePdf = createValidPdfBuffer("short");
      await expect(pdfExtractor.extract(emptyPagePdf)).rejects.toThrow(/Scanned or image-only PDF detected/i);
    });

    it("detects and rejects encrypted or password-protected PDFs", async () => {
      const encryptedPdf = createEncryptedPdfBuffer();
      await expect(pdfExtractor.extract(encryptedPdf)).rejects.toThrow(
        /Encrypted or password-protected PDFs are not supported/i
      );
    });

    it("extracts PDF text without requiring native canvas binary", async () => {
      const pdfBuffer = createValidPdfBuffer(
        "Section 1: Standard Serverless PDF Extraction Under Headless Environment"
      );
      const result = await pdfExtractor.extract(pdfBuffer);
      expect(result.fullText).toContain("Standard Serverless PDF Extraction");
      expect(result.pageCount).toBe(1);
    });
  });

  describe("DOMMatrix & Serverless Polyfill", () => {
    it("satisfies 2D and 3D affine matrix transformation specifications", () => {
      const identity = new DOMMatrixPolyfill();
      expect(identity.isIdentity).toBe(true);
      expect(identity.is2D).toBe(true);
      expect(identity.a).toBe(1);
      expect(identity.d).toBe(1);
      expect(identity.e).toBe(0);
      expect(identity.f).toBe(0);

      // Translation
      const translated = identity.translate(10, 20);
      expect(translated.e).toBe(10);
      expect(translated.f).toBe(20);
      expect(translated.isIdentity).toBe(false);

      // Scaling
      const scaled = translated.scale(2, 3);
      expect(scaled.a).toBe(2);
      expect(scaled.d).toBe(3);
      expect(scaled.e).toBe(10);
      expect(scaled.f).toBe(20);

      // Point transformation
      const point = scaled.transformPoint({ x: 5, y: 5 });
      expect(point.x).toBe(5 * 2 + 10);
      expect(point.y).toBe(5 * 3 + 20);

      // 2D Inversion
      const inv = scaled.inverse();
      const roundTrip = scaled.multiply(inv);
      expect(Math.round(roundTrip.a)).toBe(1);
      expect(Math.round(roundTrip.d)).toBe(1);
      expect(Math.round(roundTrip.e)).toBe(0);
      expect(Math.round(roundTrip.f)).toBe(0);

      // Float array export
      const f32 = scaled.toFloat32Array();
      expect(f32.length).toBe(16);
      expect(f32[0]).toBe(2);
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
