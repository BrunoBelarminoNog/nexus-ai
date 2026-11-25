import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gt,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../infrastructure/database/schema.js';
import {
  canTransition,
  isTerminal,
  type ExecutionAttempt,
  type ExecutionEvent,
  type ExecutionScope,
  type ExecutionSnapshot,
  type JsonValue,
} from './execution.js';
import {
  ExecutionConflictError,
  ExecutionHistoryRepository,
  ExecutionNotFoundError,
  ExecutionRepository,
  IdempotencyConflictError,
  type AttemptTarget,
  type AttemptTransition,
  type CreateExecution,
  type CreateExecutionResult,
} from './execution.repository.js';

type Database = NodePgDatabase<typeof schema>;
const { runs, runAttempts, runEvents } = schema;
const {
  idempotencyKey: _key,
  payloadHash: _hash,
  ...runColumns
} = getTableColumns(runs);
const now = sql`statement_timestamp()`;
const transactionOptions = { isolationLevel: 'read committed' } as const;

function inScope(scope: ExecutionScope) {
  return and(
    eq(runs.workspaceId, scope.workspaceId),
    eq(runs.requesterId, scope.requesterId),
  );
}

function json(value: JsonValue) {
  // An explicit cast preserves JSON null as a value, including for a successful output.
  return sql`${JSON.stringify(value)}::jsonb`;
}

async function readSnapshot(
  db: Database,
  scope: ExecutionScope,
  ...filters: SQL[]
): Promise<ExecutionSnapshot | null> {
  const [snapshot] = await db
    .select({ run: runColumns, attempt: runAttempts })
    .from(runs)
    .innerJoin(runAttempts, eq(runAttempts.runId, runs.id))
    .where(and(inScope(scope), ...filters))
    .orderBy(desc(runAttempts.number))
    .limit(1);
  return snapshot ?? null;
}

function appendEvent(
  db: Database,
  { run, attempt }: ExecutionSnapshot,
  type: ExecutionEvent['type'],
  data: ExecutionEvent['data'] = {},
) {
  return db.insert(runEvents).values({
    runId: run.id,
    attemptId: attempt.id,
    sequence: run.lastEventSequence,
    correlationId: run.correlationId,
    type,
    data: { runState: run.state, attemptState: attempt.state, ...data },
  });
}

async function createAttempt(db: Database, runId: string, number: number) {
  const [attempt] = await db
    .insert(runAttempts)
    .values({ runId, number })
    .returning();
  return attempt;
}

async function updateAttempt(
  db: Database,
  attempt: ExecutionAttempt,
  change: AttemptTransition,
) {
  if (!canTransition(attempt.state, change.state)) {
    throw new ExecutionConflictError(
      `Cannot transition from ${attempt.state} to ${change.state}.`,
    );
  }
  if (
    attempt.runtimeRef !== null &&
    change.runtimeRef !== undefined &&
    change.runtimeRef !== attempt.runtimeRef
  ) {
    throw new ExecutionConflictError(
      'The attempt already has a different runtime reference.',
    );
  }
  const error = change.state === 'failed' ? change.error : undefined;
  const [updated] = await db
    .update(runAttempts)
    .set({
      state: change.state,
      runtimeRef: change.runtimeRef,
      startedAt:
        change.state === 'running' && attempt.startedAt === null
          ? now
          : undefined,
      finishedAt: isTerminal(change.state) ? now : undefined,
      output: change.state === 'succeeded' ? json(change.output) : undefined,
      error: error && {
        category: error.category,
        code: error.code,
        message: error.message,
      },
    })
    .where(eq(runAttempts.id, attempt.id))
    .returning();
  return updated;
}

@Injectable()
export class DrizzleExecutionRepository implements ExecutionRepository {
  constructor(@InjectDrizzle() private readonly db: Database) {}

