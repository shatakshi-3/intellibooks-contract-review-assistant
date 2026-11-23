import type { Contract, Review, ReviewFinding } from "@/lib/db/schema";
import { DEMO_USER_1 } from "./config";

export const DEMO_CONTRACT_1_ID = "11111111-1111-1111-1111-111111111111";
export const DEMO_CONTRACT_2_ID = "22222222-2222-2222-2222-222222222222";
export const DEMO_REVIEW_1_ID = "33333333-3333-3333-3333-333333333333";
export const DEMO_REVIEW_2_ID = "44444444-4444-4444-4444-444444444444";

export const DEMO_CONTRACTS: Contract[] = [
  {
    id: DEMO_CONTRACT_1_ID,
    userId: DEMO_USER_1.id,
    originalFilename: "Master_Services_Agreement_CloudScale.pdf",
    fileType: "pdf",
    fileSizeBytes: 524288,
    storageKey: `contracts/${DEMO_USER_1.id}/${DEMO_CONTRACT_1_ID}/Master_Services_Agreement_CloudScale.pdf`,
    blobUrl: `https://blob.vercel-storage.com/contracts/${DEMO_CONTRACT_1_ID}.pdf`,
    status: "ready",
    extractedText: `MASTER SERVICES AGREEMENT

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
12.8 Entire Agreement. This document constitutes the entire agreement between the parties regarding cloud software services.`,
    contentHash: "hash_msa_12345",
    pageCount: 12,
    metadata: { author: "CloudScale Legal Counsel", version: "1.0" },
    createdAt: new Date(Date.now() - 86400000 * 2),
    updatedAt: new Date(Date.now() - 86400000 * 2),
  },
  {
    id: DEMO_CONTRACT_2_ID,
    userId: DEMO_USER_1.id,
    originalFilename: "Enterprise_SaaS_Vendor_Agreement_DataVault.docx",
    fileType: "docx",
    fileSizeBytes: 245760,
    storageKey: `contracts/${DEMO_USER_1.id}/${DEMO_CONTRACT_2_ID}/Enterprise_SaaS_Vendor_Agreement_DataVault.docx`,
    blobUrl: `https://blob.vercel-storage.com/contracts/${DEMO_CONTRACT_2_ID}.docx`,
    status: "ready",
    extractedText: "Enterprise SaaS Vendor Agreement by DataVault Systems...",
    contentHash: "hash_saas_67890",
    pageCount: 6,
    metadata: { author: "DataVault Counsel", version: "2.1" },
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(Date.now() - 86400000),
  },
];

export const DEMO_REVIEWS: Record<string, Review> = {
  [DEMO_CONTRACT_1_ID]: {
    id: DEMO_REVIEW_1_ID,
    contractId: DEMO_CONTRACT_1_ID,
    contractVersionId: null,
    userId: DEMO_USER_1.id,
    modelId: "meta-llama/llama-3.3-70b-instruct:free",
    promptVersion: "v1",
    embeddingModel: "openai/text-embedding-3-small",
    overallStatus: "complete",
    contentHash: "hash_msa_12345",
    rawLlmResponse: null,
    durationMs: 3420,
    createdAt: new Date(Date.now() - 86400000 * 2),
  },
  [DEMO_CONTRACT_2_ID]: {
    id: DEMO_REVIEW_2_ID,
    contractId: DEMO_CONTRACT_2_ID,
    contractVersionId: null,
    userId: DEMO_USER_1.id,
    modelId: "meta-llama/llama-3.3-70b-instruct:free",
    promptVersion: "v1",
    embeddingModel: "openai/text-embedding-3-small",
    overallStatus: "complete",
    contentHash: "hash_saas_67890",
    rawLlmResponse: null,
    durationMs: 2980,
    createdAt: new Date(Date.now() - 86400000),
  },
};

export const DEMO_FINDINGS: Record<string, ReviewFinding[]> = {
  [DEMO_REVIEW_1_ID]: [
    {
      id: "fnd_01",
      reviewId: DEMO_REVIEW_1_ID,
      contractVersionId: null,
      checklistItem: "parties",
      status: "found",
      summary:
        "Contracting parties are CloudScale Technologies, Inc. ('Provider') and Acme Global Enterprises, LLC ('Customer').",
      explanation:
        "Both parties are formally identified with entity classifications and business addresses in the introductory preamble.",
      reasoning:
        "Explicitly defined in the opening recitals with primary business entity titles and corporate registrations.",
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
      rawEvidence: null,
      createdAt: new Date(),
    },
    {
      id: "fnd_02",
      reviewId: DEMO_REVIEW_1_ID,
      contractVersionId: null,
      checklistItem: "start_date_and_term",
      status: "found",
      summary:
        "Agreement takes effect on January 15, 2026 for a defined initial duration of thirty-six (36) months.",
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
      rawEvidence: null,
      createdAt: new Date(),
    },
    {
      id: "fnd_03",
      reviewId: DEMO_REVIEW_1_ID,
      contractVersionId: null,
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
      rawEvidence: null,
      createdAt: new Date(),
    },
    {
      id: "fnd_04",
      reviewId: DEMO_REVIEW_1_ID,
      contractVersionId: null,
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
      rawEvidence: null,
      createdAt: new Date(),
    },
    {
      id: "fnd_05",
      reviewId: DEMO_REVIEW_1_ID,
      contractVersionId: null,
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
      rawEvidence: null,
      createdAt: new Date(),
    },
    {
      id: "fnd_06",
      reviewId: DEMO_REVIEW_1_ID,
      contractVersionId: null,
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
      rawEvidence: null,
      createdAt: new Date(),
    },
    {
      id: "fnd_07",
      reviewId: DEMO_REVIEW_1_ID,
      contractVersionId: null,
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
      rawEvidence: null,
      createdAt: new Date(),
    },
    {
      id: "fnd_08",
      reviewId: DEMO_REVIEW_1_ID,
      contractVersionId: null,
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
      rawEvidence: null,
      createdAt: new Date(),
    },
  ],
};
