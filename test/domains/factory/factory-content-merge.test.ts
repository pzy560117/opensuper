import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { generateFactorySkillPackage } from '../../../domains/factory/package.js';
import type { FactorySkillPackagePlan } from '../../../domains/factory/types.js';
import {
  builtinOpenSuperFivePhaseWorkflow,
  normalizeWorkflowDefinition,
  type WorkflowDefinitionInput,
} from '../../../domains/workflow-contract/index.js';

function customWorkflow(name: string): WorkflowDefinitionInput {
  return {
    kind: 'workflow-kernel',
    name,
    goal: 'Create a research and writing workflow.',
    customNodes: [
      {
        id: 'research',
        label: 'Research',
        kind: 'producer',
        responsibility: 'Collect research notes for the writing workflow.',
        implementation: { skill: 'research-skill', operation: 'default', scope: 'main' },
        operations: ['require', 'augment', 'override'],
        outputSchemas: ['research.notes.v1'],
        guardrails: [{ id: 'notes', label: 'Research notes exist', validation: 'artifact-exists' }],
      },
    ],
    outputSchemas: [
      {
        id: 'research.notes.v1',
        description: 'Research notes.',
        artifacts: [
          {
            id: 'notes',
            kind: 'file',
            required: true,
            paths: ['notes/*.md'],
            validations: ['artifact-exists'],
          },
        ],
        evidence: [{ id: 'summary', required: true }],
      },
    ],
  };
}

function kernelPlan(
  root: string,
  overrides: Partial<FactorySkillPackagePlan> = {},
): FactorySkillPackagePlan {
  const workflow = normalizeWorkflowDefinition(customWorkflow('plain-workflow'));
  return {
    root,
    name: 'plain-workflow',
    version: '1.0.0',
    description: 'plain-workflow workflow.',
    goal: workflow.protocol.goal,
    defaultLocale: 'en',
    callChain: workflow.requiredSkills.map((skill, index) => ({ skill, preferenceIndex: index })),
    workflowDefinition: workflow.input,
    workflowProtocol: workflow.protocol,
    resolvedSkills: [],
    deviations: [],
    engineMode: 'none',
    ...overrides,
  };
}

function overlayPlan(root: string): FactorySkillPackagePlan {
  const workflow = normalizeWorkflowDefinition(
    builtinOpenSuperFivePhaseWorkflow({ name: 'team-opensuper', goal: 'Team OpenSuper overlay.' }),
  );
  return {
    root,
    name: 'team-opensuper',
    version: '1.0.0',
    description: 'team-opensuper overlay.',
    goal: workflow.protocol.goal,
    defaultLocale: 'en',
    callChain: [],
    workflowDefinition: workflow.input,
    workflowProtocol: workflow.protocol,
    resolvedSkills: [],
    deviations: [],
    engineMode: 'none',
  };
}

