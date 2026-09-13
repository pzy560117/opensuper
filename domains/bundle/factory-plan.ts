import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type {
  BundleAuthoringState,
  BundleFactoryCallChainItem,
  BundleFactoryMetadata,
  BundleFactoryOrderDeviation,
} from './types.js';
import type { SkillCreatorIntent } from './user-facing.js';
import {
  normalizeWorkflowDefinition,
  type WorkflowDefinitionInput,
  type WorkflowProtocol,
} from '../workflow-contract/index.js';

export interface BundleFactoryPlanFile {
  goal: string;
  preferredSkills?: string[];
  skillCreatorIntent?: SkillCreatorIntent;
  workflow: WorkflowDefinitionInput;
  deviations?: BundleFactoryOrderDeviation[];
  engineMode?: BundleFactoryMetadata['engineMode'];
  runnerMode?: BundleFactoryMetadata['runnerMode'];
  mode?: BundleAuthoringState['mode'];
  sourceRoot?: string;
  defaultLocale?: string;
  locales?: string[];
  engineEnabled?: boolean;
}

export interface NormalizedBundleFactoryPlan {
  goal: string;
  skillCreatorIntent: SkillCreatorIntent;
  preferredSkills: string[];
  callChain: BundleFactoryCallChainItem[];
  workflowDefinition: WorkflowDefinitionInput;
  workflowProtocol: WorkflowProtocol;
  deviations: BundleFactoryOrderDeviation[];
  engineMode: BundleFactoryMetadata['engineMode'];
  runnerMode: BundleFactoryMetadata['runnerMode'];
  mode: BundleAuthoringState['mode'];
  sourceRoot?: string;
  defaultLocale: string;
  locales: string[];
  engineEnabled: boolean;
}

interface PersistedBundleFactoryPlan extends Omit<NormalizedBundleFactoryPlan, 'callChain'> {
  schemaVersion: 1;
  workflow: WorkflowDefinitionInput;
}

const FACTORY_PLAN_FIELDS = new Set([
  'goal',
  'preferredSkills',
  'skillCreatorIntent',
  'workflow',
  'deviations',
  'engineMode',
  'runnerMode',
  'mode',
  'sourceRoot',
  'defaultLocale',
  'locales',
  'engineEnabled',
]);

function persistedFactoryPlan(plan: NormalizedBundleFactoryPlan): PersistedBundleFactoryPlan {
  return {
    schemaVersion: 1,
    goal: plan.goal,
    skillCreatorIntent: plan.skillCreatorIntent,
    preferredSkills: plan.preferredSkills,
    workflow: plan.workflowDefinition,
    workflowDefinition: plan.workflowDefinition,
    workflowProtocol: plan.workflowProtocol,
    deviations: plan.deviations,
    engineMode: plan.engineMode,
    runnerMode: plan.runnerMode,
    mode: plan.mode,
    ...(plan.sourceRoot ? { sourceRoot: plan.sourceRoot } : {}),
    defaultLocale: plan.defaultLocale,
    locales: plan.locales,
    engineEnabled: plan.engineEnabled,
  };
}

export function hashBundleFactoryPlan(plan: NormalizedBundleFactoryPlan): string {
  return createHash('sha256')
    .update(JSON.stringify(persistedFactoryPlan(plan), null, 2) + '\n')
    .digest('hex');
}

function ensureStringArray(value: unknown, label: string): string[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string' || item.length === 0)
  ) {
    throw new Error(`${label} must be a non-empty string array when provided`);
  }
  return value;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function normalizeCallChain(
  skills: string[],
  preferredSkills: string[],
): BundleFactoryCallChainItem[] {
  const preferredIndex = new Map(preferredSkills.map((skill, index) => [skill, index]));
  return skills.map((skill) => ({
    skill,
    preferenceIndex: preferredIndex.get(skill) ?? null,
  }));
}

function assertKnownFactoryPlanFields(plan: Record<string, unknown>, absolutePath: string): void {
  const unknown = Object.keys(plan).filter((field) => !FACTORY_PLAN_FIELDS.has(field));
  if (unknown.length === 0) return;
  throw new Error(
    `Invalid factory plan: ${absolutePath} unknown fields are not supported (${unknown.join(
      ', ',
    )})`,
  );
}

