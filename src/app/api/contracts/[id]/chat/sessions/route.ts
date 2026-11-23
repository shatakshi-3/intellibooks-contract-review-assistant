import { NextResponse } from "next/server";
import { requireAuth, requireContractOwnership } from "@/lib/auth/protect";
import { contractIdSchema } from "@/lib/validation/contracts";
import { createSessionSchema } from "@/lib/validation/chat";
import { ChatService } from "@/modules/chat";
import { AppError } from "@/lib/errors";
import { isDemoMode } from "@/demo";

interface RouteProps {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/contracts/[id]/chat/sessions
 * List all chat sessions for this contract and authenticated user.
 */
export async function GET(_req: Request, { params }: RouteProps) {
  try {
    const { userId } = await requireAuth();
    const resolvedParams = await params;

    const parseResult = contractIdSchema.safeParse(resolvedParams);
    if (!parseResult.success) {
      if (isDemoMode()) {
        return NextResponse.json({
          sessions: [
            {
              id: "ses_demo_01",
              contractId: resolvedParams.id,
              userId,
              title: "General Inquiries",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        });
      }
      return NextResponse.json({ error: "Invalid contract ID" }, { status: 400 });
    }

    const contractId = parseResult.data.id;
    await requireContractOwnership(contractId, userId);

    if (isDemoMode()) {
      try {
        const sessions = await ChatService.listSessions(contractId, userId);
        return NextResponse.json({ sessions });
      } catch {
        return NextResponse.json({
          sessions: [
            {
              id: "ses_demo_01",
              contractId,
              userId,
              title: "General Inquiries",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        });
      }
    }

    const sessions = await ChatService.listSessions(contractId, userId);
    return NextResponse.json({ sessions });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/contracts/[id]/chat/sessions
 * Create a new chat session for this contract.
 */
export async function POST(req: Request, { params }: RouteProps) {
  try {
    const { userId } = await requireAuth();
    const resolvedParams = await params;

    const parseResult = contractIdSchema.safeParse(resolvedParams);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid contract ID" }, { status: 400 });
    }

    const contractId = parseResult.data.id;
    await requireContractOwnership(contractId, userId);

    let title: string | undefined;
    try {
      const body = await req.json();
      const parsedBody = createSessionSchema.safeParse(body);
      if (parsedBody.success) {
        title = parsedBody.data.title;
      }
    } catch {
      // Body is optional
    }

    const session = await ChatService.createSession({
      contractId,
      userId,
      title,
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
