import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import {
  evaluateManualRun,
  resumeManualRun,
  startManualRun,
  upgradeManualRun,
} from '../../../domains/engine/manual-run.js';
import {
  readArtifacts,
  readPendingAction,
  readTrajectory,
} from '../../../domains/engine/run-store.js';
import { readRunState } from '../../../domains/engine/state.js';
import { loadSkillPackage } from '../../../domains/skill/load.js';

async function writeSkill(
  root: string,
  options: {
    version?: string;
    mode?: 'deterministic' | 'adaptive';
    secondStep?: string;
    requireConfirmation?: boolean;
  } = {},
): Promise<void> {
  const version = options.version ?? '1.0.0';
  const mode = options.mode ?? 'deterministic';
  const secondStep = options.secondStep ?? 'finish';
  await fs.mkdir(path.join(root, 'opensuper'), { recursive: true });
  await fs.writeFile(path.join(root, 'SKILL.md'), `# Demo ${version}\n`);
  await fs.writeFile(
    path.join(root, 'opensuper', 'skill.yaml'),
    `apiVersion: opensuper/v1alpha1
kind: Skill
metadata:
  name: demo
  version: "${version}"
  description: Demo skill
goal:
  statement: Produce a report
  inputs: []
  outputs: []
  success: [Report exists]
orchestration:
  mode: ${mode}
${
  mode === 'deterministic'
    ? `  entry: draft
  steps:
    - id: draft
      action: { type: call_tool, ref: writer }
      next: ${secondStep}
    - id: ${secondStep}
      action: { type: checkpoint }
`
    : ''
}skills: []
agents: []
tools:
  - id: writer
    kind: function
    source: writeReport
    sideEffect: write
${options.requireConfirmation ? '    requiresConfirmation: true\n' : ''}`,
  );
  await fs.writeFile(
    path.join(root, 'opensuper', 'checks.yaml'),
    `runtime:
  - id: draft-artifact
    scope: step
    type: artifact_exists
    artifact: draft
  - id: report-artifact
    scope: completion
    type: artifact_exists
    artifact: report
`,
  );
}

