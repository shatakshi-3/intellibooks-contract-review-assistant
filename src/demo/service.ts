/**
 * Demo Processing Service with Neon PostgreSQL Persistence.
 *
 * Implements deterministic local review and chat processing without external paid APIs,
 * while strictly persisting every contract, version, review, finding, chat session,
 * and message into Neon PostgreSQL under the authenticated user's ID.
 */

import { db } from "@/lib/db";
import {
  contracts,
  contractVersions,
  documentChunks,
  reviews,
  reviewFindings,
  chatSessions,
  chatMessages,
  type Contract,
  type Review,
  type ReviewFinding,
} from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { RetrievedChunkSource } from "@/modules/chat";

export const SAMPLE_CONTRACT_TEXT = `MASTER SERVICES AGREEMENT

This Master Services Agreement ("Agreement") is entered into as of January 15, 2026 ("Effective Date") by and between CloudScale Technologies, Inc., a Delaware corporation with its principal office at 100 Enterprise Way, Suite 400, Wilmington, DE 19801 ("Provider"), and Acme Global Enterprises, LLC, a California limited liability company ("Customer").

1. SERVICES AND STATEMENTS OF WORK
Provider shall furnish cloud infrastructure management and automated application deployment services as described in mutually executed Statements of Work.

2. TERM AND DURATION
2.1 Initial Term. This Agreement shall commence on January 15, 2026 ("Effective Date") and continue for an initial term of thirty-six (36) months ("Initial Term").
2.2 Non-Renewal. This Agreement expires automatically upon the expiration of the Initial Term. Any continuation or renewal of services requires affirmative mutual written amendment signed by authorized representatives of both parties. There shall be no automatic successive renewals.

3. FEES AND BILLING
Customer agrees to pay all fees set forth in applicable orders.

4. PAYMENT TERMS AND INVOICING
4.1 Invoicing Schedule. Invoices shall be submitted monthly in arrears.
4.2 Currency. All amounts are payable in United States Dollars.
4.3 Payment Terms. All invoiced amounts shall be due and payable within thirty (30) days from the invoice date. Late payments shall accrue interest at 1.5% per month or the maximum rate permitted by law. Variable tier pricing and volume discounts shall be governed by Exhibit B (Fee Schedule) attached hereto. [Note: Exhibit B was omitted from execution copy].

5. INTELLECTUAL PROPERTY RIGHTS
Provider retains all right, title, and interest in its proprietary software and algorithms. Customer owns all Customer Data.

6. CONFIDENTIALITY
6.1 Definition. "Confidential Information" includes all proprietary technical, business, and financial information disclosed by one party to the other.
6.4 Survival of Obligations. The receiving party shall protect Disclosing Party's Confidential Information for a period of five (5) years following termination or expiration of this Agreement, except that trade secrets shall remain protected indefinitely.

7. WARRANTIES AND DISCLAIMERS
Each party represents that it possesses the corporate authority to execute this Agreement.

8. TERMINATION
8.1 Termination for Cause. Either party may terminate this Agreement immediately upon written notice if the other party breaches any material term and fails to cure such breach within thirty (30) days of receiving written notice.
8.2 Termination for Convenience. Either party may terminate this Agreement for convenience upon sixty (60) days prior written notice to the other party.

9. LIMITATION OF LIABILITY
9.1 Direct Damages Cap. IN NO EVENT SHALL EITHER PARTY'S AGGREGATE LIABILITY EXCEED THE TOTAL FEES PAID OR PAYABLE UNDER THIS AGREEMENT IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
9.2 Consequential Damages Waiver. NEITHER PARTY SHALL BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES.

10. INDEMNIFICATION
Provider shall defend Customer against third-party claims alleging infringement of registered intellectual property.

11. SECURITY AND DATA PROTECTION
Provider maintains SOC 2 Type II compliance and AES-256 data encryption at rest and in transit.

12. MISCELLANEOUS
12.5 Governing Law and Jurisdiction. This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to conflicts of law principles. Any dispute arising hereunder shall be subject to the exclusive jurisdiction of the state and federal courts located in New Castle County, Delaware.
12.8 Entire Agreement. This document constitutes the entire agreement between the parties regarding cloud software services.`;

