import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/protect";
import { DocumentProcessingPipeline } from "@/modules/processing";
import { contractIdSchema } from "@/lib/validation/contracts";
import { AppError } from "@/lib/errors";

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

    const result = await DocumentProcessingPipeline.processContract(
      parseResult.data.id,
      userId
    );

    if (result.status === "failed") {
      return NextResponse.json(
        { error: result.error || "Processing failed", ...result },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, ...result });
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
