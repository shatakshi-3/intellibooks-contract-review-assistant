import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/protect";
import { checkRateLimit } from "@/lib/rate-limit";
import { ContractsService } from "@/modules/contracts";
import { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES } from "@/lib/validation/contracts";
import { logger } from "@/lib/logger";
import { start } from "workflow/api";
import { HookConflictError } from "workflow/errors";
import { contractProcessingWorkflow } from "@/modules/processing/workflows/contract-processing";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // 1. Authenticate user strictly on server
        const { userId } = await requireAuth();

        const rateLimitResult = checkRateLimit(userId, "upload");
        if (rateLimitResult.limited) {
          throw new Error("Rate limit exceeded for document uploads. Please wait before uploading again.");
        }

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

        // 4. Return authorized token payload with strict 20 MB cap, allowed types, and random suffix to prevent collisions
        return {
          allowedContentTypes: [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
          ],
          maximumSizeInBytes: MAX_FILE_SIZE_BYTES,
          addRandomSuffix: true,
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

        // Dispatch durable document processing workflow
        const hookToken = `contract-processing:${contractId}`;
        try {
          await start(contractProcessingWorkflow, [{ contractId, userId }], {
            experimental_hook: { token: hookToken },
          });
          logger.info("Triggered durable contract processing workflow from onUploadCompleted", {
            contractId,
            userId,
          });
        } catch (wfErr) {
          if (HookConflictError.is(wfErr)) {
            logger.info("Workflow already in progress for contract (idempotent hook conflict)", {
              contractId,
            });
          } else {
            logger.error("Failed to start workflow from onUploadCompleted", {
              contractId,
              error: wfErr instanceof Error ? wfErr.message : String(wfErr),
            });
          }
        }
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
