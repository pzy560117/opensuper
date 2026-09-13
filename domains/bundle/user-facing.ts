export type SkillCreatorIntent = 'customize-opensuper' | 'new-skill' | 'upgrade-existing';

export interface SkillCreatorPlanSummary {
  intent: SkillCreatorIntent;
  intentLabel: string;
  skillName: string;
  goal: string;
  workflow?: {
    kind: string;
    nodes: Array<{
      id: string;
      label: string;
      kind: string;
      implementationSkill: string;
      requiredSkills: string[];
      outputSchemas: string[];
    }>;
    outputSchemas: string[];
  };
  retained: string[];
  additions: string[];
  replacements: string[];
  disabled: string[];
  rejected: string[];
  generated: string[];
  validation: string[];
  install: string[];
  advanced: string[];
}

export interface SkillCreatorResumeTextInput {
  title: string;
  completed: string[];
  missing: string[];
  nextAction: string;
  choices: string[];
}

export interface SkillCreatorInstallTextInput {
  preview: boolean;
  skillName: string;
  platforms: string[];
  plannedFiles: string[];
  disclosures: string[];
}

export function skillCreatorIntentLabel(intent: SkillCreatorIntent): string {
  switch (intent) {
    case 'customize-opensuper':
      return 'Customize existing OpenSuper Skills';
    case 'new-skill':
      return 'Create a new Skill';
    case 'upgrade-existing':
      return 'Upgrade an existing Skill';
  }
}

export function buildSkillCreatorPlanSummary(
  options: Omit<SkillCreatorPlanSummary, 'intentLabel'>,
): SkillCreatorPlanSummary {
  return {
    ...options,
    intentLabel: skillCreatorIntentLabel(options.intent),
  };
}

function section(title: string, values: string[]): string[] {
  if (values.length === 0) {
    return [`${title}: None`];
  }
  return [`${title}:`, ...values.map((value) => `- ${value}`)];
}

function workflowContractSection(summary: SkillCreatorPlanSummary): string[] {
  if (!summary.workflow) return ['Workflow contract: None'];
  return [
    'Workflow contract:',
    `- Kind: ${summary.workflow.kind}`,
    `- Output Schemas: ${summary.workflow.outputSchemas.join(', ') || 'none'}`,
    ...summary.workflow.nodes.map((node) => {
      const required = node.requiredSkills.length > 0 ? node.requiredSkills.join(', ') : 'none';
      const schemas = node.outputSchemas.length > 0 ? node.outputSchemas.join(', ') : 'none';
      return `- Node ${node.id}: ${node.label}; ${node.kind}; implementation: ${node.implementationSkill}; required Skill calls: ${required}; output schemas: ${schemas}`;
    }),
  ];
}

export function formatSkillCreatorPlanSummary(summary: SkillCreatorPlanSummary): string {
  return [
    `You are making: ${summary.intentLabel}`,
    `Skill: ${summary.skillName}`,
    `Goal: ${summary.goal}`,
    ...section('Keep', summary.retained),
    ...section('Add', summary.additions),
    ...section('Replace', summary.replacements),
    ...section('Turn off', summary.disabled),
    ...section('Cannot do', summary.rejected),
    ...workflowContractSection(summary),
    ...section('Will generate', summary.generated),
    ...section('Validate', summary.validation),
    ...section('Install/enable', summary.install),
    ...section('Advanced details', summary.advanced),
  ].join('\n');
}

export function buildSkillCreatorResumeText(input: SkillCreatorResumeTextInput): string {
  return [
    input.title,
    ...section('Completed', input.completed),
    ...section('Still needed', input.missing),
    `Next step: ${input.nextAction}`,
    ...section('Choices', input.choices),
  ].join('\n');
}

export function buildSkillCreatorInstallText(input: SkillCreatorInstallTextInput): string {
  return [
    input.preview ? 'Install preview' : 'Install result',
    `Skill: ${input.skillName}`,
    ...section('Platforms', input.platforms),
    ...(input.preview ? ['No files were written'] : []),
    ...section('Planned files', input.plannedFiles),
    ...section('Executable disclosures', input.disclosures),
  ].join('\n');
}
