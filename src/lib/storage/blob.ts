/**
 * Private Vercel Blob storage integration.
 *
 * Handles file operations for uploaded contract documents.
 * All files are stored under private access: tokens and URLs
 * are time-limited or authenticated.
 */

import { del, head } from "@vercel/blob";
import { logger } from "@/lib/logger";

/**
 * Safely delete an object from Vercel Blob storage.
 * If deletion fails (e.g., file not found, token issues), it logs a warning
 * rather than throwing, preventing cascaded database rollback.
 */
export async function safeDeleteBlob(urlOrKey: string | null | undefined): Promise<boolean> {
  if (!urlOrKey) {
    return true;
  }

  try {
    await del(urlOrKey);
    logger.info("Successfully deleted blob object", { urlOrKey });
    return true;
  } catch (error) {
    logger.warn("Failed to delete blob object (may already be deleted or unreachable)", {
      urlOrKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Verify whether a blob object exists and retrieve its metadata.
 */
export async function getBlobMetadata(urlOrKey: string) {
  try {
    return await head(urlOrKey);
  } catch (error) {
    logger.warn("Could not retrieve blob metadata", {
      urlOrKey,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Download a private blob buffer using authenticated storage credentials.
 */
export async function downloadBlobBuffer(blobUrl: string): Promise<Buffer> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(blobUrl, { headers });
  if (!response.ok) {
    throw new Error(
      `Failed to download document from private storage: ${response.status} ${response.statusText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
