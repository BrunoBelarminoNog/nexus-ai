import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  executionStates,
  type ExecutionEvent,
  type ExecutionFailure,
  type JsonValue,
} from '../../executions/execution.js';

export const nexusSchema = pgSchema('nexus');
export const executionState = nexusSchema.enum(
  'execution_state',
  executionStates,
);

const instant = (name: string) =>
  timestamp(name, { withTimezone: true, precision: 3 });
const now = sql`statement_timestamp()`;

export const runs = nexusSchema.table(
  'runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    requesterId: text('requester_id').notNull(),
    agentId: text('agent_id').notNull(),
    agentVersion: text('agent_version').notNull(),
    input: jsonb('input').$type<JsonValue>().notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    payloadHash: text('payload_hash').notNull(),
    correlationId: text('correlation_id').notNull(),
    state: executionState('state').notNull().default('pending'),
    lastEventSequence: integer('last_event_sequence').notNull().default(1),
    createdAt: instant('created_at').notNull().default(now),
    updatedAt: instant('updated_at').notNull().default(now),
  },
  (t) => [
    unique('runs_submission_key').on(
      t.workspaceId,
      t.requesterId,
      t.idempotencyKey,
    ),
    check(
      'runs_identity_present',
      sql`
      ${t.workspaceId} ~ '[^[:space:]]' AND ${t.requesterId} ~ '[^[:space:]]'
      AND ${t.agentId} ~ '[^[:space:]]' AND ${t.agentVersion} ~ '[^[:space:]]'
      AND ${t.idempotencyKey} ~ '[^[:space:]]' AND ${t.correlationId} ~ '[^[:space:]]'
    `,
    ),
    check('runs_payload_hash_valid', sql`${t.payloadHash} ~ '^[0-9a-f]{64}$'`),
    check('runs_sequence_positive', sql`${t.lastEventSequence} > 0`),
    check('runs_updated_after_creation', sql`${t.updatedAt} >= ${t.createdAt}`),
  ],
);

export const runAttempts = nexusSchema.table(
  'run_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id),
    number: integer('number').notNull(),
    state: executionState('state').notNull().default('pending'),
    runtimeRef: text('runtime_ref'),
    createdAt: instant('created_at').notNull().default(now),
    startedAt: instant('started_at'),
    finishedAt: instant('finished_at'),
    output: jsonb('output').$type<JsonValue>(),
    error: jsonb('error').$type<ExecutionFailure>(),
  },
  (t) => [
    unique('run_attempts_run_number').on(t.runId, t.number),
    unique('run_attempts_run_id_id').on(t.runId, t.id),
    uniqueIndex('run_attempts_one_active')
      .on(t.runId)
      .where(sql`${t.state} IN ('pending', 'running', 'unknown')`),
    check('run_attempts_number_positive', sql`${t.number} > 0`),
    check(
      'run_attempts_runtime_ref_present',
      sql`${t.runtimeRef} ~ '[^[:space:]]'`,
    ),
    check(
      'run_attempts_start_valid',
      sql`
      (${t.state} <> 'pending' OR ${t.startedAt} IS NULL)
      AND (${t.state} <> 'running' OR ${t.startedAt} IS NOT NULL)
      AND ${t.startedAt} >= ${t.createdAt}
    `,
    ),
    check(
      'run_attempts_finish_valid',
      sql`
      (${t.state} IN ('succeeded', 'failed', 'cancelled')) = (${t.finishedAt} IS NOT NULL)
      AND ${t.finishedAt} >= coalesce(${t.startedAt}, ${t.createdAt})
    `,
    ),
    check(
      'run_attempts_output_state',
      sql`(${t.state} = 'succeeded') = (${t.output} IS NOT NULL)`,
    ),
    check(
      'run_attempts_error_state',
      sql`(${t.state} = 'failed') = (${t.error} IS NOT NULL)`,
    ),
    check(
      'run_attempts_error_format',
      sql`
      ${t.error} IS NULL OR (
        jsonb_typeof(${t.error}) = 'object'
        AND ${t.error} - 'category' - 'code' - 'message' = '{}'::jsonb
        AND ${t.error}->>'category' IN ('platform', 'provider', 'tool')
        AND jsonb_typeof(${t.error}->'code') = 'string' AND ${t.error}->>'code' ~ '[^[:space:]]'
        AND jsonb_typeof(${t.error}->'message') = 'string' AND ${t.error}->>'message' ~ '[^[:space:]]'
      ) IS TRUE
    `,
    ),
  ],
);

export const runEvents = nexusSchema.table(
  'run_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    runId: uuid('run_id').notNull(),
    attemptId: uuid('attempt_id').notNull(),
    sequence: integer('sequence').notNull(),
    type: text('type').$type<ExecutionEvent['type']>().notNull(),
    schemaVersion: integer('schema_version').notNull().default(1),
    correlationId: text('correlation_id').notNull(),
    occurredAt: instant('occurred_at').notNull().default(now),
    data: jsonb('data').$type<ExecutionEvent['data']>().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'run_events_run_attempt_fk',
      columns: [t.runId, t.attemptId],
      foreignColumns: [runAttempts.runId, runAttempts.id],
    }),
    unique('run_events_run_sequence').on(t.runId, t.sequence),
    check('run_events_sequence_positive', sql`${t.sequence} > 0`),
    check('run_events_version_positive', sql`${t.schemaVersion} > 0`),
    check(
      'run_events_envelope_valid',
      sql`
      ${t.type} ~ '[^[:space:]]' AND ${t.correlationId} ~ '[^[:space:]]'
      AND jsonb_typeof(${t.data}) = 'object'
    `,
    ),
  ],
);