  create(
    scope: ExecutionScope,
    command: CreateExecution,
  ): Promise<CreateExecutionResult> {
    const { agentId, agentVersion, input, idempotencyKey, correlationId } =
      command;
    // Hash the same JSONB that is stored. Object key order and transport metadata
    // do not change the identity of a submission.
    const storedInput = json(input);
    const payload = sql`jsonb_build_array(${agentId}::text, ${agentVersion}::text, ${storedInput})`;
    const hash = sql<string>`encode(sha256(convert_to(${payload}::text, 'UTF8')), 'hex')`;

    return this.db.transaction(async (tx) => {
      const [run] = await tx
        .insert(runs)
        .values({
          workspaceId: scope.workspaceId,
          requesterId: scope.requesterId,
          agentId,
          agentVersion,
          input: storedInput,
          idempotencyKey,
          payloadHash: hash,
          correlationId,
        })
        .onConflictDoNothing({
          target: [runs.workspaceId, runs.requesterId, runs.idempotencyKey],
        })
        .returning(runColumns);

      if (!run) {
        const existing = await readSnapshot(
          tx,
          scope,
          eq(runs.idempotencyKey, idempotencyKey),
          eq(runs.payloadHash, hash),
        );
        if (!existing) {
          throw new IdempotencyConflictError(
            'The submission key belongs to a different payload.',
          );
        }
        return { created: false, snapshot: existing };
      }

      const attempt = await createAttempt(tx, run.id, 1);
      const snapshot = { run, attempt };
      await appendEvent(tx, snapshot, 'run.created');
      return { created: true, snapshot };
    }, transactionOptions);
  }

  findById(scope: ExecutionScope, runId: string) {
    return readSnapshot(this.db, scope, eq(runs.id, runId));
  }

  transition(
    scope: ExecutionScope,
    target: AttemptTarget,
    change: AttemptTransition,
  ): Promise<ExecutionSnapshot> {
    return this.db.transaction(async (tx) => {
      // Lock the parent first. The following read then sees the winning writer's attempt.
      const [run] = await tx
        .select(runColumns)
        .from(runs)
        .where(and(inScope(scope), eq(runs.id, target.runId)))
        .for('update');
      if (!run) {
        throw new ExecutionNotFoundError('Execution not found.');
      }
      if (run.lastEventSequence !== target.expectedSequence) {
        throw new ExecutionConflictError(
          'The execution has changed since the snapshot.',
        );
      }

      const [current] = await tx
        .select()
        .from(runAttempts)
        .where(eq(runAttempts.runId, run.id))
        .orderBy(desc(runAttempts.number))
        .limit(1);
      if (current?.id !== target.attemptId) {
        throw new ExecutionConflictError(
          'The target is not the current attempt.',
        );
      }
      const retry = change.state === 'failed' && change.retry === true;
      if (retry && run.state === 'unknown') {
        throw new ExecutionConflictError(
          'Reconcile the uncertain execution before retrying.',
        );
      }

      const updated = await updateAttempt(tx, current, change);
      const attempt = retry
        ? await createAttempt(tx, run.id, current.number + 1)
        : updated;
      const [updatedRun] = await tx
        .update(runs)
        .set({
          state: retry ? run.state : change.state,
          lastEventSequence: run.lastEventSequence + 1,
          updatedAt: now,
        })
        .where(eq(runs.id, run.id))
        .returning(runColumns);

      const snapshot = { run: updatedRun, attempt };
      if (retry) {
        await appendEvent(tx, snapshot, 'attempt.retried', {
          previousAttemptId: current.id,
        });
      } else {
        await appendEvent(tx, snapshot, 'attempt.state_changed');
      }
      return snapshot;
    }, transactionOptions);
  }
}

@Injectable()
export class DrizzleExecutionHistoryRepository implements ExecutionHistoryRepository {
  constructor(@InjectDrizzle() private readonly db: Database) {}

  listAttempts(
    scope: ExecutionScope,
    runId: string,
  ): Promise<ExecutionAttempt[]> {
    return this.db
      .select(getTableColumns(runAttempts))
      .from(runs)
      .innerJoin(runAttempts, eq(runAttempts.runId, runs.id))
      .where(and(inScope(scope), eq(runs.id, runId)))
      .orderBy(asc(runAttempts.number))
      .execute();
  }

  async listEvents(
    scope: ExecutionScope,
    runId: string,
    afterSequence: number,
    limit: number,
  ): Promise<ExecutionEvent[]> {
    if (
      !Number.isSafeInteger(afterSequence) ||
      afterSequence < 0 ||
      !Number.isSafeInteger(limit) ||
      limit < 1
    ) {
      throw new RangeError(
        'Expected a non-negative event cursor and a positive page size.',
      );
    }
    return this.db
      .select(getTableColumns(runEvents))
      .from(runs)
      .innerJoin(runEvents, eq(runEvents.runId, runs.id))
      .where(
        and(
          inScope(scope),
          eq(runs.id, runId),
          gt(runEvents.sequence, sql`${afterSequence}::bigint`),
        ),
      )
      .orderBy(asc(runEvents.sequence))
      .limit(limit);
  }
}
