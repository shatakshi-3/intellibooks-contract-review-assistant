import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/protect";
import { ContractsService } from "@/modules/contracts";
import { contractIdSchema } from "@/lib/validation/contracts";
import { AppError } from "@/lib/errors";
import { isDemoMode, DemoService } from "@/demo";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const resolvedParams = await params;

    const parseResult = contractIdSchema.safeParse(resolvedParams);
    if (!parseResult.success) {
      if (isDemoMode()) {
        const demoContract = DemoService.getContractById(resolvedParams.id, userId);
        if (demoContract) {
          return NextResponse.json({ contract: demoContract });
        }
        return NextResponse.json({ error: "Contract not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Invalid contract ID" }, { status: 400 });
    }

    if (isDemoMode()) {
      const demoContract = DemoService.getContractById(parseResult.data.id, userId);
      if (demoContract) {
        return NextResponse.json({ contract: demoContract });
      }
      // Strict multi-tenant isolation: 404 if belongs to another user or does not exist
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    const contract = await ContractsService.getContractById(parseResult.data.id, userId);
    return NextResponse.json({ contract });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    if (isDemoMode()) {
      const deleted = DemoService.deleteContract(parseResult.data.id, userId);
      if (!deleted) {
        return NextResponse.json({ error: "Contract not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: "Contract deleted successfully" });
    }

    const result = await ContractsService.deleteContract(parseResult.data.id, userId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