describe('manual Skill run service', () => {
  let root: string;
  let skillRoot: string;
  let changeDir: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-manual-run-'));
    skillRoot = path.join(root, 'skill');
    changeDir = path.join(root, 'change');
    await writeSkill(skillRoot);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('starts a deterministic run and persists its first pending action', async () => {
    const pkg = await loadSkillPackage(skillRoot);

    const result = await startManualRun(pkg, changeDir);

    expect(result.state.status).toBe('waiting');
    expect(result.action).toMatchObject({ type: 'call_tool', ref: 'writer', stepId: 'draft' });
    expect(await readRunState(changeDir)).toEqual(result.state);
    expect(await readPendingAction(changeDir, result.state.pendingRef)).toEqual(result.action);
    expect(await readTrajectory(changeDir, result.state.trajectoryRef)).toMatchObject([
      { sequence: 1, type: 'run_started', runId: result.state.runId },
      { sequence: 2, type: 'action_proposed', runId: result.state.runId },
    ]);
  });

  it('returns the persisted pending action without loading the changed source Skill', async () => {
    const pkg = await loadSkillPackage(skillRoot);
    const started = await startManualRun(pkg, changeDir);
    await writeSkill(skillRoot, { version: '9.0.0' });

    const resumed = await resumeManualRun(changeDir);

    expect(resumed.action).toEqual(started.action);
    expect(resumed.state.skillVersion).toBe('1.0.0');
  });

  it('records outcomes, merges artifacts, evaluates, and advances to completion', async () => {
    const pkg = await loadSkillPackage(skillRoot);
    const started = await startManualRun(pkg, changeDir);

    const second = await resumeManualRun(changeDir, {
      outcome: {
        status: 'succeeded',
        summary: 'Draft written',
        artifacts: { draft: 'draft.md' },
        state: { reviewed: 'true' },
      },
    });

    expect(second.state.status).toBe('waiting');
    expect(second.action).toMatchObject({ type: 'checkpoint', stepId: 'finish' });
    expect(second.evals).toEqual([
      {
        evalId: 'draft-artifact',
        passed: true,
        evidence: 'artifact draft -> draft.md',
      },
    ]);

    const completed = await resumeManualRun(changeDir, {
      outcome: {
        status: 'succeeded',
        summary: 'Report complete',
        artifacts: { report: 'report.md' },
      },
    });

    expect(completed.state.status).toBe('completed');
    expect(completed.action).toBeNull();
    expect(completed.evals).toEqual([
      {
        evalId: 'draft-artifact',
        passed: true,
        evidence: 'artifact draft -> draft.md',
      },
      {
        evalId: 'report-artifact',
        passed: true,
        evidence: 'artifact report -> report.md',
      },
    ]);
    expect(await readArtifacts(changeDir, completed.state.artifactsRef)).toEqual({
      draft: 'draft.md',
      report: 'report.md',
    });
    expect(await readPendingAction(changeDir, completed.state.pendingRef)).toBeNull();
    expect(
      (await readTrajectory(changeDir, completed.state.trajectoryRef)).map((event) => event.type),
    ).toEqual([
      'run_started',
      'action_proposed',
      'action_completed',
      'eval_completed',
      'action_proposed',
      'action_completed',
      'eval_completed',
      'eval_completed',
    ]);
  });

  it('fails closed for adaptive runs and duplicate outcomes', async () => {
    await writeSkill(skillRoot, { mode: 'adaptive' });
    const adaptive = await loadSkillPackage(skillRoot);
    await expect(startManualRun(adaptive, changeDir)).rejects.toThrow(
      'Adaptive orchestration requires an Agent candidate',
    );

    await writeSkill(skillRoot);
    const deterministic = await loadSkillPackage(skillRoot);
    await startManualRun(deterministic, changeDir);
    await resumeManualRun(changeDir, {
      outcome: { status: 'succeeded', summary: 'Draft written' },
    });
    await resumeManualRun(changeDir, {
      outcome: { status: 'succeeded', summary: 'Report complete' },
    });

    await expect(
      resumeManualRun(changeDir, {
        outcome: { status: 'succeeded', summary: 'Duplicate' },
      }),
    ).rejects.toThrow('No pending action accepts an outcome');
  });

  it('evaluates the current snapshot on demand', async () => {
    const pkg = await loadSkillPackage(skillRoot);
    const started = await startManualRun(pkg, changeDir);
    await fs.writeFile(
      path.join(changeDir, started.state.artifactsRef),
      JSON.stringify({ draft: 'draft.md' }),
    );

    const result = await evaluateManualRun(changeDir, 'step');

    expect(result.evals).toEqual([
      {
        evalId: 'draft-artifact',
        passed: true,
        evidence: 'artifact draft -> draft.md',
      },
    ]);
  });

  it('upgrades only compatible runs without pending actions', async () => {
    await writeSkill(skillRoot, { requireConfirmation: true });
    const original = await loadSkillPackage(skillRoot);
    const started = await startManualRun(original, changeDir);
    expect(started.action).toBeNull();
    expect(started.reason).toBe('User confirmation required for: writer');

    await writeSkill(skillRoot, { version: '2.0.0', requireConfirmation: true });
    const compatible = await loadSkillPackage(skillRoot);
    const upgraded = await upgradeManualRun(changeDir, compatible);

    expect(upgraded.changed).toBe(true);
    expect(upgraded.state.skillVersion).toBe('2.0.0');
    expect((await readTrajectory(changeDir, upgraded.state.trajectoryRef)).at(-1)).toMatchObject({
      type: 'state_migrated',
      data: { kind: 'manual-skill-upgrade', fromVersion: '1.0.0', toVersion: '2.0.0' },
    });

    await writeSkill(skillRoot, {
      version: '3.0.0',
      secondStep: 'publish',
      requireConfirmation: true,
    });
    const incompatible = await loadSkillPackage(skillRoot);
    await expect(upgradeManualRun(changeDir, incompatible)).resolves.toMatchObject({
      changed: true,
    });

    const resumed = await resumeManualRun(changeDir, { confirmations: ['writer'] });
    await expect(upgradeManualRun(changeDir, compatible)).rejects.toThrow(
      'Cannot upgrade while an action is pending',
    );
    expect(resumed.action).not.toBeNull();
  });
});
