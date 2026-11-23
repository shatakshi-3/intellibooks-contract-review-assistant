import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/protect";
import { ContractsService } from "@/modules/contracts";
import { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES } from "@/lib/validation/contracts";
import { logger } from "@/lib/logger";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // 1. Authenticate user strictly on server
        const { userId } = await requireAuth();

        if (!clientPayload) {
          throw new Error("Missing client payload for upload authorization");
        }

        let parsed: {
          contractId?: string;
          filename?: string;
          fileSize?: number;
          contentType?: string;
        };

        try {
          parsed = JSON.parse(clientPayload);
        } catch {
          throw new Error("Invalid client payload JSON");
        }

        const { contractId, filename, fileSize, contentType } = parsed;

        if (!contractId || !filename || !contentType) {
          throw new Error("Missing required upload parameters in client payload");
        }

        // 2. Enforce contract ownership and existence
        const contract = await ContractsService.getContractById(contractId, userId);

        if (contract.status !== "pending_upload" && contract.status !== "uploading") {
          throw new Error(`Contract is not awaiting upload (current status: ${contract.status})`);
        }

        // 3. Enforce size and type constraints
        if (fileSize && fileSize > MAX_FILE_SIZE_BYTES) {
          throw new Error("File exceeds maximum allowed size of 20 MB");
        }

        if (!ALLOWED_MIME_TYPES.includes(contentType as (typeof ALLOWED_MIME_TYPES)[number])) {
          throw new Error(`Disallowed content type: ${contentType}`);
        }

        logger.info("Issuing private Vercel Blob client upload token", {
          contractId,
          userId,
          filename,
          pathname,
        });

        // 4. Return authorized token payload with strict 20 MB cap and allowed types
        return {
          allowedContentTypes: [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
          ],
          maximumSizeInBytes: MAX_FILE_SIZE_BYTES,
          tokenPayload: JSON.stringify({
            contractId,
            userId,
            filename,
            contentType,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) {
          logger.error("Vercel Blob upload callback missing tokenPayload");
          throw new Error("Missing token payload in upload callback");
        }

        const { contractId, userId, contentType } = JSON.parse(tokenPayload);

        logger.info("Vercel Blob upload completed callback received", {
          contractId,
          userId,
          blobUrl: blob.url,
          pathname: blob.pathname,
        });

        // Verify and idempotently mark uploaded
        await ContractsService.verifyAndCompleteUpload({
          contractId,
          userId,
          blobUrl: blob.url,
          storageKey: blob.pathname,
          contentType,
        });
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload authorization failed";
    logger.warn("Upload authorization failed", { error: message });

    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