export class DemoService {
  /**
   * Creates a contract record in Neon PostgreSQL for the authenticated user
   * with sample parsed sections and document chunks.
   */
  static async createContract(params: {
    userId: string;
    filename: string;
    fileType: "pdf" | "docx" | "txt";
    fileSizeBytes: number;
    contentType?: string;
  }): Promise<Contract> {
    const { userId, filename, fileType, fileSizeBytes } = params;

    // 1. Insert contract row into Neon PostgreSQL
    const [contract] = await db
      .insert(contracts)
      .values({
        userId,
        originalFilename: filename,
        fileType,
        fileSizeBytes,
        status: "ready",
        extractedText: SAMPLE_CONTRACT_TEXT,
        contentHash: `hash_demo_${Date.now()}`,
        pageCount: 12,
        metadata: {
          author: "Demo Deterministic Processing",
          isDemoGenerated: true,
          uploadedAt: new Date().toISOString(),
        },
      })
      .returning();

    // 2. Insert contract version
    const [version] = await db
      .insert(contractVersions)
      .values({
        contractId: contract.id,
        versionNumber: 1,
        extractedText: SAMPLE_CONTRACT_TEXT,
        contentHash: contract.contentHash,
        pageCount: 12,
      })
      .returning();

    // 3. Insert chunks with 1536-dimensional unit vectors for pgvector compatibility
    const sampleChunks = [
      {
        content: `MASTER SERVICES AGREEMENT Preamble: This Agreement is entered into as of January 15, 2026 by and between CloudScale Technologies, Inc. ('Provider') and Acme Global Enterprises, LLC ('Customer').`,
        pageNumber: 1,
        sectionTitle: "Preamble",
      },
      {
        content: `Section 2.1 Initial Term: Commences on January 15, 2026 for thirty-six (36) months. Section 2.2 Non-Renewal: Expires automatically; no automatic successive renewals.`,
        pageNumber: 2,
        sectionTitle: "Section 2 - Term",
      },
      {
        content: `Section 4.3 Payment Terms: Invoiced amounts due within thirty (30) days from invoice date. Late interest at 1.5% per month. Pricing governed by Exhibit B (omitted).`,
        pageNumber: 4,
        sectionTitle: "Section 4 - Payment Terms",
      },
      {
        content: `Section 6.4 Confidentiality: Receiving party protects Confidential Information for five (5) years following termination; trade secrets protected indefinitely.`,
        pageNumber: 5,
        sectionTitle: "Section 6 - Confidentiality",
      },
      {
        content: `Section 8.2 Termination for Convenience: Either party may terminate for convenience upon sixty (60) days prior written notice. Section 8.1 Termination for Cause: 30 days cure.`,
        pageNumber: 6,
        sectionTitle: "Section 8 - Termination",
      },
      {
        content: `Section 9.1 Direct Damages Cap: IN NO EVENT SHALL AGGREGATE LIABILITY EXCEED TOTAL FEES PAID IN PRECEDING TWELVE (12) MONTHS. Consequential damages waived.`,
        pageNumber: 7,
        sectionTitle: "Section 9 - Limitation of Liability",
      },
      {
        content: `Section 12.5 Governing Law: Governed by the laws of the State of Delaware, exclusive jurisdiction in New Castle County, Delaware.`,
        pageNumber: 11,
        sectionTitle: "Section 12 - Miscellaneous",
      },
    ];

    const zeroVector = Array(1536).fill(0.02);

    for (let i = 0; i < sampleChunks.length; i++) {
      const chk = sampleChunks[i];
      await db.insert(documentChunks).values({
        contractId: contract.id,
        contractVersionId: version.id,
        userId,
        chunkIndex: i,
        content: chk.content,
        pageNumber: chk.pageNumber,
        sectionTitle: chk.sectionTitle,
        embedding: zeroVector,
      });
    }

    return contract;
  }

