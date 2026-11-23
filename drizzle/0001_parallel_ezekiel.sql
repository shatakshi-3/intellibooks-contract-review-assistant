ALTER TABLE "review_findings" ADD COLUMN "contract_version_id" uuid;--> statement-breakpoint
ALTER TABLE "review_findings" ADD COLUMN "reasoning" text;--> statement-breakpoint
ALTER TABLE "review_findings" ADD COLUMN "start_char_offset" integer;--> statement-breakpoint
ALTER TABLE "review_findings" ADD COLUMN "end_char_offset" integer;--> statement-breakpoint
ALTER TABLE "review_findings" ADD COLUMN "location_data" jsonb;--> statement-breakpoint
ALTER TABLE "review_findings" ADD COLUMN "confidence_label" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "contract_version_id" uuid;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "review_findings" ADD CONSTRAINT "review_findings_contract_version_id_contract_versions_id_fk" FOREIGN KEY ("contract_version_id") REFERENCES "public"."contract_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_contract_version_id_contract_versions_id_fk" FOREIGN KEY ("contract_version_id") REFERENCES "public"."contract_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_findings_version" ON "review_findings" USING btree ("contract_version_id");--> statement-breakpoint
CREATE INDEX "idx_reviews_version" ON "reviews" USING btree ("contract_version_id");