-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled', 'interrupted');

-- CreateEnum
CREATE TYPE "StageRunStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'reused', 'overridden');

-- CreateEnum
CREATE TYPE "StageName" AS ENUM ('text_extraction', 'information_extraction', 'summarization', 'similarity', 'verification', 'report');

-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('upload', 'corpus');

-- CreateEnum
CREATE TYPE "FactCategory" AS ENUM ('date', 'deadline', 'monetary_value', 'obligation', 'decision', 'legal_reference', 'amendment');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "FactStatus" AS ENUM ('confirmed', 'uncertain');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('exact', 'fuzzy', 'not_found');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('source_to_summary', 'summary_to_source');

-- CreateEnum
CREATE TYPE "Verdict" AS ENUM ('consistent', 'divergent', 'omitted', 'unverifiable', 'supported', 'unsupported');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('divergence', 'omission', 'unsupported_claim', 'unverifiable');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "DecidedBy" AS ENUM ('code', 'llm');

-- CreateEnum
CREATE TYPE "LlmCallStatus" AS ENUM ('success', 'error');

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "source" "DocumentSource" NOT NULL,
    "corpus_key" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presets" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "is_builtin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "preset_id" UUID,
    "parent_run_id" UUID,
    "start_from_stage" "StageName",
    "label" TEXT,
    "status" "RunStatus" NOT NULL,
    "config" JSONB NOT NULL,
    "config_hash" TEXT NOT NULL,
    "injected_faults" JSONB,
    "error" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_runs" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "stage" "StageName" NOT NULL,
    "status" "StageRunStatus" NOT NULL,
    "reused_from_stage_run_id" UUID,
    "output" JSONB,
    "metrics" JSONB,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "error" JSONB,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stage_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_events" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "stage" "StageName",
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_calls" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "stage_run_id" UUID NOT NULL,
    "agent" TEXT NOT NULL,
    "agent_version" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "messages" JSONB NOT NULL,
    "raw_response" JSONB NOT NULL,
    "parsed_output" JSONB,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "reasoning_tokens" INTEGER,
    "cost_usd" DOUBLE PRECISION NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" "LlmCallStatus" NOT NULL,
    "error" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embedding_calls" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "stage_run_id" UUID NOT NULL,
    "model" TEXT NOT NULL,
    "input_count" INTEGER NOT NULL,
    "tokens" INTEGER NOT NULL,
    "cache_hits" INTEGER NOT NULL,
    "cost_usd" DOUBLE PRECISION NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embedding_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embedding_cache" (
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "text_hash" TEXT NOT NULL,
    "vector" REAL[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embedding_cache_pkey" PRIMARY KEY ("model","dimensions","text_hash")
);