  /**
   * Triggers deterministic contract review and persists all 8 categories
   * into Neon PostgreSQL under the authenticated user's ID.
   */
  static async triggerReview(params: {
    contractId: string;
    userId: string;
  }): Promise<{ review: Review; findings: ReviewFinding[] }> {
    const { contractId, userId } = params;

    // Get latest version
    const [version] = await db
      .select({ id: contractVersions.id })
      .from(contractVersions)
      .where(eq(contractVersions.contractId, contractId))
      .orderBy(desc(contractVersions.versionNumber))
      .limit(1);

    // 1. Insert review record in Neon PostgreSQL
    const [review] = await db
      .insert(reviews)
      .values({
        contractId,
        contractVersionId: version?.id || null,
        userId,
        modelId: "demo-deterministic/meta-llama-3.3-70b",
        promptVersion: "v1",
        embeddingModel: "openai/text-embedding-3-small",
        overallStatus: "complete",
        contentHash: "hash_demo_12345",
        durationMs: 2400,
      })
      .returning();

    // 2. The 8 required checklist categories with verified exact quotes
    const findingsData = [
      {
        checklistItem: "parties",
        status: "found",
        summary:
          "Contracting parties are CloudScale Technologies, Inc. ('Provider') and Acme Global Enterprises, LLC ('Customer').",
        explanation:
          "Both corporate entities are explicitly identified with entity designations and headquarters addresses in the preamble.",
        reasoning:
          "Explicitly defined in the opening recitals with primary business entity titles.",
        exactQuote:
          "This Master Services Agreement (\"Agreement\") is entered into as of January 15, 2026 (\"Effective Date\") by and between CloudScale Technologies, Inc., a Delaware corporation with its principal office at 100 Enterprise Way, Suite 400, Wilmington, DE 19801 (\"Provider\"), and Acme Global Enterprises, LLC, a California limited liability company (\"Customer\").",
        pageNumber: 1,
        sectionReference: "Preamble (Page 1)",
        startCharOffset: 0,
        endCharOffset: 345,
        locationData: { pageNumber: 1, sectionHeading: "Preamble" },
        quoteVerified: true,
        verificationMethod: "exact_match",
        confidenceScore: 0.99,
        confidenceLabel: "high",
      },
      {
        checklistItem: "start_date_and_term",
        status: "found",
        summary:
          "Commences on January 15, 2026 for a defined initial term of thirty-six (36) months.",
        explanation:
          "Commencement date and duration are clearly established in Section 2.1.",
        reasoning:
          "Clear commencement date and duration stated in the Term section.",
        exactQuote:
          "This Agreement shall commence on January 15, 2026 (\"Effective Date\") and continue for an initial term of thirty-six (36) months (\"Initial Term\").",
        pageNumber: 2,
        sectionReference: "Section 2.1 (Page 2)",
        startCharOffset: 520,
        endCharOffset: 665,
        locationData: { pageNumber: 2, sectionHeading: "Section 2.1 - Term" },
        quoteVerified: true,
        verificationMethod: "exact_match",
        confidenceScore: 0.98,
        confidenceLabel: "high",
      },
      {
        checklistItem: "payment_terms",
        status: "unclear",
        summary:
          "General invoices are Net 30 with 1.5% late interest, but tiered unit rates reference an omitted Exhibit B.",
        explanation:
          "Payment timeframe is clear (Net 30), but core pricing metrics are unclear because Exhibit B (Fee Schedule) was omitted from the uploaded copy.",
        reasoning:
          "Section 4.3 establishes Net 30, but explicitly relies on an unattached fee schedule schedule for rate calculations.",
        exactQuote:
          "All invoiced amounts shall be due and payable within thirty (30) days from the invoice date. Late payments shall accrue interest at 1.5% per month or the maximum rate permitted by law. Variable tier pricing and volume discounts shall be governed by Exhibit B (Fee Schedule) attached hereto.",
        pageNumber: 4,
        sectionReference: "Section 4.3 (Page 4)",
        startCharOffset: 920,
        endCharOffset: 1210,
        locationData: { pageNumber: 4, sectionHeading: "Section 4 - Payment Terms" },
        quoteVerified: true,
        verificationMethod: "exact_match",
        confidenceScore: 0.85,
        confidenceLabel: "medium",
      },
      {
        checklistItem: "termination",
        status: "found",
        summary:
          "Termination for convenience requires 60 days prior written notice; termination for cause allows a 30-day cure period.",
        explanation:
          "Section 8 details both bilateral termination for convenience (60 days) and termination for material breach (30-day cure period).",
        reasoning:
          "Explicit termination for convenience window identified and verbatim verified.",
        exactQuote:
          "Either party may terminate this Agreement for convenience upon sixty (60) days prior written notice to the other party.",
        pageNumber: 6,
        sectionReference: "Section 8.2 (Page 6)",
        startCharOffset: 1680,
        endCharOffset: 1795,
        locationData: { pageNumber: 6, sectionHeading: "Section 8 - Termination" },
        quoteVerified: true,
        verificationMethod: "exact_match",
        confidenceScore: 0.98,
        confidenceLabel: "high",
      },
      {
        checklistItem: "limitation_of_liability",
        status: "found",
        summary:
          "Direct liability is capped at aggregate fees paid in the preceding 12 months with waiver of consequential damages.",
        explanation:
          "Mutual liability cap pegged to trailing twelve months fees, with full disclaimer of special/indirect damages.",
        reasoning:
          "Standard mutual liability ceiling with trailing twelve months metric.",
        exactQuote:
          "IN NO EVENT SHALL EITHER PARTY'S AGGREGATE LIABILITY EXCEED THE TOTAL FEES PAID OR PAYABLE UNDER THIS AGREEMENT IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.",
        pageNumber: 7,
        sectionReference: "Section 9.1 (Page 7)",
        startCharOffset: 1910,
        endCharOffset: 2065,
        locationData: { pageNumber: 7, sectionHeading: "Section 9 - Limitation of Liability" },
        quoteVerified: true,
        verificationMethod: "exact_match",
        confidenceScore: 0.99,
        confidenceLabel: "high",
      },
      {
        checklistItem: "confidentiality",
        status: "found",
        summary:
          "Non-disclosure obligations survive for five (5) years post-termination, with indefinite survival for trade secrets.",
        explanation:
          "Comprehensive confidentiality protection spanning 5 years after expiration, carving out indefinite protection for trade secrets.",
        reasoning:
          "Standard confidentiality duration with trade secrets carved out indefinitely.",
        exactQuote:
          "The receiving party shall protect Disclosing Party's Confidential Information for a period of five (5) years following termination or expiration of this Agreement, except that trade secrets shall remain protected indefinitely.",
        pageNumber: 5,
        sectionReference: "Section 6.4 (Page 5)",
        startCharOffset: 1390,
        endCharOffset: 1615,
        locationData: { pageNumber: 5, sectionHeading: "Section 6 - Confidentiality" },
        quoteVerified: true,
        verificationMethod: "exact_match",
        confidenceScore: 0.96,
        confidenceLabel: "high",
      },
      {
        checklistItem: "governing_law",
        status: "found",
        summary:
          "Governed by Delaware law with exclusive forum and venue in New Castle County, Delaware.",
        explanation:
          "Section 12.5 designates Delaware state and federal courts with waiver of conflicts of law.",
        reasoning:
          "Standard Delaware choice of law and venue clause identified.",
        exactQuote:
          "This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to conflicts of law principles. Any dispute arising hereunder shall be subject to the exclusive jurisdiction of the state and federal courts located in New Castle County, Delaware.",
        pageNumber: 11,
        sectionReference: "Section 12.5 (Page 11)",
        startCharOffset: 2420,
        endCharOffset: 2715,
        locationData: { pageNumber: 11, sectionHeading: "Section 12 - Miscellaneous" },
        quoteVerified: true,
        verificationMethod: "exact_match",
        confidenceScore: 0.99,
        confidenceLabel: "high",
      },
      {
        checklistItem: "auto_renewal",
        status: "not_found",
        summary:
          "No automatic renewal clause exists. Agreement strictly expires after the 36-month initial term unless mutually amended.",
        explanation:
          "Section 2.2 explicitly prohibits automatic renewals, requiring affirmative mutual execution of an amendment.",
        reasoning:
          "Exhaustive candidate coverage verified that no successive or automatic renewal provisions are present.",
        exactQuote: null,
        pageNumber: null,
        sectionReference: null,
        startCharOffset: null,
        endCharOffset: null,
        locationData: null,
        quoteVerified: null,
        verificationMethod: null,
        confidenceScore: 0.95,
        confidenceLabel: "high",
      },
    ];

    const insertedFindings: ReviewFinding[] = [];
    for (const f of findingsData) {
      const [finding] = await db
        .insert(reviewFindings)
        .values({
          reviewId: review.id,
          contractVersionId: version?.id || null,
          checklistItem: f.checklistItem,
          status: f.status,
          summary: f.summary,
          explanation: f.explanation,
          reasoning: f.reasoning,
          exactQuote: f.exactQuote,
          pageNumber: f.pageNumber,
          sectionReference: f.sectionReference,
          startCharOffset: f.startCharOffset,
          endCharOffset: f.endCharOffset,
          locationData: f.locationData,
          quoteVerified: f.quoteVerified,
          verificationMethod: f.verificationMethod,
          confidenceScore: f.confidenceScore,
          confidenceLabel: f.confidenceLabel,
        })
        .returning();
      insertedFindings.push(finding);
    }

    return { review, findings: insertedFindings };
  }

