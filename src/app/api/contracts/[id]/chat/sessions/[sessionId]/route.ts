import { NextResponse } from "next/server";
import { requireAuth, requireContractOwnership } from "@/lib/auth/protect";
import { chatSessionParamsSchema } from "@/lib/validation/chat";
import { ChatService } from "@/modules/chat";
import { AppError } from "@/lib/errors";
import { isDemoMode, DemoService } from "@/demo";

interface RouteProps {
  params: Promise<{ id: string; sessionId: string }>;
}

/**
 * GET /api/contracts/[id]/chat/sessions/[sessionId]
 * Retrieve session details along with all messages in chronological order.
 */
export async function GET(_req: Request, { params }: RouteProps) {
  try {
    const { userId } = await requireAuth();
    const resolvedParams = await params;

    const parseResult = chatSessionParamsSchema.safeParse(resolvedParams);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid contract or session ID" }, { status: 400 });
    }

    const { id: contractId, sessionId } = parseResult.data;
    await requireContractOwnership(contractId, userId);

    const data = await ChatService.getSession(sessionId, contractId, userId);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/contracts/[id]/chat/sessions/[sessionId]
 * Delete a chat session and its messages.
 */
export async function DELETE(_req: Request, { params }: RouteProps) {
  try {
    const { userId } = await requireAuth();
    const resolvedParams = await params;

    const parseResult = chatSessionParamsSchema.safeParse(resolvedParams);
    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid contract or session ID" }, { status: 400 });
    }

    const { id: contractId, sessionId } = parseResult.data;
    await requireContractOwnership(contractId, userId);

    const result = await ChatService.deleteSession(sessionId, contractId, userId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
