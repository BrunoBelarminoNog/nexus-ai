import { randomUUID } from 'node:crypto';
import { AppModule } from '../../apps/api/src/app.module.js';
import type {
  ExecutionFailure,
  ExecutionSnapshot,
} from '../../apps/api/src/executions/execution.js';
import {
  ExecutionConflictError,
  ExecutionHistoryRepository,
  ExecutionNotFoundError,
  ExecutionRepository,
  IdempotencyConflictError,
  type CreateExecution,
} from '../../apps/api/src/executions/execution.repository.js';
import {
  createDatabaseContext,
  createPostgresFixture,
} from '../../apps/api/test/support/postgres-fixture.js';

const scope = { workspaceId: 'workspace-a', requesterId: 'requester-a' };
const toolFailure: ExecutionFailure = {
  category: 'tool',
  code: 'FIXTURE_UNAVAILABLE',
  message: 'Synthetic fixture unavailable.',
};

function submission(): CreateExecution {
  return {
    agentId: 'incidentlab',
    agentVersion: '1.0.0',
    input: { incident: { id: 'synthetic-1', signals: ['timeout', 'retry'] } },
    correlationId: randomUUID(),
    idempotencyKey: randomUUID(),
  };
}

function target({ run, attempt }: ExecutionSnapshot) {
  return {
    runId: run.id,
    attemptId: attempt.id,
    expectedSequence: run.lastEventSequence,
  };
}