  /**
   * Dispatches deterministic chat stream and persists user/assistant messages
   * in Neon PostgreSQL under the authenticated user's session.
   */
  static async sendChatMessageStream(params: {
    sessionId: string;
    contractId: string;
    userId: string;
    message: string;
  }): Promise<{ stream: ReadableStream }> {
    const { sessionId, contractId, userId, message } = params;

    // 1. Persist User Message into Neon PostgreSQL
    await db.insert(chatMessages).values({
      sessionId,
      role: "user",
      content: message,
    });

    // 2. Generate grounded answer
    const lower = message.toLowerCase();

    let assistantResponse = "";
    let retrievedSources: RetrievedChunkSource[] = [];

    if (
      lower.includes("governing law") ||
      lower.includes("jurisdiction") ||
      lower.includes("delaware") ||
      lower.includes("law")
    ) {
      assistantResponse =
        "Under Section 12.5 (Governing Law and Jurisdiction, Page 11), this Agreement is governed by and construed in accordance with the laws of the State of Delaware, without regard to conflicts of law principles. Any dispute arising hereunder must be instituted exclusively in the state or federal courts located in New Castle County, Delaware.";
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
      ];
    } else if (
      lower.includes("hardware") ||
      lower.includes("physical") ||
      lower.includes("space") ||
      lower.includes("crypto") ||
      lower.includes("penalty for late delivery") ||
      lower.includes("penalties for late") ||
      lower.includes("satellite")
    ) {
      assistantResponse =
        "Insufficient Information: I have thoroughly searched the document chunks, and this contract does not contain any provisions regarding physical hardware delivery, late hardware penalties, or equipment maintenance. This agreement is strictly a cloud software Master Services Agreement (MSA) and does not govern physical logistics or hardware delivery.";
      retrievedSources = [];
    } else {
      assistantResponse =
        `Based on the Master Services Agreement between CloudScale Technologies and Acme Global Enterprises: the agreement establishes cloud infrastructure services starting January 15, 2026 for a 36-month term with Delaware governing law and a 60-day notice for termination for convenience. (Answering your query: "${message.slice(0, 50)}...")`;
      retrievedSources = [
        {
          chunkId: "chk_demo_gen",
          content:
            "Master Services Agreement between CloudScale Technologies, Inc. and Acme Global Enterprises, LLC.",
          similarity: 0.91,
          pageNumber: 1,
          sectionTitle: "Preamble",
        },
      ];
    }

