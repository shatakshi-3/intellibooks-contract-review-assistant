/**
 * Zod validation schemas for contract operations.
 *
 * These validate all API inputs — never trust client data.
 */

import { z } from "zod";

// Allowed file types and their MIME types
export const ALLOWED_FILE_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
} as const;

export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED_FILE_TYPES);
export const ALLOWED_MIME_TYPES = Object.values(ALLOWED_FILE_TYPES);

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * File magic bytes for content signature validation.
 * Prevents disguised file uploads.
 */
export const FILE_SIGNATURES: Record<string, number[]> = {
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  docx: [0x50, 0x4b, 0x03, 0x04], // PK (ZIP)
  // TXT has no specific signature — validated by MIME and content
};

// Schema for contract creation request
export const createContractSchema = z.object({
  filename: z
    .string()
    .min(1, "Filename is required")
    .max(255, "Filename too long")
    .refine(
      (name) => {
        const ext = name.split(".").pop()?.toLowerCase();
        return ext && ALLOWED_EXTENSIONS.includes(ext);
      },
      { message: `Allowed file types: ${ALLOWED_EXTENSIONS.join(", ")}` }
    ),
  fileSize: z
    .number()
    .int()
    .positive("File size must be positive")
    .max(MAX_FILE_SIZE_BYTES, `File exceeds maximum size of 20 MB`),
  fileType: z.enum(["pdf", "docx", "txt"]),
  contentType: z
    .string()
    .refine(
      (type) => ALLOWED_MIME_TYPES.includes(type as (typeof ALLOWED_MIME_TYPES)[number]),
      { message: "Invalid content type" }
    ),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;

// Schema for contract listing query parameters
export const listContractsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  status: z
    .enum([
      "pending_upload",
      "uploading",
      "uploaded",
      "processing",
      "extracting",
      "chunking",
      "embedding",
      "ready",
      "failed",
    ])
    .optional(),
  sortBy: z.enum(["created_at", "original_filename", "status"]).default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type ListContractsInput = z.infer<typeof listContractsSchema>;

// Schema for contract ID parameter
export const contractIdSchema = z.object({
  id: z.string().uuid("Invalid contract ID"),
});

/**
 * Validate file extension from filename.
 */
export function getFileType(filename: string): "pdf" | "docx" | "txt" | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext && ALLOWED_EXTENSIONS.includes(ext)) {
    return ext as "pdf" | "docx" | "txt";
  }
  return null;
}

/**
 * Validate file magic bytes match the declared type.
 */
export function validateFileSignature(
  buffer: ArrayBuffer,
  fileType: string
): boolean {
  const signature = FILE_SIGNATURES[fileType];
  if (!signature) {
    // TXT files have no specific signature — allow
    return fileType === "txt";
  }

  const bytes = new Uint8Array(buffer).slice(0, signature.length);
  return signature.every((byte, i) => bytes[i] === byte);
}
