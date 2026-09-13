import type { ActionOutcome, EngineAction, RunState } from './types.js';

export interface RuntimeContext {
  changeDir: string;
  state: RunState;
}

export interface RuntimeAdapter {
  readonly id: string;
  supports(action: EngineAction): boolean;
  execute(action: EngineAction, context: RuntimeContext): Promise<ActionOutcome>;
}
