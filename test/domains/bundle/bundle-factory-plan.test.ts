import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import {
  normalizeBundleFactoryPlan,
  readBundleFactoryPlan,
} from '../../../domains/bundle/factory-plan.js';

describe('bundle factory plan normalization', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-factory-plan-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('normalizes workflow contracts as the primary factory plan input', () => {
    const normalized = normalizeBundleFactoryPlan({
      plan: {
        goal: 'Customize existing OpenSuper Skills with team execution requirements.',
        skillCreatorIntent: 'customize-opensuper',
        workflow: {
          kind: 'opensuper-five-phase-overlay',
          name: 'team-opensuper',
          goal: 'Require component and whitebox Skills without replacing OpenSuper control nodes.',
          nodes: {
            execute: {
              requiredSkillCalls: [
                {
                  skill: 'elementui',
                  reason: 'Use the project component library during implementation.',
                },
              ],
            },
            'subagent-execute': {
              requiredSkillCalls: [{ skill: 'elementui', scope: 'handoff' }],
            },
            review: {
              requiredSkillCalls: [{ skill: 'whitebox-code-standard', scope: 'review' }],
            },
          },
        },
      },
      projectPreferredSkills: ['elementui'],
    });

    expect(normalized.workflowProtocol.kind).toBe('opensuper-five-phase-overlay');
    expect(normalized.workflowProtocol.nodes.find((node) => node.id === 'execute')).toMatchObject({
      requiredSkillCalls: [expect.objectContaining({ skill: 'elementui' })],
    });
    expect(normalized.preferredSkills).toEqual(
      expect.arrayContaining(['elementui', 'whitebox-code-standard', 'opensuper-build']),
    );
    expect(normalized.callChain.map((item) => item.skill)).toEqual(
      expect.arrayContaining(['elementui', 'whitebox-code-standard']),
    );
  });

  it('normalizes workflow-kernel plans with custom Nodes and Output Schemas', () => {
    const normalized = normalizeBundleFactoryPlan({
      plan: {
        goal: 'Create a research and writing Skill.',
        workflow: {
          kind: 'workflow-kernel',
          name: 'research-writer',
          goal: 'Research, write, and review a document.',
          customNodes: [
            {
              id: 'research',
              label: 'Research',
              kind: 'producer',
              responsibility: 'Collect research notes for the writing workflow.',
              implementation: { skill: 'research-skill', operation: 'default', scope: 'main' },
              requiredSkillCalls: [{ skill: 'domain-design', reason: 'Use domain notes.' }],
              operations: ['require', 'augment', 'override'],
              outputSchemas: ['research.notes.v1'],
              guardrails: [
                { id: 'notes', label: 'Research notes exist', validation: 'artifact-exists' },
              ],
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
        },
      },
    });

    expect(normalized.skillCreatorIntent).toBe('new-skill');
    expect(normalized.workflowProtocol.nodes.map((node) => node.id)).toEqual(['research']);
    expect(normalized.callChain.map((item) => item.skill)).toEqual([
      'research-skill',
      'domain-design',
    ]);
  });

  it('rejects the pre-release creator intent field name', () => {
    expect(() =>
      normalizeBundleFactoryPlan({
        plan: {
          goal: 'Customize existing OpenSuper Skills with team execution requirements.',
          [`skill${'Maker'}Intent`]: 'customize-opensuper',
          workflow: {
            kind: 'opensuper-five-phase-overlay',
            name: 'team-opensuper',
            goal: 'Require component Skills without replacing OpenSuper control nodes.',
            nodes: {},
          },
        },
      }),
    ).toThrow(/unknown fields.*skillMakerIntent/iu);
  });

  it('rejects unknown factory plan fields', async () => {
    const file = path.join(root, 'unknown-plan.json');
    await fs.writeFile(
      file,
      JSON.stringify(
        {
          goal: 'Plan with an unknown field.',
          workflow: {
            kind: 'workflow-kernel',
            name: 'unknown-plan',
            goal: 'Plan with an unknown field.',
            customNodes: [],
            outputSchemas: [],
          },
          unexpected: true,
        },
        null,
        2,
      ),
      'utf8',
    );

    await expect(readBundleFactoryPlan(file)).rejects.toThrow(/unknown fields.*unexpected/iu);
  });

  it('requires sourceRoot for optimize mode', () => {
    expect(() =>
      normalizeBundleFactoryPlan({
        plan: {
          mode: 'optimize',
          goal: 'Upgrade an existing Skill.',
          workflow: {
            kind: 'workflow-kernel',
            name: 'upgrade-skill',
            goal: 'Upgrade an existing Skill.',
            customNodes: [
              {
                id: 'review',
                label: 'Review',
                kind: 'guardrail',
                responsibility: 'Review the upgraded Skill before it is considered ready.',
                implementation: { skill: 'review-skill', operation: 'default', scope: 'review' },
                operations: ['require', 'augment'],
                outputSchemas: [],
                guardrails: [],
              },
            ],
            outputSchemas: [],
          },
        },
      }),
    ).toThrow(/sourceRoot/iu);
  });
});
