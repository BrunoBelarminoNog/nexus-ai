CREATE TYPE "nexus"."execution_state" AS ENUM('pending', 'running', 'succeeded', 'failed', 'cancelled', 'unknown');--> statement-breakpoint
CREATE TABLE "nexus"."run_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"state" "nexus"."execution_state" DEFAULT 'pending' NOT NULL,
	"runtime_ref" text,
	"created_at" timestamp (3) with time zone DEFAULT statement_timestamp() NOT NULL,
	"started_at" timestamp (3) with time zone,
	"finished_at" timestamp (3) with time zone,
	"output" jsonb,
	"error" jsonb,
	CONSTRAINT "run_attempts_run_number" UNIQUE("run_id","number"),
	CONSTRAINT "run_attempts_run_id_id" UNIQUE("run_id","id"),
	CONSTRAINT "run_attempts_number_positive" CHECK ("nexus"."run_attempts"."number" > 0),
	CONSTRAINT "run_attempts_runtime_ref_present" CHECK ("nexus"."run_attempts"."runtime_ref" ~ '[^[:space:]]'),
	CONSTRAINT "run_attempts_start_valid" CHECK (
      ("nexus"."run_attempts"."state" <> 'pending' OR "nexus"."run_attempts"."started_at" IS NULL)
      AND ("nexus"."run_attempts"."state" <> 'running' OR "nexus"."run_attempts"."started_at" IS NOT NULL)
      AND "nexus"."run_attempts"."started_at" >= "nexus"."run_attempts"."created_at"
    ),
	CONSTRAINT "run_attempts_finish_valid" CHECK (
      ("nexus"."run_attempts"."state" IN ('succeeded', 'failed', 'cancelled')) = ("nexus"."run_attempts"."finished_at" IS NOT NULL)
      AND "nexus"."run_attempts"."finished_at" >= coalesce("nexus"."run_attempts"."started_at", "nexus"."run_attempts"."created_at")
    ),
	CONSTRAINT "run_attempts_output_state" CHECK (("nexus"."run_attempts"."state" = 'succeeded') = ("nexus"."run_attempts"."output" IS NOT NULL)),
	CONSTRAINT "run_attempts_error_state" CHECK (("nexus"."run_attempts"."state" = 'failed') = ("nexus"."run_attempts"."error" IS NOT NULL)),
	CONSTRAINT "run_attempts_error_format" CHECK (
      "nexus"."run_attempts"."error" IS NULL OR (
        jsonb_typeof("nexus"."run_attempts"."error") = 'object'
        AND "nexus"."run_attempts"."error" - 'category' - 'code' - 'message' = '{}'::jsonb
        AND "nexus"."run_attempts"."error"->>'category' IN ('platform', 'provider', 'tool')
        AND jsonb_typeof("nexus"."run_attempts"."error"->'code') = 'string' AND "nexus"."run_attempts"."error"->>'code' ~ '[^[:space:]]'
        AND jsonb_typeof("nexus"."run_attempts"."error"->'message') = 'string' AND "nexus"."run_attempts"."error"->>'message' ~ '[^[:space:]]'
      ) IS TRUE
    )
);
--> statement-breakpoint
CREATE TABLE "nexus"."run_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"type" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"correlation_id" text NOT NULL,
	"occurred_at" timestamp (3) with time zone DEFAULT statement_timestamp() NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "run_events_run_sequence" UNIQUE("run_id","sequence"),
	CONSTRAINT "run_events_sequence_positive" CHECK ("nexus"."run_events"."sequence" > 0),
	CONSTRAINT "run_events_version_positive" CHECK ("nexus"."run_events"."schema_version" > 0),
	CONSTRAINT "run_events_envelope_valid" CHECK (
      "nexus"."run_events"."type" ~ '[^[:space:]]' AND "nexus"."run_events"."correlation_id" ~ '[^[:space:]]'
      AND jsonb_typeof("nexus"."run_events"."data") = 'object'
    )
);
--> statement-breakpoint
CREATE TABLE "nexus"."runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"requester_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"agent_version" text NOT NULL,
	"input" jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload_hash" text NOT NULL,
	"correlation_id" text NOT NULL,
	"state" "nexus"."execution_state" DEFAULT 'pending' NOT NULL,
	"last_event_sequence" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT statement_timestamp() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT statement_timestamp() NOT NULL,
	CONSTRAINT "runs_submission_key" UNIQUE("workspace_id","requester_id","idempotency_key"),
	CONSTRAINT "runs_identity_present" CHECK (
      "nexus"."runs"."workspace_id" ~ '[^[:space:]]' AND "nexus"."runs"."requester_id" ~ '[^[:space:]]'
      AND "nexus"."runs"."agent_id" ~ '[^[:space:]]' AND "nexus"."runs"."agent_version" ~ '[^[:space:]]'
      AND "nexus"."runs"."idempotency_key" ~ '[^[:space:]]' AND "nexus"."runs"."correlation_id" ~ '[^[:space:]]'
    ),
	CONSTRAINT "runs_payload_hash_valid" CHECK ("nexus"."runs"."payload_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "runs_sequence_positive" CHECK ("nexus"."runs"."last_event_sequence" > 0),
	CONSTRAINT "runs_updated_after_creation" CHECK ("nexus"."runs"."updated_at" >= "nexus"."runs"."created_at")
);
--> statement-breakpoint
ALTER TABLE "nexus"."run_attempts" ADD CONSTRAINT "run_attempts_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "nexus"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nexus"."run_events" ADD CONSTRAINT "run_events_run_attempt_fk" FOREIGN KEY ("run_id","attempt_id") REFERENCES "nexus"."run_attempts"("run_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "run_attempts_one_active" ON "nexus"."run_attempts" USING btree ("run_id") WHERE "nexus"."run_attempts"."state" IN ('pending', 'running', 'unknown');