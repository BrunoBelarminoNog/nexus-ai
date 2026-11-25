export const executionStates = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'unknown',
] as const;

export type ExecutionState = (typeof executionStates)[number];
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface ExecutionScope {
  workspaceId: string;
  requesterId: string;
}

export interface Execution extends ExecutionScope {
  id: string;
  agentId: string;
  agentVersion: string;
  input: JsonValue;
  correlationId: string;
  state: ExecutionState;
  lastEventSequence: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionFailure {
  category: 'platform' | 'provider' | 'tool';
  code: string;
  message: string;
}

export interface ExecutionAttempt {
  id: string;
  runId: string;
  number: number;
  state: ExecutionState;
  runtimeRef: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  output: JsonValue;
  error: ExecutionFailure | null;
}

export interface ExecutionSnapshot {
  run: Execution;
  attempt: ExecutionAttempt;
}

export interface ExecutionEvent {
  id: string;
  runId: string;
  attemptId: string;
  sequence: number;
  type: 'run.created' | 'attempt.state_changed' | 'attempt.retried';
  schemaVersion: number;
  correlationId: string;
  occurredAt: Date;
  data: { [key: string]: JsonValue };
}

const nextStates: Record<ExecutionState, readonly ExecutionState[]> = {
  pending: ['running', 'failed', 'unknown'],
  running: ['succeeded', 'failed', 'cancelled', 'unknown'],
  unknown: ['running', 'succeeded', 'failed', 'cancelled'],
  succeeded: [],
  failed: [],
  cancelled: [],
};

export function canTransition(from: ExecutionState, to: ExecutionState) {
  return nextStates[from].includes(to);
}

export function isTerminal(state: ExecutionState) {
  return nextStates[state].length === 0;
}
