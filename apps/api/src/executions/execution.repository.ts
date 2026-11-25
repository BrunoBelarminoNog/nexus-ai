import type {
  ExecutionAttempt,
  ExecutionEvent,
  ExecutionFailure,
  ExecutionScope,
  ExecutionSnapshot,
  JsonValue,
} from './execution.js';

export interface CreateExecution {
  agentId: string;
  agentVersion: string;
  input: JsonValue;
  idempotencyKey: string;
  correlationId: string;
}

export interface CreateExecutionResult {
  created: boolean;
  snapshot: ExecutionSnapshot;
}

export interface AttemptTarget {
  runId: string;
  attemptId: string;
  expectedSequence: number;
}

export type AttemptTransition = { runtimeRef?: string } & (
  | { state: 'running' | 'unknown' | 'cancelled' }
  | { state: 'succeeded'; output: JsonValue }
  | { state: 'failed'; error: ExecutionFailure; retry?: boolean }
);

export abstract class ExecutionRepository {
  abstract create(
    scope: ExecutionScope,
    command: CreateExecution,
  ): Promise<CreateExecutionResult>;

  abstract findById(
    scope: ExecutionScope,
    runId: string,
  ): Promise<ExecutionSnapshot | null>;

  abstract transition(
    scope: ExecutionScope,
    target: AttemptTarget,
    change: AttemptTransition,
  ): Promise<ExecutionSnapshot>;
}

export abstract class ExecutionHistoryRepository {
  abstract listAttempts(
    scope: ExecutionScope,
    runId: string,
  ): Promise<ExecutionAttempt[]>;

  abstract listEvents(
    scope: ExecutionScope,
    runId: string,
    afterSequence: number,
    limit: number,
  ): Promise<ExecutionEvent[]>;
}

export class ExecutionNotFoundError extends Error {}
export class IdempotencyConflictError extends Error {}
export class ExecutionConflictError extends Error {}
