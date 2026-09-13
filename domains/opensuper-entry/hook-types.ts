import type { OpenSuperWorkflow } from './types.js';

export type OpenSuperHookIntent = 'context' | 'write' | 'non-write' | 'unknown';

export interface OpenSuperHookRequest {
  intent: OpenSuperHookIntent;
  targets: string[];
  toolName: string | null;
  task?: string;
  cwd?: string;
  sessionId?: string;
}

export interface OpenSuperHookDecision {
  allowed: boolean;
  reason: string;
  workflow?: OpenSuperWorkflow;
  change?: string;
  phase?: string;
  context?: string;
}

export interface OpenSuperHookProcessOutput {
  exitCode: number;
  stdout: string;
  stderr: string;
}
