import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { loadSkillPackage } from '../../../domains/skill/load.js';
import { validateSkillPackage } from '../../../domains/skill/validate.js';
import { createSkillSnapshot } from '../../../domains/skill/snapshot.js';
import { decide, recordOutcome, startRun } from '../../../domains/engine/loop.js';
import { readRunState, writeRunState } from '../../../domains/engine/state.js';
import {
  appendTrajectory,
  clearPendingAction,
  readArtifacts,
  readPendingAction,
  readTrajectory,
  writeArtifacts,
  writePendingAction,
} from '../../../domains/engine/run-store.js';
import type { RuntimeAdapter } from '../../../domains/engine/runtime-types.js';

describe('Skill Engine Foundation integration', () => {
  let root: string;
  let skillDir: string;
  let changeDir: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-foundation-'));
    skillDir = path.join(root, 'skill');
    changeDir = path.join(root, 'change');
    await fs.mkdir(path.join(skillDir, 'opensuper'), { recursive: true });
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Demo\n');
    await fs.writeFile(
      path.join(skillDir, 'opensuper', 'skill.yaml'),
      [
        'apiVersion: opensuper/v1alpha1',
        'kind: Skill',
        'metadata: { name: demo, version: "1", description: Demo }',
        'goal:',
        '  statement: Produce a plan',
        '  inputs: []',
        '  outputs: []',
        '  success: [plan exists]',
        'orchestration:',
        '  mode: deterministic',
        '  entry: plan',
        '  steps:',
        '    - id: plan',
        '      action: { type: invoke_skill, ref: writing-plans }',
        'skills: [{ id: writing-plans }]',
        'agents: []',
        'tools: []',
        '',
      ].join('\n'),
    );
    await fs.writeFile(path.join(changeDir, '.opensuper.yaml'), 'workflow: full\nphase: build\n');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('loads, validates, snapshots, persists and resumes one action', async () => {
    const pkg = await loadSkillPackage(skillDir);
    expect(validateSkillPackage(pkg)).toEqual([]);
    const snapshot = await createSkillSnapshot(pkg, changeDir);
    let state = startRun(pkg, 'run-1', snapshot.hash);
    const decision = decide(pkg, state, new Set());
    expect(decision.action).not.toBeNull();
    state = decision.state;

    await writePendingAction(changeDir, state.pendingRef, decision.action!);
    await writeRunState(changeDir, state);
    await appendTrajectory(changeDir, state.trajectoryRef, {
      sequence: 1,
      timestamp: '2026-06-13T00:00:00.000Z',
      type: 'action_proposed',
      runId: state.runId,
      data: { actionId: decision.action!.id },
    });

    const resumed = await readRunState(changeDir);
    const pending = await readPendingAction(changeDir, state.pendingRef);
    expect(resumed).toEqual(state);
    expect(pending).toEqual(decision.action);

    const adapter: RuntimeAdapter = {
      id: 'test',
      supports: () => true,
      execute: async (action) => ({
        actionId: action.id,
        status: 'succeeded',
        summary: 'plan written',
        artifacts: { plan: 'docs/plan.md' },
      }),
    };
    const outcome = await adapter.execute(pending!, { changeDir, state: resumed! });
    state = recordOutcome(pkg, resumed!, outcome);
    await writeArtifacts(changeDir, state.artifactsRef, outcome.artifacts ?? {});
    await appendTrajectory(changeDir, state.trajectoryRef, {
      sequence: 2,
      timestamp: '2026-06-13T00:00:01.000Z',
      type: 'action_completed',
      runId: state.runId,
      data: { actionId: outcome.actionId, status: outcome.status },
    });
    await writeRunState(changeDir, state);
    await clearPendingAction(changeDir, state.pendingRef);

    expect(await readRunState(changeDir)).toEqual(state);
    expect(await readArtifacts(changeDir, state.artifactsRef)).toEqual({
      plan: 'docs/plan.md',
    });
    expect(await readPendingAction(changeDir, state.pendingRef)).toBeNull();
    expect(await readTrajectory(changeDir, state.trajectoryRef)).toHaveLength(2);
    const raw = await fs.readFile(path.join(changeDir, '.opensuper.yaml'), 'utf8');
    expect(raw).toContain('workflow: full');
    expect(raw).toContain('phase: build');
  });

  it('advances through multiple deterministic steps until completion', async () => {
    await fs.writeFile(
      path.join(skillDir, 'opensuper', 'skill.yaml'),
      [
        'apiVersion: opensuper/v1alpha1',
        'kind: Skill',
        'metadata: { name: two-step, version: "1", description: Two steps }',
        'goal:',
        '  statement: Plan then implement',
        '  inputs: []',
        '  outputs: []',
        '  success: [done]',
        'orchestration:',
        '  mode: deterministic',
        '  entry: plan',
        '  steps:',
        '    - id: plan',
        '      next: implement',
        '      action: { type: invoke_skill, ref: writing-plans }',
        '    - id: implement',
        '      action: { type: invoke_skill, ref: executing-plans }',
        'skills: [{ id: writing-plans }, { id: executing-plans }]',
        'agents: []',
        'tools: []',
        '',
      ].join('\n'),
    );
    const pkg = await loadSkillPackage(skillDir);
    expect(validateSkillPackage(pkg)).toEqual([]);
    const snapshot = await createSkillSnapshot(pkg, changeDir);
    let state = startRun(pkg, 'run-multi', snapshot.hash);

    const adapter: RuntimeAdapter = {
      id: 'test',
      supports: () => true,
      execute: async (action) => ({
        actionId: action.id,
        status: 'succeeded',
        summary: `completed ${action.id}`,
        artifacts: {},
      }),
    };

    const d1 = decide(pkg, state, new Set());
    expect(d1.action).not.toBeNull();
    const o1 = await adapter.execute(d1.action!, { changeDir, state: d1.state });
    state = recordOutcome(pkg, d1.state, o1);

    const d2 = decide(pkg, state, new Set());
    expect(d2.action).not.toBeNull();
    const o2 = await adapter.execute(d2.action!, { changeDir, state: d2.state });
    state = recordOutcome(pkg, d2.state, o2);

    expect(state.status).toBe('completed');
    expect(state.iteration).toBe(2);
  });

  it('rejects outcome when run is already completed', async () => {
    const pkg = await loadSkillPackage(skillDir);
    const snapshot = await createSkillSnapshot(pkg, changeDir);
    let state = startRun(pkg, 'run-complete', snapshot.hash);

    const adapter: RuntimeAdapter = {
      id: 'test',
      supports: () => true,
      execute: async (action) => ({
        actionId: action.id,
        status: 'succeeded',
        summary: 'done',
        artifacts: {},
      }),
    };

    const decision = decide(pkg, state, new Set());
    const outcome = await adapter.execute(decision.action!, { changeDir, state: decision.state });
    state = recordOutcome(pkg, decision.state, outcome);

    expect(state.status).toBe('completed');
    expect(() => recordOutcome(pkg, state, outcome)).toThrow(
      'Outcome does not match pending action',
    );
  });
});
