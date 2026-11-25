import { NextResponse } from "next/server";
import { requireAuth, requireContractOwnership } from "@/lib/auth/protect";
import { contractIdSchema } from "@/lib/validation/contracts";
import { AppError } from "@/lib/errors";
import { start } from "workflow/api";
import { HookConflictError } from "workflow/errors";
import { contractProcessingWorkflow } from "@/modules/processing/workflows/contract-processing";

/**
 * Trigger durable document processing workflow for a contract.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const resolvedParams = await params;

    const parseResult = contractIdSchema.safeParse(resolvedParams);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid contract ID" }, { status: 400 });
    }

    const contractId = parseResult.data.id;
    const contract = await requireContractOwnership(contractId, userId);

    if (contract.status === "ready") {
      return NextResponse.json(
        {
          message: "Contract is already processed and ready",
          status: "ready",
          contractId,
        },
        { status: 200 }
      );
    }

    const hookToken = `contract-processing:${contractId}`;

    try {
      const run = await start(contractProcessingWorkflow, [{ contractId, userId }], {
        experimental_hook: { token: hookToken },
      });

      return NextResponse.json(
        {
          started: true,
          runId: run.runId,
          status: "processing",
          contractId,
        },
        { status: 202 }
      );
    } catch (startError) {
      if (HookConflictError.is(startError)) {
        return NextResponse.json(
          {
            started: false,
            runId: startError.conflictingRunId,
            status: "already_running",
            contractId,
          },
          { status: 409 }
        );
      }
      throw startError;
    }
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