describe.sequential('execution persistence on PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createPostgresFixture>>;
  let application: Awaited<ReturnType<typeof createDatabaseContext>>;
  let executions: ExecutionRepository;
  let history: ExecutionHistoryRepository;

  beforeAll(async () => {
    fixture = await createPostgresFixture();
    await fixture.migrate();
    vi.stubEnv('DATABASE_URL', fixture.connectionString);
    application = await createDatabaseContext(AppModule);
    executions = application.context.get(ExecutionRepository);
    history = application.context.get(ExecutionHistoryRepository);
  });

  afterAll(async () => {
    try {
      await application?.context.close();
    } finally {
      vi.unstubAllEnvs();
      await fixture?.close();
    }
  });

  it('persists a versioned run, its first attempt and a consistent event cursor', async () => {
    const command = submission();
    const { created, snapshot } = await executions.create(scope, command);
    const { run, attempt } = snapshot;
    expect(created).toBe(true);
    expect(run).toMatchObject({
      ...scope,
      agentId: command.agentId,
      agentVersion: command.agentVersion,
      input: command.input,
      state: 'pending',
      lastEventSequence: 1,
      createdAt: expect.any(Date),
    });
    expect(run).not.toHaveProperty('idempotencyKey');
    expect(run).not.toHaveProperty('payloadHash');
    expect(attempt).toMatchObject({
      runId: run.id,
      number: 1,
      state: 'pending',
      startedAt: null,
      finishedAt: null,
      output: null,
      error: null,
    });
    expect(await executions.findById(scope, run.id)).toEqual(snapshot);

    const running = await executions.transition(scope, target(snapshot), {
      state: 'running',
      runtimeRef: 'runtime-1',
    });
    const output = { summary: 'Resolved synthetic incident.' };
    const done = await executions.transition(scope, target(running), {
      state: 'succeeded',
      output,
    });
    expect(done.run).toMatchObject({
      id: run.id,
      state: 'succeeded',
      lastEventSequence: 3,
    });
    expect(done.attempt).toMatchObject({
      id: attempt.id,
      runtimeRef: 'runtime-1',
      output,
      startedAt: running.attempt.startedAt,
      finishedAt: expect.any(Date),
    });
    expect(await executions.findById(scope, run.id)).toEqual(done);
    expect(
      await executions.create(scope, {
        ...command,
        correlationId: randomUUID(),
      }),
    ).toEqual({ created: false, snapshot: done });
    await expect(
      executions.transition(scope, target(done), { state: 'running' }),
    ).rejects.toThrow(ExecutionConflictError);

    const events = await history.listEvents(scope, run.id, 0, 10);
    expect(events.map((e) => [e.sequence, e.type, e.data.runState])).toEqual([
      [1, 'run.created', 'pending'],
      [2, 'attempt.state_changed', 'running'],
      [3, 'attempt.state_changed', 'succeeded'],
    ]);
    for (const event of events) {
      expect(event).toMatchObject({
        runId: run.id,
        attemptId: attempt.id,
        schemaVersion: 1,
        correlationId: command.correlationId,
        occurredAt: expect.any(Date),
      });
    }
    expect(await history.listEvents(scope, run.id, 1, 1)).toEqual([events[1]]);
    expect(
      await history.listEvents(scope, run.id, done.run.lastEventSequence, 1),
    ).toEqual([]);
    expect(
      await history.listEvents(scope, run.id, Number.MAX_SAFE_INTEGER, 1),
    ).toEqual([]);
    await expect(history.listEvents(scope, run.id, -1, 1)).rejects.toThrow(
      RangeError,
    );
    await expect(history.listEvents(scope, run.id, 0, 0)).rejects.toThrow(
      RangeError,
    );
  });

  it('deduplicates concurrent submissions by normalized input, agent and version', async () => {
    const command = submission();
    const repeated = {
      ...command,
      input: { incident: { signals: ['timeout', 'retry'], id: 'synthetic-1' } },
      correlationId: randomUUID(),
    };
    const results = await Promise.all([
      executions.create(scope, command),
      executions.create(scope, repeated),
    ]);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(results[0].snapshot).toEqual(results[1].snapshot);
    const { id } = results[0].snapshot.run;
    for (const different of [
      { agentId: 'another-agent' },
      { agentVersion: '2.0.0' },
      {
        input: {
          incident: { id: 'synthetic-1', signals: ['retry', 'timeout'] },
        },
      },
    ]) {
      await expect(
        executions.create(scope, { ...command, ...different }),
      ).rejects.toThrow(IdempotencyConflictError);
    }
    expect(await history.listAttempts(scope, id)).toHaveLength(1);
    expect(await history.listEvents(scope, id, 0, 10)).toHaveLength(1);
  });

  it('rejects a competing submission with the same key and different input', async () => {
    const command = submission();
    const results = await Promise.allSettled([
      executions.create(scope, command),
      executions.create(scope, {
        ...command,
        input: { incident: 'different' },
      }),
    ]);
    const accepted = results.filter((r) => r.status === 'fulfilled');
    expect(accepted).toHaveLength(1);
    expect(accepted[0].value.created).toBe(true);
    expect(results).toContainEqual({
      status: 'rejected',
      reason: expect.any(IdempotencyConflictError),
    });
    const { run, attempt } = accepted[0].value.snapshot;
    expect(await history.listAttempts(scope, run.id)).toEqual([attempt]);
    expect(await history.listEvents(scope, run.id, 0, 10)).toHaveLength(1);
  });

  it.each([
    { ...scope, workspaceId: 'workspace-b' },
    { ...scope, requesterId: 'requester-b' },
  ])(
    'isolates executions and submission keys from $workspaceId/$requesterId',
    async (other) => {
      const command = submission();
      const { snapshot } = await executions.create(scope, command);
      expect(await executions.findById(other, snapshot.run.id)).toBeNull();
      expect(await history.listAttempts(other, snapshot.run.id)).toEqual([]);
      expect(await history.listEvents(other, snapshot.run.id, 0, 10)).toEqual(
        [],
      );
      await expect(
        executions.transition(other, target(snapshot), { state: 'running' }),
      ).rejects.toThrow(ExecutionNotFoundError);
      const separate = await executions.create(other, command);
      expect(separate.created).toBe(true);
      expect(separate.snapshot.run.id).not.toBe(snapshot.run.id);
    },
  );

  it('records a confirmed failure and opens exactly one new attempt under competing retries', async () => {
    const { snapshot } = await executions.create(scope, submission());
    const running = await executions.transition(scope, target(snapshot), {
      state: 'running',
      runtimeRef: 'attempt-one',
    });
    const error = { ...toolFailure, debug: 'private fixture data' };
    const retry = () =>
      executions.transition(scope, target(running), {
        state: 'failed',
        error,
        retry: true,
      });
    const results = await Promise.allSettled([retry(), retry()]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results).toContainEqual({
      status: 'rejected',
      reason: expect.any(ExecutionConflictError),
    });

    const retried = (await executions.findById(scope, running.run.id))!;
    expect(retried.run).toMatchObject({
      id: running.run.id,
      state: 'running',
      lastEventSequence: 3,
    });
    expect(retried.attempt).toMatchObject({
      runId: running.run.id,
      number: 2,
      state: 'pending',
      runtimeRef: null,
      startedAt: null,
    });
    expect(retried.attempt.id).not.toBe(running.attempt.id);
    expect(await history.listAttempts(scope, running.run.id)).toEqual([
      {
        ...running.attempt,
        state: 'failed',
        finishedAt: expect.any(Date),
        error: toolFailure,
      },
      retried.attempt,
    ]);
    expect(
      await history.listEvents(scope, running.run.id, 2, 10),
    ).toMatchObject([
      {
        attemptId: retried.attempt.id,
        type: 'attempt.retried',
        data: { previousAttemptId: running.attempt.id },
      },
    ]);
    await expect(
      executions.transition(
        scope,
        { ...target(retried), attemptId: running.attempt.id },
        { state: 'running' },
      ),
    ).rejects.toThrow(ExecutionConflictError);

    const next = await executions.transition(scope, target(retried), {
      state: 'running',
      runtimeRef: 'attempt-two',
    });
    const done = await executions.transition(scope, target(next), {
      state: 'succeeded',
      output: null,
    });
    expect(done.run).toMatchObject({
      state: 'succeeded',
      lastEventSequence: 5,
    });
    expect(done.attempt).toMatchObject({
      number: 2,
      state: 'succeeded',
      output: null,
    });
  });

  it('reconciles uncertainty, preserves runtime identity and only records confirmed cancellation', async () => {
    const { snapshot } = await executions.create(scope, {
      ...submission(),
      input: null,
    });
    await expect(
      executions.transition(scope, target(snapshot), {
        state: 'succeeded',
        output: null,
      }),
    ).rejects.toThrow(ExecutionConflictError);
    const uncertain = await executions.transition(scope, target(snapshot), {
      state: 'unknown',
    });
    await expect(
      executions.transition(scope, target(uncertain), {
        state: 'failed',
        error: toolFailure,
        retry: true,
      }),
    ).rejects.toThrow(ExecutionConflictError);
    const running = await executions.transition(scope, target(uncertain), {
      state: 'running',
      runtimeRef: 'confirmed-ref',
    });
    const lost = await executions.transition(scope, target(running), {
      state: 'unknown',
    });
    await expect(
      executions.transition(scope, target(lost), {
        state: 'running',
        runtimeRef: 'different-ref',
      }),
    ).rejects.toThrow(ExecutionConflictError);
    const confirmed = await executions.transition(scope, target(lost), {
      state: 'cancelled',
    });
    expect(confirmed.attempt).toMatchObject({
      state: 'cancelled',
      startedAt: running.attempt.startedAt,
      finishedAt: expect.any(Date),
    });
    await expect(
      executions.transition(scope, target(confirmed), { state: 'running' }),
    ).rejects.toThrow(ExecutionConflictError);
    expect(await history.listAttempts(scope, confirmed.run.id)).toEqual([
      confirmed.attempt,
    ]);
  });

  it('can finalize a failure before dispatch without reopening a terminal run', async () => {
    const { snapshot } = await executions.create(scope, submission());
    const error = { ...toolFailure, category: 'platform' } as const;
    const failed = await executions.transition(scope, target(snapshot), {
      state: 'failed',
      error,
    });
    expect(failed.attempt).toMatchObject({
      error,
      state: 'failed',
      startedAt: null,
      finishedAt: expect.any(Date),
    });
    await expect(
      executions.transition(scope, target(failed), {
        state: 'failed',
        error,
        retry: true,
      }),
    ).rejects.toThrow(ExecutionConflictError);
    expect(await executions.findById(scope, failed.run.id)).toEqual(failed);
  });

  it('enforces parentage, attempt numbering, one active attempt and event sequence in PostgreSQL', async () => {
    const { snapshot: a } = await executions.create(scope, submission());
    const { snapshot: b } = await executions.create(scope, submission());
    const client = fixture.db.$client;
    const insertAttempt =
      'INSERT INTO nexus.run_attempts (run_id, number) VALUES ($1, $2)';
    await expect(
      client.query(insertAttempt, [randomUUID(), 1]),
    ).rejects.toMatchObject({ code: '23503' });
    await expect(
      client.query(insertAttempt, [a.run.id, 2]),
    ).rejects.toMatchObject({ constraint: 'run_attempts_one_active' });
    await expect(
      client.query(
        "INSERT INTO nexus.run_attempts (run_id, number, state, finished_at) VALUES ($1, 1, 'cancelled', statement_timestamp())",
        [a.run.id],
      ),
    ).rejects.toMatchObject({ constraint: 'run_attempts_run_number' });
    const insertEvent =
      "INSERT INTO nexus.run_events (run_id, attempt_id, sequence, type, correlation_id, data) VALUES ($1, $2, $3, 'run.created', 'fixture', '{}')";
    await expect(
      client.query(insertEvent, [a.run.id, b.attempt.id, 2]),
    ).rejects.toMatchObject({ constraint: 'run_events_run_attempt_fk' });
    await expect(
      client.query(insertEvent, [a.run.id, a.attempt.id, 1]),
    ).rejects.toMatchObject({ constraint: 'run_events_run_sequence' });
    await expect(
      client.query(
        "UPDATE nexus.run_attempts SET state = 'running' WHERE id = $1",
        [a.attempt.id],
      ),
    ).rejects.toMatchObject({ constraint: 'run_attempts_start_valid' });
    expect(await executions.findById(scope, a.run.id)).toEqual(a);
  });

  it('rolls back creation, retry and cursor updates when the final event insert fails', async () => {
    const command = submission();
    const { snapshot } = await executions.create(scope, submission());
    const running = await executions.transition(scope, target(snapshot), {
      state: 'running',
    });
    const rejected = {
      cause: { code: '23514', constraint: 'reject_test_event' },
    };
    await fixture.db.execute(
      'ALTER TABLE nexus.run_events ADD CONSTRAINT reject_test_event CHECK (false) NOT VALID',
    );
    try {
      await expect(executions.create(scope, command)).rejects.toMatchObject(
        rejected,
      );
      await expect(
        executions.transition(scope, target(running), {
          state: 'failed',
          error: toolFailure,
          retry: true,
        }),
      ).rejects.toMatchObject(rejected);
    } finally {
      await fixture.db.execute(
        'ALTER TABLE nexus.run_events DROP CONSTRAINT reject_test_event',
      );
    }
    expect(await executions.findById(scope, running.run.id)).toEqual(running);
    expect(await history.listAttempts(scope, running.run.id)).toEqual([
      running.attempt,
    ]);
    expect(
      await history.listEvents(
        scope,
        running.run.id,
        running.run.lastEventSequence,
        10,
      ),
    ).toEqual([]);
    const rows = await fixture.db.$client.query(
      'SELECT id FROM nexus.runs WHERE idempotency_key = $1',
      [command.idempotencyKey],
    );
    expect(rows.rows).toEqual([]);
    expect((await executions.create(scope, command)).created).toBe(true);
  });
});