describe('Factory content-merge (Auto + Authored zones)', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-content-merge-'));
  });
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('composes LLM Authored-zone drafts onto the deterministic Auto zone (never the backbone)', async () => {
    const nodeSkillPath = '../plain-workflow-research/SKILL.md';
    const output = await generateFactorySkillPackage(
      kernelPlan(root, {
        contentDrafts: {
          'SKILL.md':
            'Detect the current Node via `workflow-state.mjs next`. Pause for the user before recording evidence.\n\nRed flag: never skip the Entry Check.',
          [nodeSkillPath]:
            'Prerequisites: confirmed goal.\nSteps: gather sources, distill notes.\nCompletion: research.notes.v1 evidence recorded.',
          'reference/decision-points.md': '# Drafted Decision Points\n',
          'reference/recovery.md': '# Drafted Recovery\n',
          'scripts/workflow-state.mjs': '/* EVIL BACKBONE OVERRIDE */',
        },
      }),
    );

    const entry = await fs.readFile(output.skillPath, 'utf8');
    expect(entry).toContain('## Decision Core');
    expect(entry).toContain('never skip the Entry Check'); // Authored zone
    expect(entry).toContain('## Workflow Nodes'); // Auto zone preserved
    expect(entry).toContain('### Startup Protocol'); // Semantic auto zone
    expect(entry).toContain('### Resume Rules'); // Resume/drift rules
    expect(entry).toContain('Trust files over state'); // File-over-state principle

    const nodeSkill = await fs.readFile(
      path.join(root, 'skills', 'plain-workflow-research', 'SKILL.md'),
      'utf8',
    );
    expect(nodeSkill).toContain('## Guidance');
    expect(nodeSkill).toContain('Prerequisites: confirmed goal'); // Authored zone
    expect(nodeSkill).toContain('## Entry Check'); // Auto zone preserved

    const stateScript = await fs.readFile(
      path.join(output.packageRoot, 'scripts', 'workflow-state.mjs'),
      'utf8',
    );
    expect(stateScript).not.toContain('EVIL BACKBONE OVERRIDE');
    expect(stateScript).toContain('NEXT: auto');
    expect(output.unauthoredSubstanceNodes ?? []).toEqual([]);
  });

  it('marks substance nodes without a draft as pending and reports them unauthored', async () => {
    const output = await generateFactorySkillPackage(kernelPlan(root));
    const nodeSkill = await fs.readFile(
      path.join(root, 'skills', 'plain-workflow-research', 'SKILL.md'),
      'utf8',
    );
    expect(nodeSkill).toContain('## Guidance');
    expect(nodeSkill).toContain('AUTHORING PENDING');
    expect(nodeSkill).toContain('## Entry Check'); // Auto zone still present
    expect(output.unauthoredSubstanceNodes).toEqual(['plain-workflow-research']);
  });

  it('treats overlay (opensuper-five-phase-overlay) nodes as delegates, not pending', async () => {
    const output = await generateFactorySkillPackage(overlayPlan(root));
    const openSkill = await fs.readFile(
      path.join(root, 'skills', 'team-opensuper-open', 'SKILL.md'),
      'utf8',
    );
    expect(openSkill).toContain('## Guidance');
    expect(openSkill).toContain('delegates to');
    expect(openSkill).not.toContain('AUTHORING PENDING');
    expect(output.unauthoredSubstanceNodes ?? []).toEqual([]);
  });

  it('renders real authoring review evidence into skill-review.md and authoring-lanes.json', async () => {
    const output = await generateFactorySkillPackage(
      kernelPlan(root, {
        authoringReview: {
          passed: true,
          evidenceSource: 'llm-multivote',
          voters: 3,
          lenses: ['contract-fit', 'usability', 'evidence-trace', 'self-consistency'],
          rounds: 2,
          findings: [
            { severity: 'minor', path: 'SKILL.md', problem: 'Tiny wording nit.', fix: 'Rephrase.' },
          ],
          reviewedAt: '2026-06-28T00:00:00.000Z',
        },
      }),
    );

    const review = await fs.readFile(
      path.join(output.packageRoot, 'reference', 'skill-review.md'),
      'utf8',
    );
    expect(review).toContain('Evidence source: llm-multivote');
    expect(review).toContain('Passed: yes');

    const lanes = JSON.parse(
      await fs.readFile(path.join(output.packageRoot, 'reference', 'authoring-lanes.json'), 'utf8'),
    ) as { review: { passed: boolean | null; evidenceSource: string; warnings: string[] } };
    expect(lanes.review.passed).toBe(true);
    expect(lanes.review.evidenceSource).toBe('llm-multivote');
    expect(lanes.review.warnings).toContain('Tiny wording nit.');
  });

  it('falls back to an honest placeholder when no authoring review was recorded', async () => {
    const output = await generateFactorySkillPackage(kernelPlan(root));
    const review = await fs.readFile(
      path.join(output.packageRoot, 'reference', 'skill-review.md'),
      'utf8',
    );
    expect(review).toContain('deterministic-check-only');
    expect(review).not.toContain('Passed: yes');
  });
});
