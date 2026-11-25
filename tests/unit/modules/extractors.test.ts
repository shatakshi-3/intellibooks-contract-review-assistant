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

    it("verifies mathematical correctness of constructor variants and CSS string parsing", () => {
      // 1. 6-element array constructor (2D)
      const m2d = new DOMMatrixPolyfill([2, 0, 0, 3, 40, 50]);
      expect(m2d.is2D).toBe(true);
      expect(m2d.a).toBe(2);
      expect(m2d.d).toBe(3);
      expect(m2d.e).toBe(40);
      expect(m2d.f).toBe(50);

      // 2. 16-element array constructor (3D)
      const m3d = new DOMMatrixPolyfill([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        10, 20, 30, 1,
      ]);
      expect(m3d.is2D).toBe(false);
      expect(m3d.m41).toBe(10);
      expect(m3d.m42).toBe(20);
      expect(m3d.m43).toBe(30);

      // 3. Object with { a, b, c, d, e, f }
      const fromObj = new DOMMatrixPolyfill({ a: 1.5, b: 0, c: 0, d: 2.5, e: 100, f: 200 });
      expect(fromObj.a).toBe(1.5);
      expect(fromObj.d).toBe(2.5);
      expect(fromObj.e).toBe(100);
      expect(fromObj.f).toBe(200);

      // 4. CSS transform string parsing: matrix(a, b, c, d, e, f)
      const fromCss = new DOMMatrixPolyfill("matrix(2, 0, 0, 4, 15, 25)");
      expect(fromCss.is2D).toBe(true);
      expect(fromCss.a).toBe(2);
      expect(fromCss.d).toBe(4);
      expect(fromCss.e).toBe(15);
      expect(fromCss.f).toBe(25);

      // 5. CSS transform string parsing: matrix3d(...)
      const fromCss3d = new DOMMatrixPolyfill(
        "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 10, 15, 1)"
      );
      expect(fromCss3d.is2D).toBe(false);
      expect(fromCss3d.m41).toBe(5);
      expect(fromCss3d.m42).toBe(10);
      expect(fromCss3d.m43).toBe(15);

      // 6. Static methods
      const staticFrom = DOMMatrixPolyfill.fromMatrix(m2d);
      expect(staticFrom.a).toBe(2);
      expect(staticFrom.is2D).toBe(true);

      const f64 = m2d.toFloat64Array();
      expect(f64.length).toBe(16);
      expect(f64[0]).toBe(2);
    });

    it("verifies mathematical correctness of matrix multiplication and non-commutativity", () => {
      // Translation matrix T: translate(10, 0)
      const T = new DOMMatrixPolyfill().translate(10, 0);
      // Scale matrix S: scale(2, 1)
      const S = new DOMMatrixPolyfill().scale(2, 1);

      // T * S: translate first, then scale
      const TS = T.multiply(S);
      // S * T: scale first, then translate
      const ST = S.multiply(T);

      // In affine transformations, matrix multiplication is non-commutative
      expect(TS.e).not.toBe(ST.e);
      expect(TS.e).toBe(10);
      expect(ST.e).toBe(20);

      // preMultiplySelf matches other.multiply(this)
      const pre = new DOMMatrixPolyfill(S).preMultiplySelf(T);
      expect(pre.e).toBe(TS.e);
      expect(pre.a).toBe(TS.a);
    });

    it("verifies mathematical correctness of 2D and 3D matrix inversion", () => {
      // Arbitrary 2D affine matrix with shear
      const M2 = new DOMMatrixPolyfill([2, 1, 0.5, 3, 10, 20]);
      const inv2 = M2.inverse();
      const roundTrip2 = M2.multiply(inv2);

      expect(roundTrip2.a).toBeCloseTo(1, 5);
      expect(roundTrip2.b).toBeCloseTo(0, 5);
      expect(roundTrip2.c).toBeCloseTo(0, 5);
      expect(roundTrip2.d).toBeCloseTo(1, 5);
      expect(roundTrip2.e).toBeCloseTo(0, 5);
      expect(roundTrip2.f).toBeCloseTo(0, 5);

      // 3D transformation matrix
      const M3 = new DOMMatrixPolyfill([
        2, 0, 0, 0,
        0, 3, 0, 0,
        0, 0, 4, 0,
        10, 20, 30, 1,
      ]);
      expect(M3.is2D).toBe(false);
      const inv3 = M3.inverse();
      const roundTrip3 = M3.multiply(inv3);

      expect(roundTrip3.m11).toBeCloseTo(1, 5);
      expect(roundTrip3.m22).toBeCloseTo(1, 5);
      expect(roundTrip3.m33).toBeCloseTo(1, 5);
      expect(roundTrip3.m44).toBeCloseTo(1, 5);
      expect(roundTrip3.m41).toBeCloseTo(0, 5);
      expect(roundTrip3.m42).toBeCloseTo(0, 5);
      expect(roundTrip3.m43).toBeCloseTo(0, 5);
    });

    it("verifies singular non-invertible matrices set components to NaN per W3C specification", () => {
      // 2D matrix with determinant 0 (rank deficient)
      const singular2d = new DOMMatrixPolyfill([0, 0, 0, 0, 10, 20]);
      const inv2d = singular2d.inverse();
      expect(Number.isNaN(inv2d.a)).toBe(true);
      expect(Number.isNaN(inv2d.d)).toBe(true);
      expect(inv2d.is2D).toBe(false);

      // 3D matrix with determinant 0
      const singular3d = new DOMMatrixPolyfill([
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
      ]);
      const inv3d = singular3d.inverse();
      expect(Number.isNaN(inv3d.m11)).toBe(true);
      expect(inv3d.is2D).toBe(false);
    });

    it("verifies transformPoint with 2D, 3D, and projective w components", () => {
      const M = new DOMMatrixPolyfill().translate(5, 10).scale(2, 3);
      // 2D point (default z=0, w=1)
      const p2 = M.transformPoint({ x: 3, y: 4 });
      expect(p2.x).toBe(3 * 2 + 5);
      expect(p2.y).toBe(4 * 3 + 10);
      expect(p2.z).toBe(0);
      expect(p2.w).toBe(1);

      // 3D point with z and w
      const M3 = new DOMMatrixPolyfill([
        2, 0, 0, 0,
        0, 3, 0, 0,
        0, 0, 4, 0,
        1, 2, 3, 1,
      ]);
      const p3 = M3.transformPoint({ x: 2, y: 2, z: 2, w: 1 });
      expect(p3.x).toBe(2 * 2 + 1);
      expect(p3.y).toBe(2 * 3 + 2);
      expect(p3.z).toBe(2 * 4 + 3);
      expect(p3.w).toBe(1);
    });

    it("verifies 2D/3D state transitions", () => {
      const m = new DOMMatrixPolyfill();
      expect(m.is2D).toBe(true);

      // 2D translation preserves is2D
      m.translateSelf(10, 20);
      expect(m.is2D).toBe(true);

      // 3D translation sets is2D to false
      m.translateSelf(0, 0, 5);
      expect(m.is2D).toBe(false);
    });
  });

  describe("Concurrent Workflow Execution Safety", () => {
    it("handles multiple concurrent PDF extractions without cross-task interference", async () => {
      const extractor = new PDFExtractor();

      const pdf1 = createValidPdfBuffer(
        "Section 1: Contract Alpha for Exclusive Intellectual Property Rights and Patents"
      );
      const pdf2 = createValidPdfBuffer(
        "Section 1: Contract Beta for Mutual Master Service Level Agreements and Penalties"
      );
      const pdf3 = createValidPdfBuffer(
        "Section 1: Contract Gamma for Enterprise Software License and Support Clauses"
      );

      // Run 3 extractions concurrently in Promise.all
      const [res1, res2, res3] = await Promise.all([
        extractor.extract(pdf1),
        extractor.extract(pdf2),
        extractor.extract(pdf3),
      ]);

      expect(res1.fullText).toContain("Contract Alpha");
      expect(res1.fullText).not.toContain("Contract Beta");

      expect(res2.fullText).toContain("Contract Beta");
      expect(res2.fullText).not.toContain("Contract Gamma");

      expect(res3.fullText).toContain("Contract Gamma");
      expect(res3.fullText).not.toContain("Contract Alpha");

      expect(res1.pageCount).toBe(1);
      expect(res2.pageCount).toBe(1);
      expect(res3.pageCount).toBe(1);
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