function assertValidDeviations(value: unknown, absolutePath: string): void {
  if (
    value !== undefined &&
    (!Array.isArray(value) ||
      value.some(
        (item) =>
          !item ||
          typeof item !== 'object' ||
          typeof item.skill !== 'string' ||
          typeof item.expectedIndex !== 'number' ||
          typeof item.actualIndex !== 'number' ||
          typeof item.reason !== 'string',
      ))
  ) {
    throw new Error(`Invalid factory plan: ${absolutePath} deviations must be structured objects`);
  }
}

export async function readBundleFactoryPlan(filePath: string): Promise<BundleFactoryPlanFile> {
  const absolutePath = path.resolve(filePath);
  const value = JSON.parse(await fs.readFile(absolutePath, 'utf8')) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid factory plan: ${absolutePath}`);
  }
  const plan = value as Partial<BundleFactoryPlanFile> & Record<string, unknown>;
  assertKnownFactoryPlanFields(plan, absolutePath);
  if (typeof plan.goal !== 'string' || plan.goal.length === 0) {
    throw new Error(`Invalid factory plan: ${absolutePath} must include goal`);
  }
  if (!plan.workflow || typeof plan.workflow !== 'object' || Array.isArray(plan.workflow)) {
    throw new Error(`Invalid factory plan: ${absolutePath} must include workflow`);
  }
  normalizeWorkflowDefinition(plan.workflow as WorkflowDefinitionInput);
  if (plan.preferredSkills !== undefined) {
    ensureStringArray(plan.preferredSkills, 'preferredSkills');
  }
  if (plan.locales !== undefined) {
    ensureStringArray(plan.locales, 'locales');
  }
  assertValidDeviations(plan.deviations, absolutePath);
  return plan as BundleFactoryPlanFile;
}

export function normalizeBundleFactoryPlan(options: {
  plan: BundleFactoryPlanFile;
  projectPreferredSkills?: string[] | null;
}): NormalizedBundleFactoryPlan {
  const { plan } = options;
  assertKnownFactoryPlanFields(plan as unknown as Record<string, unknown>, '<inline factory plan>');
  const workflow = normalizeWorkflowDefinition(plan.workflow);
  const preferredSkills = dedupe([
    ...(plan.preferredSkills ?? options.projectPreferredSkills ?? []),
    ...workflow.requiredSkills,
  ]);
  const planMode = plan.mode ?? 'create';
  if (planMode === 'optimize' && !plan.sourceRoot) {
    throw new Error('factory plan sourceRoot is required for optimize mode');
  }
  const skillCreatorIntent =
    plan.skillCreatorIntent ??
    (workflow.protocol.kind === 'opensuper-five-phase-overlay'
      ? 'customize-opensuper'
      : planMode === 'optimize'
        ? 'upgrade-existing'
        : 'new-skill');
  const defaultLocale = plan.defaultLocale ?? 'en';
  const locales = dedupe(plan.locales ?? [defaultLocale]);
  const engineMode = plan.engineMode ?? 'deterministic';

  return {
    goal: plan.goal,
    skillCreatorIntent,
    preferredSkills,
    callChain: normalizeCallChain(workflow.requiredSkills, preferredSkills),
    workflowDefinition: workflow.input,
    workflowProtocol: workflow.protocol,
    deviations: structuredClone(plan.deviations ?? []),
    engineMode,
    runnerMode: plan.runnerMode ?? 'standalone',
    mode: planMode,
    ...(plan.sourceRoot ? { sourceRoot: plan.sourceRoot } : {}),
    defaultLocale,
    locales,
    engineEnabled: plan.engineEnabled ?? engineMode !== 'none',
  };
}

function factoryPlanPath(projectRoot: string, name: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(name)) {
    throw new Error(`Invalid Bundle name: ${name}`);
  }
  return path.resolve(projectRoot, '.opensuper', 'bundle-factory-plans', name, 'plan.json');
}

export async function writeBundleFactoryPlanArtifact(options: {
  projectRoot: string;
  name: string;
  plan: NormalizedBundleFactoryPlan;
}): Promise<{ planPath: string; planHash: string }> {
  const planPath = factoryPlanPath(options.projectRoot, options.name);
  const document = persistedFactoryPlan(options.plan);
  const content = JSON.stringify(document, null, 2) + '\n';
  const temporary = path.join(path.dirname(planPath), `.plan.${randomUUID()}.tmp`);
  await fs.mkdir(path.dirname(planPath), { recursive: true });
  try {
    await fs.writeFile(temporary, content, { encoding: 'utf8', flag: 'wx' });
    await fs.rename(temporary, planPath);
  } finally {
    await fs.rm(temporary, { force: true });
  }
  return {
    planPath,
    planHash: hashBundleFactoryPlan(options.plan),
  };
}
