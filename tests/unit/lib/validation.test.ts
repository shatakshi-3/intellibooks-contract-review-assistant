import { describe, it, expect } from "vitest";
import {
  createContractSchema,
  getFileType,
  validateFileSignature,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/validation/contracts";

describe("Contract Validation", () => {
  describe("getFileType", () => {
    it("identifies valid pdf extension", () => {
      expect(getFileType("contract.pdf")).toBe("pdf");
      expect(getFileType("FINAL_AGREEMENT.PDF")).toBe("pdf");
    });

    it("identifies valid docx extension", () => {
      expect(getFileType("agreement.docx")).toBe("docx");
    });

    it("identifies valid txt extension", () => {
      expect(getFileType("notes.txt")).toBe("txt");
    });

    it("returns null for disallowed extensions", () => {
      expect(getFileType("script.js")).toBeNull();
      expect(getFileType("malicious.exe")).toBeNull();
      expect(getFileType("document.pdf.exe")).toBeNull();
    });
  });

  describe("createContractSchema", () => {
    it("validates valid PDF upload parameters", () => {
      const valid = {
        filename: "service_agreement.pdf",
        fileSize: 1024 * 500, // 500 KB
        fileType: "pdf",
        contentType: "application/pdf",
      };
      const result = createContractSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects files exceeding 20 MB", () => {
      const oversized = {
        filename: "large_contract.pdf",
        fileSize: MAX_FILE_SIZE_BYTES + 1,
        fileType: "pdf",
        contentType: "application/pdf",
      };
      const result = createContractSchema.safeParse(oversized);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("20 MB");
      }
    });

    it("rejects non-positive file size", () => {
      const zeroSize = {
        filename: "empty.txt",
        fileSize: 0,
        fileType: "txt",
        contentType: "text/plain",
      };
      const result = createContractSchema.safeParse(zeroSize);
      expect(result.success).toBe(false);
    });

    it("rejects mismatched content type", () => {
      const invalidMime = {
        filename: "document.pdf",
        fileSize: 1000,
        fileType: "pdf",
        contentType: "application/x-msdownload",
      };
      const result = createContractSchema.safeParse(invalidMime);
      expect(result.success).toBe(false);
    });
  });

  describe("validateFileSignature (Magic Bytes)", () => {
    it("validates authentic PDF magic bytes (%PDF)", () => {
      // 0x25, 0x50, 0x44, 0x46
      const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
      expect(validateFileSignature(pdfHeader.buffer, "pdf")).toBe(true);
    });

    it("rejects file with wrong magic bytes claiming to be PDF", () => {
      const fakePdf = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]); // MZ executable header
      expect(validateFileSignature(fakePdf.buffer, "pdf")).toBe(false);
    });

    it("validates DOCX zip container header (PK..)", () => {
      const docxHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
      expect(validateFileSignature(docxHeader.buffer, "docx")).toBe(true);
    });

    it("allows txt file type without binary signature check", () => {
      const textBuffer = new TextEncoder().encode("Standard agreement text").buffer;
      expect(validateFileSignature(textBuffer, "txt")).toBe(true);
    });
  });
});
