import {
  DEMO_CONTRACTS,
  DEMO_REVIEWS,
  DEMO_FINDINGS,
  DEMO_CONTRACT_1_ID,
  DEMO_REVIEW_1_ID,
} from "./fixtures";
import { DEMO_USER_1 } from "./config";
import type { Contract, Review, ReviewFinding } from "@/lib/db/schema";
import type { RetrievedChunkSource } from "@/modules/chat";

export interface DemoChatSession {
  id: string;
  contractId: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface DemoChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  retrievedChunks?: RetrievedChunkSource[];
  createdAt: string;
}

export const DEMO_SESSION_1_ID = "55555555-5555-5555-5555-555555555555";

export class DemoService {
  private static contracts: Contract[] = [...DEMO_CONTRACTS];
  private static reviews: Record<string, Review> = { ...DEMO_REVIEWS };
  private static findings: Record<string, ReviewFinding[]> = { ...DEMO_FINDINGS };

  // Chat in-memory store
  private static sessions: DemoChatSession[] = [
    {
      id: DEMO_SESSION_1_ID,
      contractId: DEMO_CONTRACT_1_ID,
      userId: DEMO_USER_1.id,
      title: "Contract Q&A & Compliance",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 1800000).toISOString(),
    },
  ];

  private static messages: Record<string, DemoChatMessage[]> = {
    [DEMO_SESSION_1_ID]: [
      {
        id: "msg_demo_01",
        sessionId: DEMO_SESSION_1_ID,
        role: "assistant",
        content:
          "Welcome to IntelliBooks Contract Q&A. I have analyzed the Master Services Agreement. You can ask me any question about the clauses, governing law, termination notice periods, or liability caps.",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
  };

  // ── Contracts ──────────────────────────────────────────────────────────────

  static getContracts(userId?: string): Contract[] {
    if (!userId) return [...this.contracts];
    return this.contracts.filter((c) => c.userId === userId);
  }

  static getContractById(id: string, userId?: string): Contract | null {
    const contract = this.contracts.find((c) => c.id === id);
    if (!contract) return null;
    if (userId && contract.userId !== userId) {
      return null; // Strict tenant isolation: pretend it doesn't exist
    }
    return contract;
  }

  static addContract(params: {
    userId: string;
    filename: string;
    fileType: "pdf" | "docx" | "txt";
    fileSizeBytes: number;
  }): Contract {
    const newId = `demo_ctr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newContract: Contract = {
      id: newId,
      userId: params.userId,
      originalFilename: params.filename,
      fileType: params.fileType,
      fileSizeBytes: params.fileSizeBytes,
      storageKey: `contracts/${params.userId}/${newId}/${params.filename}`,
      blobUrl: `https://blob.vercel-storage.com/contracts/${newId}.${params.fileType}`,
      status: "ready",
      extractedText: `Uploaded agreement copy for ${params.filename}. All standard terms extracted.`,
      contentHash: `hash_${Date.now()}`,
      pageCount: Math.max(1, Math.ceil(params.fileSizeBytes / 50000)),
      metadata: { author: "Demo Upload", version: "1.0" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.contracts.unshift(newContract);
    return newContract;
  }

  static deleteContract(id: string, userId?: string): boolean {
    const initialLen = this.contracts.length;
    this.contracts = this.contracts.filter((c) => {
      if (c.id !== id) return true;
      if (userId && c.userId !== userId) return true; // Cannot delete another user's contract
      return false;
    });
    return this.contracts.length < initialLen;
  }

  // ── Reviews & Findings ────────────────────────────────────────────────────

  static getReview(
    contractId: string,
    userId?: string
  ): {
    review: Review | null;
    findings: ReviewFinding[];
  } {
    const contract = this.getContractById(contractId, userId);
    if (!contract) {
      return { review: null, findings: [] };
    }

    const review = this.reviews[contractId] || null;
    const findings = review ? this.findings[review.id] || [] : [];
    return { review, findings };
  }

  static triggerReview(
    contractId: string,
    userId: string
  ): {
    review: Review;
    findings: ReviewFinding[];
  } {
    const existing = this.getReview(contractId, userId);
    if (existing.review) {
      return { review: existing.review, findings: existing.findings };
    }

    const newReviewId = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newReview: Review = {
      id: newReviewId,
      contractId,
      contractVersionId: null,
      userId,
      modelId: "meta-llama/llama-3.3-70b-instruct:free",
      promptVersion: "v1",
      embeddingModel: "openai/text-embedding-3-small",
      overallStatus: "complete",
      contentHash: `hash_${Date.now()}`,
      rawLlmResponse: null,
      durationMs: 3100,
      createdAt: new Date(),
    };

    // Replicate default 8 findings mapped to this review ID
    const defaultFindings = (DEMO_FINDINGS[DEMO_REVIEW_1_ID] || []).map((f, i) => ({
      ...f,
      id: `fnd_${newReviewId}_${i + 1}`,
      reviewId: newReviewId,
      createdAt: new Date(),
    }));

    this.reviews[contractId] = newReview;
    this.findings[newReviewId] = defaultFindings;

    return { review: newReview, findings: defaultFindings };
  }

  // ── Chat ──────────────────────────────────────────────────────────────────

  static listSessions(contractId: string, userId: string): DemoChatSession[] {
    const contract = this.getContractById(contractId, userId);
    if (!contract) return [];
    return this.sessions.filter(
      (s) => s.contractId === contractId && s.userId === userId
    );
  }

  static createSession(
    contractId: string,
    userId: string,
    title?: string
  ): DemoChatSession {
    const newSession: DemoChatSession = {
      id: `ses_demo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      contractId,
      userId,
      title: title || "New Contract Discussion",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.sessions.unshift(newSession);
    this.messages[newSession.id] = [
      {
        id: `msg_init_${Date.now()}`,
        sessionId: newSession.id,
        role: "assistant",
        content: `Session started for this agreement. Ask any question regarding governing law, payment terms, or compliance.`,
        createdAt: new Date().toISOString(),
      },
    ];

    return newSession;
  }

  static listMessages(sessionId: string): DemoChatMessage[] {
    return this.messages[sessionId] || [];
  }

  static deleteSession(sessionId: string, userId: string): boolean {
    const session = this.sessions.find((s) => s.id === sessionId && s.userId === userId);
    if (!session) return false;
    this.sessions = this.sessions.filter((s) => s.id !== sessionId);
    delete this.messages[sessionId];
    return true;
  }

  /**
   * Generates a realistic SSE token stream for demo chat with deterministic answers.
   */
  static async sendMessageStream(params: {
    sessionId: string;
    contractId: string;
    userId: string;
    message: string;
  }): Promise<{ stream: ReadableStream }> {
    const { sessionId, contractId, userId, message } = params;

    // Verify ownership
    const contract = this.getContractById(contractId, userId);
    if (!contract) {
      throw new Error("Contract not found or access denied");
    }

    // Record user message
    const userMsgId = `msg_usr_${Date.now()}`;
    const userMsg: DemoChatMessage = {
      id: userMsgId,
      sessionId,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };

    if (!this.messages[sessionId]) {
      this.messages[sessionId] = [];
    }
    this.messages[sessionId].push(userMsg);

    // Determine deterministic intelligent response
    const lower = message.toLowerCase();

    let assistantResponse = "";
    let retrievedSources: RetrievedChunkSource[] = [];

    // Question 1 Category: Answerable questions (Governing law, termination, liability, etc.)
    if (
      lower.includes("governing law") ||
      lower.includes("jurisdiction") ||
      lower.includes("delaware") ||
      lower.includes("law")
    ) {
      assistantResponse =
        "Under Section 12.5 (Governing Law and Jurisdiction, Page 11), this Agreement is governed by and construed in accordance with the laws of the State of Delaware, without regard to conflicts of law principles. Any legal proceeding must be instituted exclusively in the state or federal courts located in New Castle County, Delaware.";
      retrievedSources = [
        {
          chunkId: "chk_demo_gov_law",
          content:
            "Section 12.5 Governing Law and Jurisdiction: This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware... exclusive jurisdiction in New Castle County, Delaware.",
          similarity: 0.98,
          pageNumber: 11,
          sectionTitle: "Section 12.5 - Governing Law",
        },
      ];
    } else if (
      lower.includes("termination") ||
      lower.includes("terminate") ||
      lower.includes("notice period") ||
      lower.includes("convenience")
    ) {
      assistantResponse =
        "Under Section 8.2 (Termination for Convenience, Page 6), either party may terminate the Agreement upon sixty (60) days prior written notice. Additionally, under Section 8.1 (Termination for Cause), a party may terminate immediately for material breach if the breaching party fails to cure within thirty (30) days of written notice.";
      retrievedSources = [
        {
          chunkId: "chk_demo_term_01",
          content:
            "Section 8.2 Termination for Convenience: Either party may terminate this Agreement for convenience upon sixty (60) days prior written notice to the other party.",
          similarity: 0.96,
          pageNumber: 6,
          sectionTitle: "Section 8.2 - Termination for Convenience",
        },
        {
          chunkId: "chk_demo_term_02",
          content:
            "Section 8.1 Termination for Cause: ...breaches any material term and fails to cure such breach within thirty (30) days of receiving written notice.",
          similarity: 0.92,
          pageNumber: 6,
          sectionTitle: "Section 8.1 - Termination for Cause",
        },
      ];
    } else if (
      lower.includes("liability") ||
      lower.includes("cap") ||
      lower.includes("damage")
    ) {
      assistantResponse =
        "Section 9.1 (Direct Damages Cap, Page 7) specifies that each party's aggregate liability is strictly capped at the total fees paid or payable in the twelve (12) months preceding the claim. Section 9.2 explicitly waives consequential, indirect, and special damages.";
      retrievedSources = [
        {
          chunkId: "chk_demo_liab",
          content:
            "IN NO EVENT SHALL EITHER PARTY'S AGGREGATE LIABILITY EXCEED THE TOTAL FEES PAID OR PAYABLE UNDER THIS AGREEMENT IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.",
          similarity: 0.99,
          pageNumber: 7,
          sectionTitle: "Section 9 - Limitation of Liability",
        },
      ];
    } else if (
      lower.includes("payment") ||
      lower.includes("invoice") ||
      lower.includes("net 30")
    ) {
      assistantResponse =
        "Section 4.3 establishes Net 30 payment terms from invoice date, with late interest accruing at 1.5% per month. Note that variable pricing rates reference Exhibit B, which was omitted from the uploaded copy.";
      retrievedSources = [
        {
          chunkId: "chk_demo_pay",
          content:
            "All invoiced amounts shall be due and payable within thirty (30) days from the invoice date. Late payments shall accrue interest at 1.5% per month...",
          similarity: 0.94,
          pageNumber: 4,
          sectionTitle: "Section 4.3 - Payment Terms",
        },
      ];
    } else if (
      // Question 2 Category: Unanswerable questions (Hardware penalties, space travel, crypto, etc.)
      lower.includes("hardware") ||
      lower.includes("physical") ||
      lower.includes("space") ||
      lower.includes("crypto") ||
      lower.includes("penalty for late delivery") ||
      lower.includes("penalties for late") ||
      lower.includes("satellite") ||
      lower.includes("vehicle")
    ) {
      assistantResponse =
        "Insufficient Information: I have thoroughly searched the document chunks, and this contract does not contain any provisions regarding physical hardware delivery, late hardware penalties, or equipment maintenance. This agreement is strictly a cloud software Master Services Agreement (MSA) and does not govern physical logistics or hardware delivery.";
      retrievedSources = [];
    } else {
      assistantResponse =
        `Based on the Master Services Agreement between CloudScale Technologies and Acme Global Enterprises: the agreement establishes cloud infrastructure services starting January 15, 2026 for a 36-month term with Delaware governing law and a 60-day notice for termination for convenience. (Responding to: "${message.slice(0, 50)}...")`;
      retrievedSources = [
        {
          chunkId: "chk_demo_gen",
          content:
            "Master Services Agreement between CloudScale Technologies, Inc. and Acme Global Enterprises, LLC.",
          similarity: 0.88,
          pageNumber: 1,
          sectionTitle: "Preamble",
        },
      ];
    }

    // Persist assistant message
    const assistantMsgId = `msg_ast_${Date.now()}`;
    const assistantMsg: DemoChatMessage = {
      id: assistantMsgId,
      sessionId,
      role: "assistant",
      content: assistantResponse,
      retrievedChunks: retrievedSources,
      createdAt: new Date().toISOString(),
    };
    this.messages[sessionId].push(assistantMsg);

    // Create ReadableStream that streams tokens via SSE matching ChatService event wire protocol
    const words = assistantResponse.split(" ");
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // 1. Emit context sources first
        if (retrievedSources.length > 0) {
          const contextPayload = `event: context\ndata: ${JSON.stringify({
            sources: retrievedSources,
            userMessageId: userMsgId,
          })}\n\n`;
          controller.enqueue(encoder.encode(contextPayload));
        }

        // 2. Stream tokens with natural typing speed
        for (let i = 0; i < words.length; i++) {
          const chunk = (i === 0 ? "" : " ") + words[i];
          const tokenPayload = `event: token\ndata: ${JSON.stringify({
            text: chunk,
            token: chunk,
          })}\n\n`;
          controller.enqueue(encoder.encode(tokenPayload));
          await new Promise((r) => setTimeout(r, 16));
        }

        // 3. Emit done event
        const donePayload = `event: done\ndata: ${JSON.stringify({
          messageId: assistantMsgId,
          content: assistantResponse,
          sources: retrievedSources,
        })}\n\n`;
        controller.enqueue(encoder.encode(donePayload));
        controller.close();
      },
    });

    return { stream };
  }
}
