/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as listSessionsGET, POST as createSessionPOST } from "@/app/api/contracts/[id]/chat/sessions/route";
import { GET as getSessionGET, DELETE as deleteSessionDELETE } from "@/app/api/contracts/[id]/chat/sessions/[sessionId]/route";
import { POST as postMessagePOST } from "@/app/api/contracts/[id]/chat/sessions/[sessionId]/messages/route";
import { POST as quickChatPOST } from "@/app/api/contracts/[id]/chat/route";

// Mock @/lib/auth/protect
vi.mock("@/lib/auth/protect", () => ({
  requireAuth: vi.fn(),
  requireContractOwnership: vi.fn(),
}));

// Mock @/modules/chat
vi.mock("@/modules/chat", () => ({
  ChatService: {
    listSessions: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn(),
    deleteSession: vi.fn(),
    sendMessageStream: vi.fn(),
  },
}));

import { requireAuth, requireContractOwnership } from "@/lib/auth/protect";
import { ChatService } from "@/modules/chat";
import { AppError } from "@/lib/errors";

describe("Chat API Route Handlers Integration & Tenant Isolation Tests", () => {
  const userId = "usr_00000000-0000-0000-0000-000000000001";
  const contractId = "123e4567-e89b-12d3-a456-426614174000";
  const sessionId = "123e4567-e89b-12d3-a456-426614174099";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/contracts/[id]/chat/sessions", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(requireAuth).mockRejectedValue(AppError.unauthorized());

      const res = await listSessionsGET(new Request("http://localhost"), {
        params: Promise.resolve({ id: contractId }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Authentication required");
    });

    it("returns 404 when user A attempts to list sessions for user B's contract", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireContractOwnership).mockRejectedValue(
        AppError.notFound("Contract not found")
      );

      const res = await listSessionsGET(new Request("http://localhost"), {
        params: Promise.resolve({ id: contractId }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Contract not found");
    });

    it("returns 200 with sessions list for owned contract", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireContractOwnership).mockResolvedValue({ id: contractId, userId } as any);
      vi.mocked(ChatService.listSessions).mockResolvedValue([
        { id: sessionId, contractId, userId, title: "Session 1" },
      ] as any);

      const res = await listSessionsGET(new Request("http://localhost"), {
        params: Promise.resolve({ id: contractId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.sessions).toHaveLength(1);
      expect(json.sessions[0].title).toBe("Session 1");
    });
  });

  describe("POST /api/contracts/[id]/chat/sessions", () => {
    it("returns 404 when user A attempts to create a session on user B's contract", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireContractOwnership).mockRejectedValue(
        AppError.notFound("Contract not found")
      );

      const req = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "My Session" }),
      });

      const res = await createSessionPOST(req, {
        params: Promise.resolve({ id: contractId }),
      });

      expect(res.status).toBe(404);
    });

    it("creates session and returns 201 Created", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireContractOwnership).mockResolvedValue({ id: contractId, userId } as any);
      vi.mocked(ChatService.createSession).mockResolvedValue({
        id: sessionId,
        contractId,
        userId,
        title: "My Session",
      } as any);

      const req = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "My Session" }),
      });

      const res = await createSessionPOST(req, {
        params: Promise.resolve({ id: contractId }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.session.id).toBe(sessionId);
    });
  });

  describe("GET /api/contracts/[id]/chat/sessions/[sessionId]", () => {
    it("returns 404 when cross-tenant user accesses another user's session", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireContractOwnership).mockResolvedValue({ id: contractId, userId } as any);
      vi.mocked(ChatService.getSession).mockRejectedValue(
        AppError.notFound("Chat session not found")
      );

      const res = await getSessionGET(new Request("http://localhost"), {
        params: Promise.resolve({ id: contractId, sessionId }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Chat session not found");
    });

    it("returns 200 with session and message history", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireContractOwnership).mockResolvedValue({ id: contractId, userId } as any);
      vi.mocked(ChatService.getSession).mockResolvedValue({
        session: { id: sessionId, title: "Chat" },
        messages: [{ id: "m1", role: "user", content: "Hi" }],
      } as any);

      const res = await getSessionGET(new Request("http://localhost"), {
        params: Promise.resolve({ id: contractId, sessionId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.session.id).toBe(sessionId);
      expect(json.messages).toHaveLength(1);
    });
  });

  describe("DELETE /api/contracts/[id]/chat/sessions/[sessionId]", () => {
    it("returns 200 on successful deletion", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireContractOwnership).mockResolvedValue({ id: contractId, userId } as any);
      vi.mocked(ChatService.deleteSession).mockResolvedValue({ success: true } as any);

      const res = await deleteSessionDELETE(new Request("http://localhost"), {
        params: Promise.resolve({ id: contractId, sessionId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe("POST /api/contracts/[id]/chat/sessions/[sessionId]/messages", () => {
    it("returns 400 for empty message payload", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireContractOwnership).mockResolvedValue({ id: contractId, userId } as any);

      const req = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "" }),
      });

      const res = await postMessagePOST(req, {
        params: Promise.resolve({ id: contractId, sessionId }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("cannot be empty");
    });

    it("returns text/event-stream Response with SSE headers", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireContractOwnership).mockResolvedValue({ id: contractId, userId } as any);

      const mockReadableStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("event: token\ndata: {\"text\":\"Hello\"}\n\n"));
          controller.close();
        },
      });

      vi.mocked(ChatService.sendMessageStream).mockResolvedValue({
        stream: mockReadableStream,
      } as any);

      const req = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "What is this contract about?" }),
      });

      const res = await postMessagePOST(req, {
        params: Promise.resolve({ id: contractId, sessionId }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    });
  });

  describe("POST /api/contracts/[id]/chat (Quick Chat)", () => {
    it("automatically creates or reuses active session and streams response", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireContractOwnership).mockResolvedValue({ id: contractId, userId } as any);
      vi.mocked(ChatService.listSessions).mockResolvedValue([]);
      vi.mocked(ChatService.createSession).mockResolvedValue({ id: sessionId } as any);

      const mockReadableStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("event: token\ndata: {\"text\":\"Answer\"}\n\n"));
          controller.close();
        },
      });

      vi.mocked(ChatService.sendMessageStream).mockResolvedValue({
        stream: mockReadableStream,
      } as any);

      const req = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Summarize this contract" }),
      });

      const res = await quickChatPOST(req, {
        params: Promise.resolve({ id: contractId }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/event-stream");
      expect(ChatService.createSession).toHaveBeenCalled();
      expect(ChatService.sendMessageStream).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          contractId,
          userId,
          message: "Summarize this contract",
        })
      );
    });
  });
});
