/**
 * IntelliBooks Database Schema
 *
 * Complete Drizzle ORM schema for PostgreSQL + pgvector.
 * All tables use UUIDs, enforce foreign keys, and include timestamps.
 *
 * Key design decisions:
 * - user_id on document_chunks enables ownership-scoped vector search
 * - content_hash enables idempotent reprocessing
 * - embedding_model tracked per chunk for reproducibility
 * - quote_verified + verification_method for audit trail
 * - prompt_version + model_id on reviews for versioning
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  real,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkId: text("clerk_id").notNull(),
    email: text("email").notNull(),
    name: text("name"),
    role: text("role").default("user").notNull(), // 'user' | 'admin'
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("idx_users_clerk_id").on(table.clerkId),
    index("idx_users_email").on(table.email),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  contracts: many(contracts),
}));

// ─── Contracts ───────────────────────────────────────────────────────────────

export type ContractStatus =
  | "pending_upload"
  | "uploading"
  | "uploaded"
  | "processing"
  | "extracting"
  | "chunking"
  | "embedding"
  | "ready"
  | "failed";

export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    originalFilename: text("original_filename").notNull(),
    fileType: text("file_type").notNull(), // 'pdf' | 'docx' | 'txt'
    fileSizeBytes: integer("file_size_bytes").notNull(),
    storageKey: text("storage_key"), // randomized Blob path
    blobUrl: text("blob_url"), // Vercel Blob URL
    status: text("status").default("pending_upload").notNull(),
    extractedText: text("extracted_text"),
    contentHash: text("content_hash"), // SHA-256 of extracted text
    pageCount: integer("page_count"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_contracts_user_id").on(table.userId),
    index("idx_contracts_status").on(table.status),
    index("idx_contracts_created_at").on(table.createdAt),
  ]
);

export type Contract = typeof contracts.$inferSelect;
export type NewContract = typeof contracts.$inferInsert;
export type User = typeof users.$inferSelect;
export type ContractVersion = typeof contractVersions.$inferSelect;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type ProcessingJob = typeof processingJobs.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type ReviewFinding = typeof reviewFindings.$inferSelect;

export const contractsRelations = relations(contracts, ({ one, many }) => ({
  user: one(users, {
    fields: [contracts.userId],
    references: [users.id],
  }),
  versions: many(contractVersions),
  processingJobs: many(processingJobs),
  reviews: many(reviews),
  chatSessions: many(chatSessions),
}));

// ─── Contract Versions ──────────────────────────────────────────────────────

export const contractVersions = pgTable(
  "contract_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    storageKey: text("storage_key"),
    blobUrl: text("blob_url"),
    extractedText: text("extracted_text"),
    contentHash: text("content_hash"),
    pageCount: integer("page_count"),
    structureMetadata: jsonb("structure_metadata").$type<{
      sections?: Array<{
        title: string;
        number: string;
        startOffset: number;
        endOffset: number;
        pageNumber?: number;
      }>;
      headings?: string[];
      totalCharacters?: number;
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("idx_versions_contract_num").on(
      table.contractId,
      table.versionNumber
    ),
    index("idx_versions_contract_id").on(table.contractId),
  ]
);

export const contractVersionsRelations = relations(
  contractVersions,
  ({ one, many }) => ({
    contract: one(contracts, {
      fields: [contractVersions.contractId],
      references: [contracts.id],
    }),
    chunks: many(documentChunks),
  })
);

// ─── Document Chunks ─────────────────────────────────────────────────────────

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractVersionId: uuid("contract_version_id")
      .notNull()
      .references(() => contractVersions.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    pageNumber: integer("page_number"),
    sectionTitle: text("section_title"),
    sectionNumber: integer("section_number"),
    startCharOffset: integer("start_char_offset"),
    endCharOffset: integer("end_char_offset"),
    embedding: vector("embedding", { dimensions: 1536 }),
    embeddingModel: text("embedding_model"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_chunks_contract_user").on(table.contractId, table.userId),
    index("idx_chunks_version").on(table.contractVersionId),
    index("idx_chunks_contract_id").on(table.contractId),
    // HNSW index for vector similarity search
    // Note: This is created via raw SQL in migration since Drizzle's
    // vector index builder may need explicit operator class
  ]
);

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  contractVersion: one(contractVersions, {
    fields: [documentChunks.contractVersionId],
    references: [contractVersions.id],
  }),
  contract: one(contracts, {
    fields: [documentChunks.contractId],
    references: [contracts.id],
  }),
  user: one(users, {
    fields: [documentChunks.userId],
    references: [users.id],
  }),
}));

// ─── Processing Jobs ─────────────────────────────────────────────────────────

export type ProcessingJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "retrying";

export type ProcessingJobType =
  | "full_processing"
  | "extraction"
  | "chunking"
  | "embedding"
  | "review";

export const processingJobs = pgTable(
  "processing_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobType: text("job_type").notNull(), // ProcessingJobType
    status: text("status").default("queued").notNull(), // ProcessingJobStatus
    workflowRunId: text("workflow_run_id"), // Vercel Workflow run ID
    errorMessage: text("error_message"),
    attemptCount: integer("attempt_count").default(0).notNull(),
    currentStep: text("current_step"),
    stepResults: jsonb("step_results").$type<
      Record<string, { status: string; duration_ms?: number; error?: string }>
    >(),
    jobMetadata: jsonb("job_metadata").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_jobs_contract").on(table.contractId),
    index("idx_jobs_status").on(table.status),
    index("idx_jobs_user").on(table.userId),
  ]
);

export const processingJobsRelations = relations(
  processingJobs,
  ({ one }) => ({
    contract: one(contracts, {
      fields: [processingJobs.contractId],
      references: [contracts.id],
    }),
    user: one(users, {
      fields: [processingJobs.userId],
      references: [users.id],
    }),
  })
);

// ─── Reviews ─────────────────────────────────────────────────────────────────

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    contractVersionId: uuid("contract_version_id")
      .references(() => contractVersions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    modelId: text("model_id").notNull(), // e.g. 'google/gemini-2.5-flash'
    promptVersion: text("prompt_version").notNull(), // e.g. 'v1'
    embeddingModel: text("embedding_model"), // model used for retrieval
    overallStatus: text("overall_status").notNull(), // 'processing' | 'complete' | 'partial' | 'failed'
    contentHash: text("content_hash"),
    rawLlmResponse: jsonb("raw_llm_response"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_reviews_contract").on(table.contractId),
    index("idx_reviews_user").on(table.userId),
    index("idx_reviews_version").on(table.contractVersionId),
    index("idx_reviews_created_at").on(table.createdAt),
  ]
);

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  contract: one(contracts, {
    fields: [reviews.contractId],
    references: [contracts.id],
  }),
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
  findings: many(reviewFindings),
}));

// ─── Review Findings ─────────────────────────────────────────────────────────

export type FindingStatus = "found" | "not_found" | "unclear";

export type ChecklistItem =
  | "parties"
  | "start_date_and_term"
  | "payment_terms"
  | "termination"
  | "limitation_of_liability"
  | "confidentiality"
  | "governing_law"
  | "auto_renewal";

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  "parties",
  "start_date_and_term",
  "payment_terms",
  "termination",
  "limitation_of_liability",
  "confidentiality",
  "governing_law",
  "auto_renewal",
] as const;

export const CHECKLIST_LABELS: Record<ChecklistItem, string> = {
  parties: "Parties",
  start_date_and_term: "Start Date & Term",
  payment_terms: "Payment Terms",
  termination: "Termination",
  limitation_of_liability: "Limitation of Liability",
  confidentiality: "Confidentiality",
  governing_law: "Governing Law",
  auto_renewal: "Auto-Renewal",
};

export const reviewFindings = pgTable(
  "review_findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    contractVersionId: uuid("contract_version_id")
      .references(() => contractVersions.id, { onDelete: "cascade" }),
    checklistItem: text("checklist_item").notNull(), // ChecklistItem
    status: text("status").notNull(), // FindingStatus
    summary: text("summary"), // One-line plain-English summary
    explanation: text("explanation"),
    reasoning: text("reasoning"),
    exactQuote: text("exact_quote"),
    pageNumber: integer("page_number"),
    sectionReference: text("section_reference"),
    startCharOffset: integer("start_char_offset"),
    endCharOffset: integer("end_char_offset"),
    locationData: jsonb("location_data").$type<{
      pageNumber?: number;
      sectionHeading?: string;
      startCharOffset?: number;
      endCharOffset?: number;
      paragraph?: number;
    }>(),
    quoteVerified: boolean("quote_verified"),
    verificationMethod: text("verification_method"), // 'exact_match' | 'normalized_match' | 'verification_failed'
    confidenceScore: real("confidence_score"),
    confidenceLabel: text("confidence_label"), // 'high' | 'medium' | 'low'
    rawEvidence: jsonb("raw_evidence").$type<{
      retrievedChunks?: Array<{
        chunkId: string;
        content: string;
        similarity: number;
        pageNumber?: number;
        sectionTitle?: string;
      }>;
      examinedChunkCount?: number;
      totalChunkCount?: number;
      documentCoverageRatio?: number;
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_findings_review").on(table.reviewId),
    index("idx_findings_checklist").on(table.checklistItem),
    index("idx_findings_version").on(table.contractVersionId),
  ]
);

export const reviewFindingsRelations = relations(
  reviewFindings,
  ({ one }) => ({
    review: one(reviews, {
      fields: [reviewFindings.reviewId],
      references: [reviews.id],
    }),
  })
);

// ─── Chat Sessions ───────────────────────────────────────────────────────────

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => contracts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").default("New Chat").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_sessions_contract_user").on(table.contractId, table.userId),
    index("idx_sessions_user").on(table.userId),
  ]
);

export const chatSessionsRelations = relations(
  chatSessions,
  ({ one, many }) => ({
    contract: one(contracts, {
      fields: [chatSessions.contractId],
      references: [contracts.id],
    }),
    user: one(users, {
      fields: [chatSessions.userId],
      references: [users.id],
    }),
    messages: many(chatMessages),
  })
);

// ─── Chat Messages ───────────────────────────────────────────────────────────

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'user' | 'assistant' | 'system'
    content: text("content").notNull(),
    retrievedChunks: jsonb("retrieved_chunks").$type<
      Array<{
        chunkId: string;
        content: string;
        similarity: number;
        pageNumber?: number;
        sectionTitle?: string;
      }>
    >(),
    modelId: text("model_id"),
    tokenCount: integer("token_count"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_messages_session").on(table.sessionId),
    index("idx_messages_created_at").on(table.createdAt),
  ]
);

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
}));

// ─── Evaluation Runs ─────────────────────────────────────────────────────────

export const evaluationRuns = pgTable(
  "evaluation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runType: text("run_type").notNull(), // 'full' | 'checklist_only' | 'quote_only'
    modelId: text("model_id").notNull(),
    promptVersion: text("prompt_version").notNull(),
    embeddingModel: text("embedding_model"),
    totalCases: integer("total_cases").notNull(),
    passedCases: integer("passed_cases").notNull(),
    failedCases: integer("failed_cases").notNull(),
    passRate: real("pass_rate").notNull(),
    statusAccuracy: real("status_accuracy"),
    quoteValidityRate: real("quote_validity_rate"),
    locationAccuracyRate: real("location_accuracy_rate"),
    precisionScore: real("precision_score"),
    recallScore: real("recall_score"),
    f1Score: real("f1_score"),
    missingClauseDetectionRate: real("missing_clause_detection_rate"),
    sampleSize: integer("sample_size"),
    detailedMetrics: jsonb("detailed_metrics").$type<Record<string, unknown>>(),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("idx_eval_runs_created_at").on(table.createdAt)]
);

export const evaluationRunsRelations = relations(
  evaluationRuns,
  ({ many }) => ({
    cases: many(evaluationCases),
  })
);

// ─── Evaluation Cases ────────────────────────────────────────────────────────

export const evaluationCases = pgTable(
  "evaluation_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => evaluationRuns.id, { onDelete: "cascade" }),
    fixtureName: text("fixture_name").notNull(),
    checklistItem: text("checklist_item").notNull(),
    expectedStatus: text("expected_status").notNull(),
    actualStatus: text("actual_status"),
    statusMatch: boolean("status_match"),
    expectedQuoteSubstring: text("expected_quote_substring"),
    actualQuote: text("actual_quote"),
    quoteValid: boolean("quote_valid"),
    locationAccurate: boolean("location_accurate"),
    expectedPage: integer("expected_page"),
    actualPage: integer("actual_page"),
    failureReason: text("failure_reason"),
    rawComparison: jsonb("raw_comparison").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_eval_cases_run").on(table.runId),
    index("idx_eval_cases_fixture").on(table.fixtureName),
  ]
);

export const evaluationCasesRelations = relations(
  evaluationCases,
  ({ one }) => ({
    run: one(evaluationRuns, {
      fields: [evaluationCases.runId],
      references: [evaluationRuns.id],
    }),
  })
);
