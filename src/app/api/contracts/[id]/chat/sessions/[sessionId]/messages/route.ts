import { NextResponse } from "next/server";
import { requireAuth, requireContractOwnership } from "@/lib/auth/protect";
import { checkRateLimit } from "@/lib/rate-limit";
import { chatSessionParamsSchema, sendMessageSchema } from "@/lib/validation/chat";
import { ChatService } from "@/modules/chat";
import { AppError } from "@/lib/errors";
import { isDemoMode, DemoService } from "@/demo";

interface RouteProps {
  params: Promise<{ id: string; sessionId: string }>;
}

/**
 * GET /api/contracts/[id]/chat/sessions/[sessionId]/messages
 * Fetches historical messages for this chat session.
 */
export async function GET(_req: Request, { params }: RouteProps) {
  try {
    const { userId } = await requireAuth();
    const resolvedParams = await params;

    const parseParams = chatSessionParamsSchema.safeParse(resolvedParams);
    if (!parseParams.success) {
      return NextResponse.json({ error: "Invalid contract or session ID" }, { status: 400 });
    }

    const { id: contractId, sessionId } = parseParams.data;
    await requireContractOwnership(contractId, userId);

    if (isDemoMode()) {
      const messages = DemoService.listMessages(sessionId);
      return NextResponse.json({ messages });
    }

    const { messages } = await ChatService.getSession(sessionId, contractId, userId);
    return NextResponse.json({ messages });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/contracts/[id]/chat/sessions/[sessionId]/messages
 * Post a user message and receive real-time Server-Sent Events (SSE) streaming tokens.
 */
export async function POST(req: Request, { params }: RouteProps) {
  try {
    const { userId } = await requireAuth();
    const resolvedParams = await params;

    const parseParams = chatSessionParamsSchema.safeParse(resolvedParams);
    if (!parseParams.success) {
      return NextResponse.json({ error: "Invalid contract or session ID" }, { status: 400 });
    }

    const { id: contractId, sessionId } = parseParams.data;
    await requireContractOwnership(contractId, userId);

    const body = await req.json();
    const parseBody = sendMessageSchema.safeParse(body);
    if (!parseBody.success) {
      return NextResponse.json(
        { error: parseBody.error.issues[0]?.message || "Invalid message content" },
        { status: 400 }
      );
    }

    if (isDemoMode()) {
      const { stream } = await DemoService.sendMessageStream({
        sessionId,
        contractId,
        userId,
        message: parseBody.data.message,
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const rateLimit = checkRateLimit(userId, "chat");
    if (rateLimit.limited) {
      return NextResponse.json(
        {
          error: "Chat rate limit exceeded. Please wait a moment before sending another message.",
          code: "RATE_LIMITED",
        },
        { status: 429 }
      );
    }

    const { stream } = await ChatService.sendMessageStream({
      sessionId,
      contractId,
      userId,
      message: parseBody.data.message,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
