import { NextResponse } from "next/server";
import { requireAuth, requireContractOwnership } from "@/lib/auth/protect";
import { checkRateLimit } from "@/lib/rate-limit";
import { contractIdSchema } from "@/lib/validation/contracts";
import { quickChatSchema } from "@/lib/validation/chat";
import { ChatService } from "@/modules/chat";
import { AppError } from "@/lib/errors";

interface RouteProps {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/contracts/[id]/chat
 * Quick chat endpoint: attaches to existing session or automatically starts a new session,
 * returning the live SSE token stream.
 */
export async function POST(req: Request, { params }: RouteProps) {
  try {
    const { userId } = await requireAuth();
    const resolvedParams = await params;

    const parseParams = contractIdSchema.safeParse(resolvedParams);
    if (!parseParams.success) {
      return NextResponse.json({ error: "Invalid contract ID" }, { status: 400 });
    }

    const contractId = parseParams.data.id;
    await requireContractOwnership(contractId, userId);

    const body = await req.json();
    const parseBody = quickChatSchema.safeParse(body);
    if (!parseBody.success) {
      return NextResponse.json(
        { error: parseBody.error.issues[0]?.message || "Invalid message format" },
        { status: 400 }
      );
    }

    let sessionId = parseBody.data.sessionId;

    if (!sessionId) {
      // Find latest session or create one in Neon DB
      const existingSessions = await ChatService.listSessions(contractId, userId);
      if (existingSessions.length > 0) {
        sessionId = existingSessions[0].id;
      } else {
        const newSession = await ChatService.createSession({
          contractId,
          userId,
          title: parseBody.data.message.slice(0, 40),
        });
        sessionId = newSession.id;
      }
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
