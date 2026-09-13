import path from 'path';
import {
  bundleAuthoringPlanCommand,
  bundleAuthoringRecordCommand,
  bundleCandidatesCommand,
  bundleFactoryGenerateCommand,
  bundleFactoryGuideCommand,
  bundleFactoryInitCommand,
  bundleFactoryProposeCommand,
  bundleFactoryResolveCommand,
  bundleListCommand,
  bundleStatusCommand,
  type BundleCommandOptions,
} from './bundle.js';
import { buildBundleResumeSummary } from '../../domains/bundle/next-action.js';
import { reconcileBundleAuthoringState } from '../../domains/bundle/state.js';
import { readProjectSkillPreferences } from '../../domains/skill/preferences.js';

export type CreatorCommandOptions = BundleCommandOptions;

function projectRoot(options: CreatorCommandOptions): string {
  return path.resolve(options.project ?? '.');
}

function formatNextText(result: Awaited<ReturnType<typeof buildCreatorNextResult>>): string {
  return [
    `Next step for ${result.name}`,
    `Status: ${result.status}`,
    `Current step: ${result.currentStep}`,
    `Action: ${result.nextStep.label}`,
    `Command: ${result.nextStep.command}`,
    `Reason: ${result.nextStep.reason}`,
    `Requires confirmation: ${result.nextStep.requiresUserConfirmation ? 'yes' : 'no'}`,
    ...(result.preferenceDrift.changed
      ? ['Preference drift: project Skill preferences changed after this flow started']
      : []),
  ].join('\n');
}

async function buildCreatorNextResult(name: string, options: CreatorCommandOptions) {
  const root = projectRoot(options);
  const state = await reconcileBundleAuthoringState(root, name);
  const currentPreferences = await readProjectSkillPreferences(root);
  const resumeSummary = buildBundleResumeSummary(state, {
    currentPreferenceHash: currentPreferences?.hash ?? null,
  });
  const nextAction = resumeSummary.recommendedNextStep;

  return {
    schemaVersion: 1 as const,
    name: state.name,
    status: state.status,
    currentStep: resumeSummary.currentStep,
    nextStep: {
      action: nextAction.action,
      category: nextAction.category,
      label: nextAction.userLabel,
      command: nextAction.userCommand,
      reason: nextAction.reason,
      requiresUserConfirmation: nextAction.requiresUserConfirmation,
    },
    evidencePaths: resumeSummary.evidencePaths,
    preferenceDrift: resumeSummary.preferenceDrift,
  };
}

export async function creatorListCommand(options: CreatorCommandOptions = {}): Promise<void> {
  await bundleListCommand(options);
}

export async function creatorStatusCommand(
  name: string,
  options: CreatorCommandOptions = {},
): Promise<void> {
  await bundleStatusCommand(name, options);
}

export async function creatorNextCommand(
  name: string,
  options: CreatorCommandOptions = {},
): Promise<void> {
  const result = await buildCreatorNextResult(name, options);
  console.log(options.json ? JSON.stringify(result, null, 2) : formatNextText(result));
}

export async function creatorGuideCommand(options: CreatorCommandOptions = {}): Promise<void> {
  await bundleFactoryGuideCommand(options);
}

export async function creatorCandidatesCommand(options: CreatorCommandOptions = {}): Promise<void> {
  await bundleCandidatesCommand(options);
}

export async function creatorProposeCommand(
  name: string,
  options: CreatorCommandOptions = {},
): Promise<void> {
  await bundleFactoryProposeCommand(name, options);
}

export async function creatorInitCommand(
  name: string,
  options: CreatorCommandOptions = {},
): Promise<void> {
  await bundleFactoryInitCommand(name, options);
}

export async function creatorResolveCommand(
  name: string,
  options: CreatorCommandOptions = {},
): Promise<void> {
  await bundleFactoryResolveCommand(name, options);
}

export async function creatorAuthoringPlanCommand(
  name: string,
  options: CreatorCommandOptions = {},
): Promise<void> {
  await bundleAuthoringPlanCommand(name, options);
}

export async function creatorAuthoringRecordCommand(
  name: string,
  options: CreatorCommandOptions = {},
): Promise<void> {
  await bundleAuthoringRecordCommand(name, options);
}

export async function creatorGenerateCommand(
  name: string,
  options: CreatorCommandOptions = {},
): Promise<void> {
  await bundleFactoryGenerateCommand(name, options);
}
