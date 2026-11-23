import { describe, it, expect } from "vitest";
import { validateFileSignature, MAX_FILE_SIZE_BYTES, getFileType, createContractSchema } from "@/lib/validation/contracts";

describe("Real File Formats, Magic Bytes & Size Limits Integration Test", () => {
  describe("Real File Signatures & Magic Bytes", () => {
    it("validates genuine binary PDF files (%PDF-1.x)", () => {
      // Real PDF header binary: %PDF-1.7
      const realPdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
      const isValid = validateFileSignature(realPdfHeader.buffer, "pdf");
      expect(isValid).toBe(true);
    });

    it("rejects fake/disguised PDF files (e.g., text file renamed to .pdf)", () => {
      const fakePdfContent = new TextEncoder().encode("This is just plain text disguised as a PDF");
      const isValid = validateFileSignature(fakePdfContent.buffer, "pdf");
      expect(isValid).toBe(false);
    });

    it("validates genuine binary DOCX files (PK.. zip container)", () => {
      // Real DOCX header binary: PK\x03\x04
      const realDocxHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
      const isValid = validateFileSignature(realDocxHeader.buffer, "docx");
      expect(isValid).toBe(true);
    });

    it("rejects fake/disguised DOCX files", () => {
      const fakeDocx = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      const isValid = validateFileSignature(fakeDocx.buffer, "docx");
      expect(isValid).toBe(false);
    });

    it("validates plain text TXT files", () => {
      const textContent = new TextEncoder().encode("CONFIDENTIALITY AND NON-DISCLOSURE AGREEMENT\n1. Definitions...");
      const isValid = validateFileSignature(textContent.buffer, "txt");
      expect(isValid).toBe(true);
    });
  });

  describe("File Size Boundary Testing (20 MB Cap)", () => {
    it("accepts file sizes up to exactly 20 MB", () => {
      const exact20MB = MAX_FILE_SIZE_BYTES; // 20,971,520 bytes
      const result = createContractSchema.safeParse({
        filename: "enterprise_contract.pdf",
        fileSize: exact20MB,
        fileType: "pdf",
        contentType: "application/pdf",
      });

      expect(result.success).toBe(true);
    });

    it("rejects file sizes exceeding 20 MB by even 1 byte", () => {
      const exceededByOneByte = MAX_FILE_SIZE_BYTES + 1;
      const result = createContractSchema.safeParse({
        filename: "oversized_contract.pdf",
        fileSize: exceededByOneByte,
        fileType: "pdf",
        contentType: "application/pdf",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("20 MB");
      }
    });

    it("rejects zero-byte or negative file sizes", () => {
      const zeroByte = createContractSchema.safeParse({
        filename: "empty.pdf",
        fileSize: 0,
        fileType: "pdf",
        contentType: "application/pdf",
      });
      expect(zeroByte.success).toBe(false);

      const negativeByte = createContractSchema.safeParse({
        filename: "negative.pdf",
        fileSize: -100,
        fileType: "pdf",
        contentType: "application/pdf",
      });
      expect(negativeByte.success).toBe(false);
    });
  });

  describe("Extension & Content Type Cross-Validation", () => {
    it("correctly identifies PDF, DOCX, and TXT", () => {
      expect(getFileType("master_agreement.PDF")).toBe("pdf");
      expect(getFileType("employment_contract.docx")).toBe("docx");
      expect(getFileType("nda_terms.txt")).toBe("txt");
    });

    it("rejects executables, scripts, and media files", () => {
      expect(getFileType("contract.exe")).toBeNull();
      expect(getFileType("script.sh")).toBeNull();
      expect(getFileType("agreement.png")).toBeNull();
      expect(getFileType("archive.zip")).toBeNull();
    });
  });
});
