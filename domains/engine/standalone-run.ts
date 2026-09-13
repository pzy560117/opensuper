import path from 'path';
import {
  evaluateManualRun,
  resumeManualRun,
  startManualRun,
  upgradeManualRun,
  type ManualRunEvaluation,
  type ManualRunResult,
  type ManualRunUpgrade,
  type ResumeManualRunOptions,
} from './manual-run.js';
import type { RuntimeEvalDefinition, SkillPackage } from '../skill/types.js';

export interface StartStandaloneRunOptions {
  projectRoot: string;
  runId: string;
  confirmations?: Iterable<string>;
}

function validateRunId(runId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(runId)) {
    throw new Error(`Invalid standalone Run id: ${runId}`);
  }
}

export function standaloneRunDir(projectRoot: string, runId: string): string {
  validateRunId(runId);
  return path.resolve(projectRoot, '.opensuper', 'runs', runId);
}

export async function startStandaloneRun(
  pkg: SkillPackage,
  options: StartStandaloneRunOptions,
): Promise<ManualRunResult> {
  return startManualRun(pkg, standaloneRunDir(options.projectRoot, options.runId), {
    runId: options.runId,
    confirmations: options.confirmations ?? [],
  });
}

export async function resumeStandaloneRun(
  projectRoot: string,
  runId: string,
  options: ResumeManualRunOptions = {},
): Promise<ManualRunResult> {
  return resumeManualRun(standaloneRunDir(projectRoot, runId), options);
}

export async function evaluateStandaloneRun(
  projectRoot: string,
  runId: string,
  scope: RuntimeEvalDefinition['scope'],
): Promise<ManualRunEvaluation> {
  return evaluateManualRun(standaloneRunDir(projectRoot, runId), scope);
}

export async function upgradeStandaloneRun(
  projectRoot: string,
  runId: string,
  pkg: SkillPackage,
): Promise<ManualRunUpgrade> {
  return upgradeManualRun(standaloneRunDir(projectRoot, runId), pkg);
}