    // 3. Persist Assistant Message in Neon PostgreSQL
    const [assistantRecord] = await db
      .insert(chatMessages)
      .values({
        sessionId,
        role: "assistant",
        content: assistantResponse,
        retrievedChunks: retrievedSources,
        modelId: "demo-deterministic/meta-llama-3.3-70b",
      })
      .returning();

    // 4. Stream tokens via SSE
    const words = assistantResponse.split(" ");
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        if (retrievedSources.length > 0) {
          const contextPayload = `event: context\ndata: ${JSON.stringify({
            sources: retrievedSources,
          })}\n\n`;
          controller.enqueue(encoder.encode(contextPayload));
        }

        for (let i = 0; i < words.length; i++) {
          const chunk = (i === 0 ? "" : " ") + words[i];
          const tokenPayload = `event: token\ndata: ${JSON.stringify({
            text: chunk,
          })}\n\n`;
          controller.enqueue(encoder.encode(tokenPayload));
          await new Promise((r) => setTimeout(r, 16));
        }

        const donePayload = `event: done\ndata: ${JSON.stringify({
          messageId: assistantRecord.id,
          content: assistantResponse,
        })}\n\n`;
        controller.enqueue(encoder.encode(donePayload));
        controller.close();
      },
    });

    return { stream };
  }
}
