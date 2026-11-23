import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/protect";
import { ContractsService } from "@/modules/contracts";
import { createContractSchema, listContractsSchema } from "@/lib/validation/contracts";
import { AppError } from "@/lib/errors";
import { isDemoMode, DemoService } from "@/demo";

export async function POST(req: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await req.json();

    const parseResult = createContractSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    if (isDemoMode()) {
      const contract = DemoService.addContract({
        userId,
        filename: parseResult.data.filename,
        fileType: parseResult.data.fileType,
        fileSizeBytes: parseResult.data.fileSize,
      });
      return NextResponse.json({ contract }, { status: 201 });
    }

    const contract = await ContractsService.createPendingContract({
      userId,
      ...parseResult.data,
    });

    return NextResponse.json({ contract }, { status: 201 });
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

export async function GET(req: Request) {
  try {
    const { userId } = await requireAuth();
    const { searchParams } = new URL(req.url);

    const queryObj = {
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      sortBy: searchParams.get("sortBy") ?? undefined,
      sortOrder: searchParams.get("sortOrder") ?? undefined,
    };

    const parseResult = listContractsSchema.safeParse(queryObj);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    if (isDemoMode()) {
      // Strictly scoped to authenticated user in Demo Mode
      const demoContracts = DemoService.getContracts(userId);
      return NextResponse.json({
        data: demoContracts,
        pagination: {
          page: 1,
          limit: 20,
          total: demoContracts.length,
          totalPages: Math.max(1, Math.ceil(demoContracts.length / 20)),
        },
      });
    }

    const result = await ContractsService.listContracts(userId, parseResult.data);
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
