/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatService } from "@/modules/chat";

// Mock @/lib/auth/protect
vi.mock("@/lib/auth/protect", () => ({
  requireContractOwnership: vi.fn(),
  requireAuth: vi.fn(),
}));

// Mock @/lib/db
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock @/modules/retrieval
vi.mock("@/modules/retrieval", () => ({
  RetrievalService: {
    searchSimilarChunks: vi.fn(),
  },
}));

// Mock @/ai
vi.mock("@/ai", () => ({
  getAIProvider: vi.fn(),
  getAIConfig: vi.fn().mockReturnValue({
    chatModel: "google/gemini-2.5-flash",
    reviewModel: "google/gemini-2.5-flash",
    embeddingModel: "openai/text-embedding-3-small",
    embeddingDimensions: 1536,
    promptVersion: "v1",
  }),
}));

import { requireContractOwnership } from "@/lib/auth/protect";
import { db } from "@/lib/db";
import { RetrievalService } from "@/modules/retrieval";
import { getAIProvider } from "@/ai";

describe("ChatService Unit Tests", () => {
  const contractId = "123e4567-e89b-12d3-a456-426614174000";
  const userId = "usr_00000000-0000-0000-0000-000000000001";
  const sessionId = "123e4567-e89b-12d3-a456-426614174099";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createSession", () => {
    it("verifies contract ownership and inserts new session", async () => {
      vi.mocked(requireContractOwnership).mockResolvedValue({
        id: contractId,
        userId,
        status: "ready",
      } as any);

      const mockSession = {
        id: sessionId,
        contractId,
        userId,
        title: "Test Discussion",
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSession]),
        }),
      } as any);

      const result = await ChatService.createSession({
        contractId,
        userId,
        title: "Test Discussion",
      });

      expect(requireContractOwnership).toHaveBeenCalledWith(contractId, userId);
      expect(result).toEqual(mockSession);
    });
  });

  describe("listSessions", () => {
    it("returns all user sessions for the contract ordered by updatedAt desc", async () => {
      vi.mocked(requireContractOwnership).mockResolvedValue({
        id: contractId,
        userId,
      } as any);

      const mockSessions = [
        { id: "s1", title: "Chat 1", updatedAt: new Date() },
        { id: "s2", title: "Chat 2", updatedAt: new Date() },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockSessions),
          }),
        }),
      } as any);

      const result = await ChatService.listSessions(contractId, userId);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("s1");
    });
  });

  describe("getSession", () => {
    it("throws notFound if session does not exist", async () => {
      vi.mocked(requireContractOwnership).mockResolvedValue({ id: contractId, userId } as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      await expect(ChatService.getSession(sessionId, contractId, userId)).rejects.toThrow(
        "Chat session not found"
      );
    });

    it("returns session and messages in chronological order", async () => {
      vi.mocked(requireContractOwnership).mockResolvedValue({ id: contractId, userId } as any);

      const mockSession = { id: sessionId, title: "Chat 1" };
      const mockMessages = [
        { id: "m1", role: "user", content: "Hello" },
        { id: "m2", role: "assistant", content: "Hi" },
      ];

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockSession]),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockMessages),
            }),
          }),
        } as any);

      const result = await ChatService.getSession(sessionId, contractId, userId);
      expect(result.session.id).toBe(sessionId);
      expect(result.messages).toHaveLength(2);
    });
  });

  describe("deleteSession", () => {
    it("deletes session if owned by user", async () => {
      vi.mocked(requireContractOwnership).mockResolvedValue({ id: contractId, userId } as any);

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: sessionId }]),
        }),
      } as any);

      const result = await ChatService.deleteSession(sessionId, contractId, userId);
      expect(result.success).toBe(true);
    });

    it("throws notFound if session does not exist to delete", async () => {
      vi.mocked(requireContractOwnership).mockResolvedValue({ id: contractId, userId } as any);

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      await expect(ChatService.deleteSession(sessionId, contractId, userId)).rejects.toThrow(
        "Chat session not found"
      );
    });
  });

  describe("sendMessageStream", () => {
    it("validates empty message", async () => {
      vi.mocked(requireContractOwnership).mockResolvedValue({ id: contractId, userId } as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: sessionId }]),
          }),
        }),
      } as any);

      await expect(
        ChatService.sendMessageStream({
          sessionId,
          contractId,
          userId,
          message: "   ",
        })
      ).rejects.toThrow("Message content cannot be empty");
    });

    it("performs RAG retrieval and streams SSE tokens cleanly", async () => {
      vi.mocked(requireContractOwnership).mockResolvedValue({
        id: contractId,
        userId,
        originalFilename: "consulting_agreement.pdf",
      } as any);

      // Session lookup
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: sessionId, title: "New Chat", contractId, userId },
            ]),
          }),
        }),
      } as any);

      // User message insert
      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { id: "usr-msg-1", sessionId, role: "user", content: "What is the term?" },
          ]),
        }),
      } as any);

      // Session update
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      } as any);

      // RAG Retrieval mock
      vi.mocked(RetrievalService.searchSimilarChunks).mockResolvedValue([
        {
          id: "chunk-10",
          chunkIndex: 10,
          content: "The term of this agreement is twelve (12) months starting Jan 1, 2025.",
          pageNumber: 2,
          sectionTitle: "Term & Duration",
          startCharOffset: 1200,
          endCharOffset: 1280,
          similarity: 0.88,
        },
      ]);

      // Past messages query
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      // Stream text async generator mock
      async function* mockStream() {
        yield "The ";
        yield "term ";
        yield "is ";
        yield "12 months.";
      }

      vi.mocked(getAIProvider).mockReturnValue({
        streamText: vi.fn().mockReturnValue(mockStream()),
      } as any);

      // Assistant message insert
      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "asst-msg-1",
              sessionId,
              role: "assistant",
              content: "The term is 12 months.",
            },
          ]),
        }),
      } as any);

      const result = await ChatService.sendMessageStream({
        sessionId,
        contractId,
        userId,
        message: "What is the term?",
      });

      expect(result.stream).toBeDefined();
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].sectionTitle).toBe("Term & Duration");

      // Read all SSE chunks from the stream
      const reader = result.stream.getReader();
      const decoder = new TextDecoder();
      let streamOutput = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        streamOutput += decoder.decode(value, { stream: true });
      }

      expect(streamOutput).toContain("event: context");
      expect(streamOutput).toContain("Term & Duration");
      expect(streamOutput).toContain("event: token");
      expect(streamOutput).toContain("12 months.");
      expect(streamOutput).toContain("event: done");
    });
  });
});
