import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { collectClassicEvidence } from './classic-evidence.js';
import { ensureClassicRun, type ClassicRunContext } from './classic-migrate.js';
import { resolveClassicStepId } from './classic-resolver.js';
import { readClassicState, writeClassicState, withClassicStateLock } from './classic-store.js';
import {
  CLASSIC_MIGRATION_VERSION,
  type ClassicState,
  type ClassicStateProjection,
} from './classic-state.js';
import { appendTrajectory, readTrajectory } from '../../domains/engine/run-store.js';
import type { RunState } from '../../domains/engine/types.js';
import { loadRuntimePackage, loadSkillPackage } from '../../domains/skill/load.js';
import { readSkillSnapshot } from '../../domains/skill/snapshot.js';
import type { SkillPackage } from '../../domains/skill/types.js';

async function directoryExists(directory: string): Promise<boolean> {
  try {
    return (await fs.stat(directory)).isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function fileExists(file: string): Promise<boolean> {
  try {
    return (await fs.stat(file)).isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function isClassicRuntimePackageRoot(root: string): Promise<boolean> {
  if (!(await directoryExists(root))) return false;
  if (await fileExists(path.join(root, 'skill.yaml'))) return true;
  return (
    (await fileExists(path.join(root, 'SKILL.md'))) &&
    (await fileExists(path.join(root, 'opensuper', 'skill.yaml')))
  );
}

function embeddedClassicRuntimePackage(root: string): SkillPackage {
  return {
    root,
    packageKind: 'runtime',
    definition: {
      apiVersion: 'opensuper/v1alpha1',
      kind: 'Skill',
      metadata: {
        name: 'opensuper-classic',
        version: '1',
        description:
          'Internal compatibility orchestration for classic OpenSuper full, hotfix, and tweak workflows',
      },
      goal: {
        statement:
          'Advance or restore a classic OpenSuper Run without changing the user command surface',
        inputs: [
          {
            name: 'classic-state',
            description: 'Validated ClassicState consistent with the Run projection',
            required: true,
          },
          {
            name: 'evidence',
            description: 'Structured evidence produced by the Classic Evidence collector',
            required: true,
          },
        ],
        outputs: [
          {
            name: 'run-state',
            description: 'Atomically synchronized Classic and Run state',
            required: true,
          },
        ],
        success: [
          'Legacy fields and Run fields remain consistent',
          'Every step invokes only a declared public OpenSuper Skill',
          'The completed state passes its completion eval',
        ],
      },
      orchestration: {
        mode: 'deterministic',
        entry: 'full.open',
        steps: [
          {
            id: 'full.open',
            action: { type: 'invoke_skill', ref: 'opensuper-open' },
            next: 'full.design.handoff',
          },
          {
            id: 'full.design.handoff',
            action: { type: 'invoke_skill', ref: 'opensuper-design' },
            next: 'full.design.document',
          },
          {
            id: 'full.design.document',
            action: { type: 'invoke_skill', ref: 'opensuper-design' },
            next: 'full.build.configure',
          },
          {
            id: 'full.build.plan',
            action: { type: 'invoke_skill', ref: 'opensuper-build' },
            next: 'full.build.plan-ready',
          },
          {
            id: 'full.build.plan-ready',
            action: { type: 'invoke_skill', ref: 'opensuper-build' },
            next: 'full.build.execute',
          },
          {
            id: 'full.build.configure',
            action: { type: 'invoke_skill', ref: 'opensuper-build' },
            next: 'full.build.plan',
          },
          {
            id: 'full.build.execute',
            action: { type: 'invoke_skill', ref: 'opensuper-build' },
            next: 'full.build.complete',
          },
          {
            id: 'full.build.complete',
            action: { type: 'invoke_skill', ref: 'opensuper-build' },
            next: 'full.verify.run',
          },
          {
            id: 'full.build.fix',
            action: { type: 'invoke_skill', ref: 'opensuper-build' },
            next: 'full.build.execute',
          },
          {
            id: 'full.verify.run',
            action: { type: 'invoke_skill', ref: 'opensuper-verify' },
            next: 'full.verify.branch',
          },
          {
            id: 'full.verify.branch',
            action: { type: 'invoke_skill', ref: 'opensuper-verify' },
            next: 'full.archive.confirm',
          },
          {
            id: 'full.archive.confirm',
            action: { type: 'invoke_skill', ref: 'opensuper-archive' },
            next: 'full.archive.execute',
          },
          {
            id: 'full.archive.execute',
            action: { type: 'invoke_skill', ref: 'opensuper-archive' },
            next: 'completed',
          },
          {
            id: 'hotfix.open',
            action: { type: 'invoke_skill', ref: 'opensuper-hotfix' },
            next: 'hotfix.build.execute',
          },
          {
            id: 'hotfix.build.execute',
            action: { type: 'invoke_skill', ref: 'opensuper-build' },
            next: 'hotfix.build.complete',
          },
          {
            id: 'hotfix.build.complete',
            action: { type: 'invoke_skill', ref: 'opensuper-build' },
            next: 'hotfix.verify.run',
          },
          {
            id: 'hotfix.verify.run',
            action: { type: 'invoke_skill', ref: 'opensuper-verify' },
            next: 'hotfix.verify.branch',
          },
          {
            id: 'hotfix.verify.branch',
            action: { type: 'invoke_skill', ref: 'opensuper-verify' },
            next: 'hotfix.archive.confirm',
          },
          {
            id: 'hotfix.archive.confirm',
            action: { type: 'invoke_skill', ref: 'opensuper-archive' },
            next: 'hotfix.archive.execute',
          },
          {
            id: 'hotfix.archive.execute',
            action: { type: 'invoke_skill', ref: 'opensuper-archive' },
            next: 'completed',
          },
          {
            id: 'tweak.open',
            action: { type: 'invoke_skill', ref: 'opensuper-tweak' },
            next: 'tweak.build.execute',
          },
          {
            id: 'tweak.build.execute',
            action: { type: 'invoke_skill', ref: 'opensuper-build' },
            next: 'tweak.build.complete',
          },
          {
            id: 'tweak.build.complete',
            action: { type: 'invoke_skill', ref: 'opensuper-build' },
            next: 'tweak.verify.run',
          },
          {
            id: 'tweak.verify.run',
            action: { type: 'invoke_skill', ref: 'opensuper-verify' },
            next: 'tweak.verify.branch',
          },
          {
            id: 'tweak.verify.branch',
            action: { type: 'invoke_skill', ref: 'opensuper-verify' },
            next: 'tweak.archive.confirm',
          },
          {
            id: 'tweak.archive.confirm',
            action: { type: 'invoke_skill', ref: 'opensuper-archive' },
            next: 'tweak.archive.execute',
          },
          {
            id: 'tweak.archive.execute',
            action: { type: 'invoke_skill', ref: 'opensuper-archive' },
            next: 'completed',
          },
          {
            id: 'completed',
            action: { type: 'checkpoint' },
            completionEvals: ['classic-completed'],
          },
        ],
      },
      skills: [
        { id: 'opensuper-open' },
        { id: 'opensuper-design' },
        { id: 'opensuper-build' },
        { id: 'opensuper-verify' },
        { id: 'opensuper-archive' },
        { id: 'opensuper-hotfix' },
        { id: 'opensuper-tweak' },
      ],
      agents: [],
      tools: [],
    },
    guardrails: {
      allowedSkills: [
        'opensuper-open',
        'opensuper-design',
        'opensuper-build',
        'opensuper-verify',
        'opensuper-archive',
        'opensuper-hotfix',
        'opensuper-tweak',
      ],
      allowedAgents: [],
      allowedTools: [],
      maxIterations: 500,
      maxRetriesPerAction: 3,
      confirmationRequiredFor: [],
    },
    evals: [
      {
        id: 'classic-completed',
        scope: 'completion',
        type: 'state_equals',
        field: 'status',
        equals: 'completed',
      },
    ],
  };
}

async function classicRuntimeRoot(): Promise<string | null> {
  const runtimeDirectory = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.OPENSUPER_RUNTIME_CLASSIC_ROOT,
    path.resolve(runtimeDirectory, '..', 'runtime', 'classic'),
    path.resolve(runtimeDirectory, '..', '..', 'opensuper', 'runtime', 'classic'),
    path.resolve(
      runtimeDirectory,
      '..',
      '..',
      'assets',
      'skills',
      'opensuper',
      'runtime',
      'classic',
    ),
    path.resolve('assets', 'skills', 'opensuper', 'runtime', 'classic'),
    process.env.OPENSUPER_CLASSIC_SKILL_ROOT,
    path.resolve(runtimeDirectory, '..', '..', 'opensuper-classic'),
    path.resolve(runtimeDirectory, '..', '..', 'assets', 'skills', 'opensuper-classic'),
    path.resolve('assets', 'skills', 'opensuper-classic'),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (await isClassicRuntimePackageRoot(candidate)) return candidate;
  }
  return null;
}

async function loadClassicRuntimePackage(root: string) {
  if (await fileExists(path.join(root, 'skill.yaml'))) {
    return loadRuntimePackage(root);
  }
  return loadSkillPackage(root);
}

export async function ensureClassicRuntimeRun(changeDir: string): Promise<ClassicRunContext> {
  const root = await classicRuntimeRoot();
  return ensureClassicRun(changeDir, {
    skillPackage: root
      ? await loadClassicRuntimePackage(root)
      : embeddedClassicRuntimePackage(path.dirname(fileURLToPath(import.meta.url))),
  });
}

export async function ensureStrictClassicRuntimeRun(changeDir: string): Promise<ClassicRunContext> {
  const projection = await readClassicState(changeDir);
  const unknownKeys = Array.from(new Set(projection.unknownKeys)).sort();
  if (unknownKeys.length > 0) {
    throw new Error(`Invalid Classic state: unknown field(s): ${unknownKeys.join(', ')}`);
  }
  return ensureClassicRuntimeRun(changeDir);
}

interface ValidatedClassicRuntime {
  classic: ClassicState;
  run: RunState;
  snapshotDir: string;
}

async function loadValidatedClassicRuntime(
  changeDir: string,
  projection: ClassicStateProjection,
): Promise<ValidatedClassicRuntime> {
  const unknownKeys = Array.from(new Set(projection.unknownKeys)).sort();
  if (unknownKeys.length > 0) {
    throw new Error(`Invalid Classic state: unknown field(s): ${unknownKeys.join(', ')}`);
  }
  if (!projection.classic || !projection.run) {
    throw new Error('Classic runtime validation requires synchronized Classic and Run projections');
  }
  if (projection.classic.classicMigration !== CLASSIC_MIGRATION_VERSION) {
    throw new Error('Classic Run exists without a supported classic_migration marker');
  }

  const root = await classicRuntimeRoot();
  const skillPackage = root
    ? await loadClassicRuntimePackage(root)
    : embeddedClassicRuntimePackage(path.dirname(fileURLToPath(import.meta.url)));
  if (projection.run.skill !== skillPackage.definition.metadata.name) {
    throw new Error(
      `Classic Run skill mismatch: expected ${skillPackage.definition.metadata.name}, got ${projection.run.skill}`,
    );
  }

  const snapshot = await readSkillSnapshot(changeDir, projection.run.skillHash);
  if (snapshot.definition.metadata.name !== projection.run.skill) {
    throw new Error(
      `Classic Run snapshot skill mismatch: expected ${projection.run.skill}, got ${snapshot.definition.metadata.name}`,
    );
  }
  return {
    classic: projection.classic,
    run: projection.run,
    snapshotDir: path.join(changeDir, '.opensuper', 'skill-snapshots', projection.run.skillHash),
  };
}

export async function validateClassicRuntimeRun(
  changeDir: string,
  existingProjection?: ClassicStateProjection,
): Promise<ClassicRunContext> {
  const projection = existingProjection ?? (await readClassicState(changeDir, { migrate: false }));
  const validated = await loadValidatedClassicRuntime(changeDir, projection);
  const evidence = await collectClassicEvidence(changeDir, projection);
  const currentStep = resolveClassicStepId(validated.classic, evidence);
  if (validated.run.currentStep !== currentStep) {
    throw new Error(
      `Classic Run step mismatch: expected ${currentStep}, got ${validated.run.currentStep}`,
    );
  }
  return { ...validated, evidence, migrated: false };
}

export interface ClassicRuntimeReconciliation {
  context: ClassicRunContext;
  reconciled: boolean;
  fromStep: string | null;
}

// Evidence edits (e.g. checking off the final tasks.md entry) advance the
// derived step without a state command, so the recorded currentStep can lag
// behind legitimate evidence progression. Re-sync it instead of failing like
// validateClassicRuntimeRun, which exists to diagnose drift, not to block on it.
export async function reconcileClassicRuntimeRun(
  changeDir: string,
  existingProjection?: ClassicStateProjection,
): Promise<ClassicRuntimeReconciliation> {
  return withClassicStateLock(changeDir, () =>
    reconcileClassicRuntimeRunLocked(changeDir, existingProjection),
  );
}

async function reconcileClassicRuntimeRunLocked(
  changeDir: string,
  existingProjection?: ClassicStateProjection,
): Promise<ClassicRuntimeReconciliation> {
  const projection = await readClassicState(changeDir, { migrate: false });
  if (existingProjection?.run && existingProjection.run.runId !== projection.run?.runId) {
    throw new Error('Classic reconciliation Run changed; reload the current state');
  }
  const validated = await loadValidatedClassicRuntime(changeDir, projection);
  const evidence = await collectClassicEvidence(changeDir, projection);
  const currentStep = resolveClassicStepId(validated.classic, evidence);
  if (validated.run.currentStep === currentStep) {
    return {
      context: { ...validated, evidence, migrated: false },
      reconciled: false,
      fromStep: null,
    };
  }
  const reconciledRun: RunState = {
    ...validated.run,
    currentStep,
    iteration: validated.run.iteration + 1,
    status: currentStep === 'completed' ? 'completed' : 'running',
  };
  await writeClassicState(changeDir, {
    classic: validated.classic,
    run: reconciledRun,
    unknownKeys: projection.unknownKeys,
  });
  const trajectory = await readTrajectory(changeDir, reconciledRun.trajectoryRef);
  await appendTrajectory(changeDir, reconciledRun.trajectoryRef, {
    sequence: trajectory.length + 1,
    timestamp: new Date().toISOString(),
    type: 'state_transitioned',
    runId: reconciledRun.runId,
    data: {
      kind: 'classic',
      fromStep: validated.run.currentStep,
      toStep: currentStep,
      source: 'record-check',
      reason: 'evidence-reconcile',
    },
  });
  return {
    context: { ...validated, run: reconciledRun, evidence, migrated: false },
    reconciled: true,
    fromStep: validated.run.currentStep,
  };
}

export async function transitionClassicRuntimeRun(
  changeDir: string,
  classic: ClassicState,
  run: RunState,
  data: Record<string, unknown>,
): Promise<RunState> {
  return withClassicStateLock(changeDir, () =>
    transitionClassicRuntimeRunLocked(changeDir, classic, run, data),
  );
}

async function transitionClassicRuntimeRunLocked(
  changeDir: string,
  classic: ClassicState,
  run: RunState,
  data: Record<string, unknown>,
): Promise<RunState> {
  const projection = await readClassicState(changeDir);
  if (!projection.classic || !projection.run) {
    throw new Error('Classic transition requires synchronized Classic and Run projections');
  }
  if (
    projection.run.runId !== run.runId ||
    projection.run.iteration !== run.iteration ||
    (classic.checkEpoch ?? 0) < (projection.classic.checkEpoch ?? 0)
  ) {
    throw new Error('Classic transition became stale; reload the current state');
  }

  const evidence = await collectClassicEvidence(changeDir, {
    classic,
    run,
    unknownKeys: projection.unknownKeys,
  });
  const currentStep = resolveClassicStepId(classic, evidence);
  const nextRun: RunState = {
    ...run,
    currentStep,
    iteration: run.iteration + 1,
    status: currentStep === 'completed' ? 'completed' : 'running',
  };

  await writeClassicState(changeDir, {
    classic,
    run: nextRun,
    unknownKeys: projection.unknownKeys,
  });

  const trajectory = await readTrajectory(changeDir, nextRun.trajectoryRef);
  await appendTrajectory(changeDir, nextRun.trajectoryRef, {
    sequence: trajectory.length + 1,
    timestamp: new Date().toISOString(),
    type: 'state_transitioned',
    runId: nextRun.runId,
    data: {
      kind: 'classic',
      fromStep: run.currentStep,
      toStep: currentStep,
      ...data,
    },
  });
  return nextRun;
}
