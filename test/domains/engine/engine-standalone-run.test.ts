import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import {
  evaluateStandaloneRun,
  resumeStandaloneRun,
  standaloneRunDir,
  startStandaloneRun,
} from '../../../domains/engine/standalone-run.js';
import { readArtifacts, readPendingAction } from '../../../domains/engine/run-store.js';
import { readRunState } from '../../../domains/engine/state.js';
import { loadSkillPackage } from '../../../domains/skill/load.js';

async function writeSkill(root: string): Promise<void> {
  await fs.mkdir(path.join(root, 'opensuper'), { recursive: true });
  await fs.writeFile(path.join(root, 'SKILL.md'), '# Demo\n');
  await fs.writeFile(
    path.join(root, 'opensuper', 'skill.yaml'),
    `apiVersion: opensuper/v1alpha1
kind: Skill
metadata:
  name: demo
  version: "1"
  description: Demo Skill
goal:
  statement: Complete the demo
  inputs: []
  outputs: []
  success: [Done]
orchestration:
  mode: deterministic
  entry: finish
  steps:
    - id: finish
      action: { type: checkpoint }
skills: []
agents: []
tools: []
`,
  );
  await fs.writeFile(
    path.join(root, 'opensuper', 'checks.yaml'),
    `runtime:
  - id: report
    scope: completion
    type: artifact_exists
    artifact: report
`,
  );
}

describe('standalone Skill runs', () => {
  let root: string;
  let projectRoot: string;
  let skillRoot: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-standalone-run-'));
    projectRoot = path.join(root, 'project');
    skillRoot = path.join(root, 'skill');
    await writeSkill(skillRoot);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('starts, resumes, and evaluates a run under .opensuper/runs/<run-id>', async () => {
    const pkg = await loadSkillPackage(skillRoot);
    const runDir = standaloneRunDir(projectRoot, 'demo-run');

    const started = await startStandaloneRun(pkg, {
      projectRoot,
      runId: 'demo-run',
    });
    const completed = await resumeStandaloneRun(projectRoot, 'demo-run', {
      outcome: {
        status: 'succeeded',
        summary: 'Finished',
        artifacts: { report: 'report.md' },
      },
    });
    const evaluated = await evaluateStandaloneRun(projectRoot, 'demo-run', 'completion');

    expect(started.state.runId).toBe('demo-run');
    expect(started.action).toMatchObject({ type: 'checkpoint', stepId: 'finish' });
    expect(await readRunState(runDir)).toEqual(completed.state);
    expect(await readPendingAction(runDir, completed.state.pendingRef)).toBeNull();
    expect(await readArtifacts(runDir, completed.state.artifactsRef)).toEqual({
      report: 'report.md',
    });
    expect(evaluated.evals).toEqual([
      { evalId: 'report', passed: true, evidence: 'artifact report -> report.md' },
    ]);
  });

  it('rejects unsafe standalone run ids before resolving a path', () => {
    expect(() => standaloneRunDir(projectRoot, '../escape')).toThrow(/Invalid standalone Run id/u);
    expect(() => standaloneRunDir(projectRoot, 'nested/path')).toThrow(
      /Invalid standalone Run id/u,
    );
  });
});