-- CreateTable
CREATE TABLE "extracted_facts" (
    "id" UUID NOT NULL,
    "stage_run_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "category" "FactCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "status" "FactStatus" NOT NULL,
    "uncertainty_reasons" TEXT[],

    CONSTRAINT "extracted_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_evidence" (
    "id" UUID NOT NULL,
    "fact_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "quote" TEXT NOT NULL,
    "start" INTEGER,
    "end" INTEGER,
    "page" INTEGER,
    "section_id" TEXT,
    "match_type" "MatchType" NOT NULL,
    "match_score" DOUBLE PRECISION,

    CONSTRAINT "fact_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "summaries" (
    "id" UUID NOT NULL,
    "stage_run_id" UUID NOT NULL,
    "content" JSONB NOT NULL,
    "readability_source" DOUBLE PRECISION NOT NULL,
    "readability_summary" DOUBLE PRECISION NOT NULL,
    "compression_ratio" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" UUID NOT NULL,
    "stage_run_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "paragraph_ref" JSONB,
    "category" "FactCategory",
    "value" JSONB,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_items" (
    "id" UUID NOT NULL,
    "stage_run_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "verdict" "Verdict" NOT NULL,
    "explanation" TEXT NOT NULL,
    "fact_id" UUID,
    "claim_id" UUID,
    "decided_by" "DecidedBy" NOT NULL,
    "used_quotes" JSONB NOT NULL,

    CONSTRAINT "verification_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "stage_run_id" UUID NOT NULL,
    "verification_item_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "category" "FactCategory",
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "source_evidence" JSONB NOT NULL,
    "summary_ref" JSONB,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_metrics" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "centroid" DOUBLE PRECISION,
    "coverage" DOUBLE PRECISION,
    "support" DOUBLE PRECISION,
    "alignment_f1" DOUBLE PRECISION,
    "factual_consistency" DOUBLE PRECISION,
    "claim_support" DOUBLE PRECISION,
    "unverifiable_count" INTEGER NOT NULL,
    "facts_confirmed" INTEGER NOT NULL,
    "facts_uncertain" INTEGER NOT NULL,
    "alerts_high" INTEGER NOT NULL,
    "alerts_medium" INTEGER NOT NULL,
    "alerts_low" INTEGER NOT NULL,
    "readability_source" DOUBLE PRECISION,
    "readability_summary" DOUBLE PRECISION,
    "compression_ratio" DOUBLE PRECISION,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_usd" DOUBLE PRECISION NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documents_sha256_key" ON "documents"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "presets_slug_key" ON "presets"("slug");

-- CreateIndex
CREATE INDEX "runs_document_id_idx" ON "runs"("document_id");

-- CreateIndex
CREATE INDEX "runs_label_idx" ON "runs"("label");

-- CreateIndex
CREATE UNIQUE INDEX "stage_runs_run_id_stage_key" ON "stage_runs"("run_id", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "run_events_run_id_seq_key" ON "run_events"("run_id", "seq");

-- CreateIndex
CREATE INDEX "llm_calls_run_id_idx" ON "llm_calls"("run_id");

-- CreateIndex
CREATE INDEX "embedding_calls_run_id_idx" ON "embedding_calls"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "extracted_facts_stage_run_id_key_key" ON "extracted_facts"("stage_run_id", "key");

-- CreateIndex
CREATE INDEX "fact_evidence_fact_id_idx" ON "fact_evidence"("fact_id");

-- CreateIndex
CREATE UNIQUE INDEX "summaries_stage_run_id_key" ON "summaries"("stage_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "claims_stage_run_id_key_key" ON "claims"("stage_run_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "verification_items_stage_run_id_key_key" ON "verification_items"("stage_run_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_stage_run_id_key_key" ON "alerts"("stage_run_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "run_metrics_run_id_key" ON "run_metrics"("run_id");

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_preset_id_fkey" FOREIGN KEY ("preset_id") REFERENCES "presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_parent_run_id_fkey" FOREIGN KEY ("parent_run_id") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_runs" ADD CONSTRAINT "stage_runs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_runs" ADD CONSTRAINT "stage_runs_reused_from_stage_run_id_fkey" FOREIGN KEY ("reused_from_stage_run_id") REFERENCES "stage_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_stage_run_id_fkey" FOREIGN KEY ("stage_run_id") REFERENCES "stage_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embedding_calls" ADD CONSTRAINT "embedding_calls_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embedding_calls" ADD CONSTRAINT "embedding_calls_stage_run_id_fkey" FOREIGN KEY ("stage_run_id") REFERENCES "stage_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_facts" ADD CONSTRAINT "extracted_facts_stage_run_id_fkey" FOREIGN KEY ("stage_run_id") REFERENCES "stage_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_evidence" ADD CONSTRAINT "fact_evidence_fact_id_fkey" FOREIGN KEY ("fact_id") REFERENCES "extracted_facts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_stage_run_id_fkey" FOREIGN KEY ("stage_run_id") REFERENCES "stage_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_stage_run_id_fkey" FOREIGN KEY ("stage_run_id") REFERENCES "stage_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_stage_run_id_fkey" FOREIGN KEY ("stage_run_id") REFERENCES "stage_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_fact_id_fkey" FOREIGN KEY ("fact_id") REFERENCES "extracted_facts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_stage_run_id_fkey" FOREIGN KEY ("stage_run_id") REFERENCES "stage_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_verification_item_id_fkey" FOREIGN KEY ("verification_item_id") REFERENCES "verification_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_metrics" ADD CONSTRAINT "run_metrics_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
