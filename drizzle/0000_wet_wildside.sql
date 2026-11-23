CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"retrieved_chunks" jsonb,
	"model_id" text,
	"token_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'New Chat' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"storage_key" text,
	"blob_url" text,
	"extracted_text" text,
	"content_hash" text,
	"page_count" integer,
	"structure_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"original_filename" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"storage_key" text,
	"blob_url" text,
	"status" text DEFAULT 'pending_upload' NOT NULL,
	"extracted_text" text,
	"content_hash" text,
	"page_count" integer,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_version_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"page_number" integer,
	"section_title" text,
	"section_number" integer,
	"start_char_offset" integer,
	"end_char_offset" integer,
	"embedding" vector(1536),
	"embedding_model" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"fixture_name" text NOT NULL,
	"checklist_item" text NOT NULL,
	"expected_status" text NOT NULL,
	"actual_status" text,
	"status_match" boolean,
	"expected_quote_substring" text,
	"actual_quote" text,
	"quote_valid" boolean,
	"location_accurate" boolean,
	"expected_page" integer,
	"actual_page" integer,
	"failure_reason" text,
	"raw_comparison" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_type" text NOT NULL,
	"model_id" text NOT NULL,
	"prompt_version" text NOT NULL,
	"embedding_model" text,
	"total_cases" integer NOT NULL,
	"passed_cases" integer NOT NULL,
	"failed_cases" integer NOT NULL,
	"pass_rate" real NOT NULL,
	"status_accuracy" real,
	"quote_validity_rate" real,
	"location_accuracy_rate" real,
	"precision_score" real,
	"recall_score" real,
	"f1_score" real,
	"missing_clause_detection_rate" real,
	"sample_size" integer,
	"detailed_metrics" jsonb,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"job_type" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"workflow_run_id" text,
	"error_message" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"current_step" text,
	"step_results" jsonb,
	"job_metadata" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"checklist_item" text NOT NULL,
	"status" text NOT NULL,
	"summary" text,
	"explanation" text,
	"exact_quote" text,
	"page_number" integer,
	"section_reference" text,
	"quote_verified" boolean,
	"verification_method" text,
	"confidence_score" real,
	"raw_evidence" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"model_id" text NOT NULL,
	"prompt_version" text NOT NULL,
	"embedding_model" text,
	"overall_status" text NOT NULL,
	"raw_llm_response" jsonb,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_contract_version_id_contract_versions_id_fk" FOREIGN KEY ("contract_version_id") REFERENCES "public"."contract_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_cases" ADD CONSTRAINT "evaluation_cases_run_id_evaluation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."evaluation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_findings" ADD CONSTRAINT "review_findings_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_messages_session" ON "chat_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_messages_created_at" ON "chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_sessions_contract_user" ON "chat_sessions" USING btree ("contract_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "chat_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_versions_contract_num" ON "contract_versions" USING btree ("contract_id","version_number");--> statement-breakpoint
CREATE INDEX "idx_versions_contract_id" ON "contract_versions" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "idx_contracts_user_id" ON "contracts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_contracts_status" ON "contracts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_contracts_created_at" ON "contracts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_chunks_contract_user" ON "document_chunks" USING btree ("contract_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_chunks_version" ON "document_chunks" USING btree ("contract_version_id");--> statement-breakpoint
CREATE INDEX "idx_chunks_contract_id" ON "document_chunks" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "idx_eval_cases_run" ON "evaluation_cases" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_eval_cases_fixture" ON "evaluation_cases" USING btree ("fixture_name");--> statement-breakpoint
CREATE INDEX "idx_eval_runs_created_at" ON "evaluation_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_contract" ON "processing_jobs" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_status" ON "processing_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_jobs_user" ON "processing_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_findings_review" ON "review_findings" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "idx_findings_checklist" ON "review_findings" USING btree ("checklist_item");--> statement-breakpoint
CREATE INDEX "idx_reviews_contract" ON "reviews" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "idx_reviews_user" ON "reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_reviews_created_at" ON "reviews" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_clerk_id" ON "users" USING btree ("clerk_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chunks_embedding" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);
