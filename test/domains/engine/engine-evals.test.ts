import { describe, expect, it } from 'vitest';
import { evaluateRuntime } from '../../../domains/engine/evals.js';
import type { RunState } from '../../../domains/engine/types.js';
import type { RuntimeEvalDefinition } from '../../../domains/skill/types.js';

const state = { currentStep: 'done', status: 'running' } as RunState;

describe('evaluateRuntime', () => {
  it('returns evidence for artifact and state checks', () => {
    const defs: RuntimeEvalDefinition[] = [
      { id: 'report', scope: 'completion', type: 'artifact_exists', artifact: 'report' },
      {
        id: 'step',
        scope: 'completion',
        type: 'state_equals',
        field: 'currentStep',
        equals: 'done',
      },
    ];
    expect(evaluateRuntime(defs, 'completion', state, { report: 'report.md' })).toEqual([
      { evalId: 'report', passed: true, evidence: 'artifact report -> report.md' },
      { evalId: 'step', passed: true, evidence: 'state.currentStep = done' },
    ]);
  });
});
