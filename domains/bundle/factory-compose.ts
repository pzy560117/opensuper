import { promises as fs } from 'fs';
import path from 'path';
import { parse } from 'yaml';
import type { BundleCandidateSource } from './candidates.js';
import type {
  BundleFactoryCallChainItem,
  BundleFactoryComposition,
  BundleFactoryCompositionChoice,
  BundleFactoryCompositionIssue,
  BundleFactoryCompositionStep,
  BundleFactoryResolvedSkill,
} from './types.js';

type FlowStep = { use: string } | { choose: { id: string; options: string[] } };

interface AvailableSkill {
  resolved: BundleFactoryResolvedSkill;
  source: BundleCandidateSource;
}

interface ExpansionContext {
  source: BundleFactoryCompositionStep['source'];
  fromSkill?: string;
  choiceId?: string;
}

export interface ComposeBundleFactoryPlanInput {
  entrySkills?: string[];
  preferredSkills: string[];
  resolvedSkills: BundleFactoryResolvedSkill[];
}

export interface ComposeBundleFactoryPlanResult {
  callChain: BundleFactoryCallChainItem[];
  composition: BundleFactoryComposition;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stepShapeError(filePath: string, index: number): Error {
  return new Error(
    `${filePath}: steps[${index}] must be {use: string} or {choose: {id: string, options: string[]}}`,
  );
}

function narrowFlowDocument(document: unknown, filePath: string): FlowStep[] {
  if (!isRecord(document)) {
    throw new Error(`${filePath}: document must be an object`);
  }
  const topLevelKeys = Object.keys(document);
  const unknownTopLevelKey = topLevelKeys.find((key) => key !== 'steps');
  if (unknownTopLevelKey) {
    throw new Error(`${filePath}: unknown top-level field ${unknownTopLevelKey}`);
  }
  const steps = document.steps;
  if (!Array.isArray(steps)) {
    throw new Error(`${filePath}: steps must be an array`);
  }
  return steps.map((step, index): FlowStep => {
    if (!isRecord(step)) {
      throw new Error(`${filePath}: steps[${index}] must be an object`);
    }
    const keys = Object.keys(step);
    if ('use' in step) {
      if (keys.length !== 1) throw stepShapeError(filePath, index);
      if (typeof step.use !== 'string') {
        throw new Error(`${filePath}: steps[${index}].use must be a string`);
      }
      return { use: step.use };
    }
    if ('choose' in step) {
      if (keys.length !== 1) throw stepShapeError(filePath, index);
      if (!isRecord(step.choose)) {
        throw new Error(`${filePath}: steps[${index}].choose must be an object`);
      }
      const choose = step.choose;
      const chooseKeys = Object.keys(choose);
      if (!chooseKeys.includes('id')) {
        throw new Error(`${filePath}: steps[${index}].choose.id must be a string`);
      }
      if (typeof choose.id !== 'string') {
        throw new Error(`${filePath}: steps[${index}].choose.id must be a string`);
      }
      if (!chooseKeys.includes('options')) {
        throw new Error(`${filePath}: steps[${index}].choose.options must be a string array`);
      }
      if (!Array.isArray(choose.options)) {
        throw new Error(`${filePath}: steps[${index}].choose.options must be a string array`);
      }
      const invalidOptionIndex = choose.options.findIndex((option) => typeof option !== 'string');
      if (invalidOptionIndex !== -1) {
        throw new Error(
          `${filePath}: steps[${index}].choose.options[${invalidOptionIndex}] must be a string`,
        );
      }
      if (chooseKeys.some((key) => key !== 'id' && key !== 'options')) {
        throw new Error(`${filePath}: steps[${index}].choose must contain only id and options`);
      }
      return { choose: { id: choose.id, options: choose.options } };
    }
    throw stepShapeError(filePath, index);
  });
}

async function readFlowSteps(root: string): Promise<FlowStep[] | null> {
  const flowPath = path.join(root, 'opensuper', 'flow.yaml');
  let source: string;
  try {
    source = await fs.readFile(flowPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }

  let document: unknown;
  try {
    document = parse(source) as unknown;
  } catch (error) {
    throw new Error(`${flowPath}: ${(error as Error).message}`, { cause: error });
  }
  return narrowFlowDocument(document, flowPath);
}

function buildAvailableSkills(
  resolvedSkills: BundleFactoryResolvedSkill[],
): Map<string, AvailableSkill> {
  const available = new Map<string, AvailableSkill>();
  for (const resolved of resolvedSkills) {
    if (resolved.status !== 'available' || resolved.sources.length !== 1) continue;
    const source = resolved.sources[0];
    const value = { resolved, source };
    available.set(resolved.query, value);
    if (!available.has(source.name)) available.set(source.name, value);
  }
  return available;
}

function buildResolvedSkills(
  resolvedSkills: BundleFactoryResolvedSkill[],
  availableSkills: Map<string, AvailableSkill>,
): Map<string, BundleFactoryResolvedSkill> {
  const resolvedBySkill = new Map<string, BundleFactoryResolvedSkill>();
  for (const resolved of resolvedSkills) {
    resolvedBySkill.set(resolved.query, resolved);
  }
  for (const [skill, available] of availableSkills) {
    if (!resolvedBySkill.has(skill)) resolvedBySkill.set(skill, available.resolved);
  }
  return resolvedBySkill;
}

export async function composeBundleFactoryPlan(
  input: ComposeBundleFactoryPlanInput,
): Promise<ComposeBundleFactoryPlanResult> {
  const preferredIndex = new Map(input.preferredSkills.map((skill, index) => [skill, index]));
  const availableSkills = buildAvailableSkills(input.resolvedSkills);
  const resolvedBySkill = buildResolvedSkills(input.resolvedSkills, availableSkills);
  const callChain: BundleFactoryCallChainItem[] = [];
  const steps: BundleFactoryCompositionStep[] = [];
  const choices: BundleFactoryCompositionChoice[] = [];
  const issues: BundleFactoryCompositionIssue[] = [];
  const entrySkills: string[] = [];
  const seenCallChain = new Set<string>();
  const expandedSkills = new Set<string>();
  const referencedSkills = new Set<string>();
  const cycleIssues = new Set<string>();
  const duplicateIssues = new Set<string>();

  function preferenceIndexFor(skill: string): number | null {
    const resolvedIndex = resolvedBySkill.get(skill)?.preferenceIndex;
    if (resolvedIndex !== undefined && resolvedIndex !== null) return resolvedIndex;
    return preferredIndex.get(skill) ?? null;
  }

  function addFinalStep(skill: string, context: ExpansionContext): void {
    if (seenCallChain.has(skill)) {
      recordDuplicate(skill);
      return;
    }
    seenCallChain.add(skill);
    const preferenceIndex = preferenceIndexFor(skill);
    callChain.push({ skill, preferenceIndex });
    steps.push({
      id: `step-${steps.length + 1}`,
      skill,
      source: context.source,
      ...(context.fromSkill ? { fromSkill: context.fromSkill } : {}),
      ...(context.choiceId ? { choiceId: context.choiceId } : {}),
      preferenceIndex,
    });
  }

  function recordCycle(pathItems: string[]): void {
    const key = pathItems.join('\0');
    if (cycleIssues.has(key)) return;
    cycleIssues.add(key);
    issues.push({
      type: 'cycle',
      message: `Factory Skill composition contains a cycle: ${pathItems.join(' -> ')}`,
      path: pathItems,
    });
  }

  function recordDuplicate(skill: string): void {
    if (duplicateIssues.has(skill)) return;
    duplicateIssues.add(skill);
    issues.push({
      type: 'duplicate-step',
      message: `Factory Skill composition contains duplicate final step: ${skill}`,
      skill,
    });
  }

  function recordDuplicateFlow(skill: string): void {
    const key = `flow:${skill}`;
    if (duplicateIssues.has(key)) return;
    duplicateIssues.add(key);
    issues.push({
      type: 'duplicate-flow',
      message: `Factory Skill composition contains duplicate flow reference: ${skill}`,
      skill,
    });
  }

  function selectChoiceOption(options: string[]): { selected: string | null; reason: string } {
    const availableOptions = options.filter((option) => availableSkills.has(option));
    if (availableOptions.length === 0) {
      return { selected: null, reason: 'No options are available in resolved Skills.' };
    }
    if (availableOptions.length === 1) {
      return {
        selected: availableOptions[0],
        reason: 'Only one option is available in resolved Skills.',
      };
    }

    let selected = availableOptions[0];
    let selectedRank = preferredIndex.get(selected) ?? Number.POSITIVE_INFINITY;
    let hasPreferredRank = Number.isFinite(selectedRank);
    for (const option of availableOptions.slice(1)) {
      const rank = preferredIndex.get(option) ?? Number.POSITIVE_INFINITY;
      if (Number.isFinite(rank)) hasPreferredRank = true;
      if (rank < selectedRank) {
        selected = option;
        selectedRank = rank;
      }
    }
    if (!hasPreferredRank) {
      return {
        selected,
        reason: `Selected the first available option in flow order: ${selected}.`,
      };
    }
    return {
      selected,
      reason: `Selected the available option with the earliest preferredSkills rank: ${selected}.`,
    };
  }

  async function expandChoice(
    fromSkill: string,
    choice: { id: string; options: string[] },
    stack: string[],
  ): Promise<void> {
    const selected = selectChoiceOption(choice.options);
    choices.push({
      id: choice.id,
      fromSkill,
      options: [...choice.options],
      selectedSkill: selected.selected,
      reason: selected.reason,
    });
    if (!selected.selected) {
      issues.push({
        type: 'unresolved-choice',
        message: `Choice ${choice.id} from ${fromSkill} has no available options.`,
        choiceId: choice.id,
      });
      return;
    }
    await expandSkill(
      selected.selected,
      { source: 'choice', fromSkill, choiceId: choice.id },
      stack,
    );
  }

  async function expandSkill(
    skill: string,
    context: ExpansionContext,
    stack: string[],
  ): Promise<void> {
    const cycleIndex = stack.indexOf(skill);
    if (cycleIndex !== -1) {
      recordCycle([...stack.slice(cycleIndex), skill]);
      return;
    }
    if (seenCallChain.has(skill)) {
      recordDuplicate(skill);
      return;
    }
    if (expandedSkills.has(skill)) {
      recordDuplicateFlow(skill);
      return;
    }
    expandedSkills.add(skill);

    const available = availableSkills.get(skill);
    if (!available) {
      if (context.source === 'flow' && context.fromSkill) {
        issues.push({
          type: 'unavailable-use',
          message: `Flow ${context.fromSkill} uses unavailable Skill ${skill}.`,
          fromSkill: context.fromSkill,
          skill,
        });
      }
      return;
    }

    const flowSteps = await readFlowSteps(available.source.root);
    if (!flowSteps) {
      addFinalStep(skill, context);
      return;
    }
    if (flowSteps.length === 0) {
      issues.push({
        type: 'empty-flow',
        message: `Factory Skill composition source ${available.source.name} has an empty flow.yaml.`,
        skill: available.source.name,
      });
      return;
    }

    const nextStack = [...stack, skill];
    const fromSkill = available.source.name;
    for (const step of flowSteps) {
      if ('use' in step) {
        referencedSkills.add(step.use);
        await expandSkill(step.use, { source: 'flow', fromSkill }, nextStack);
      } else {
        for (const option of step.choose.options) {
          referencedSkills.add(option);
        }
        await expandChoice(fromSkill, step.choose, nextStack);
      }
    }
  }

  const attemptedEntries = new Set<string>();
  for (const skill of input.entrySkills ?? input.preferredSkills) {
    if (attemptedEntries.has(skill) || expandedSkills.has(skill) || referencedSkills.has(skill)) {
      continue;
    }
    attemptedEntries.add(skill);
    entrySkills.push(skill);
    await expandSkill(skill, { source: 'atomic' }, []);
  }

  return {
    callChain,
    composition: {
      schemaVersion: 1,
      entrySkills,
      steps,
      choices,
      issues,
    },
  };
}
