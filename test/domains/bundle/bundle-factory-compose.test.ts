import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { composeBundleFactoryPlan } from '../../../domains/bundle/factory-compose.js';
import type { BundleCandidateSource } from '../../../domains/bundle/candidates.js';
import type { BundleFactoryResolvedSkill } from '../../../domains/bundle/types.js';

async function writeSkill(
  root: string,
  name: string,
  flow?: string,
): Promise<BundleCandidateSource> {
  const skillRoot = path.join(root, 'skills', name);
  await fs.mkdir(path.join(skillRoot, 'opensuper'), { recursive: true });
  const skillMd = `---
name: ${name}
description: ${name}
---

# ${name}
`;
  await fs.writeFile(path.join(skillRoot, 'SKILL.md'), skillMd, 'utf8');
  if (flow !== undefined) {
    await fs.writeFile(path.join(skillRoot, 'opensuper', 'flow.yaml'), flow, 'utf8');
  }
  return {
    name,
    preferenceIndex: null,
    platform: 'codex',
    scope: 'project',
    origin: 'project',
    factory: { query: name },
    root: skillRoot,
    description: name,
    skillMd,
    hash: createHash('sha256').update(name).digest('hex'),
  };
}

function resolved(
  query: string,
  preferenceIndex: number | null,
  source: BundleCandidateSource,
): BundleFactoryResolvedSkill {
  return {
    query,
    preferenceIndex,
    status: 'available',
    sources: [source],
  };
}

describe('bundle factory composition compiler', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-bundle-compose-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('treats a Skill without flow.yaml as an atomic step', async () => {
    const source = await writeSkill(root, 'brainstorming');

    const result = await composeBundleFactoryPlan({
      preferredSkills: ['brainstorming'],
      resolvedSkills: [resolved('brainstorming', 0, source)],
    });

    expect(result.callChain).toEqual([{ skill: 'brainstorming', preferenceIndex: 0 }]);
    expect(result.composition).toMatchObject({
      schemaVersion: 1,
      entrySkills: ['brainstorming'],
      choices: [],
      issues: [],
    });
    expect(result.composition.steps).toEqual([
      expect.objectContaining({
        skill: 'brainstorming',
        source: 'atomic',
        preferenceIndex: 0,
      }),
    ]);
  });

  it('uses explicit entry skills for expansion while keeping preferred skills for ranks', async () => {
    const first = await writeSkill(root, 'atomic-first');
    const second = await writeSkill(root, 'atomic-second');

    const result = await composeBundleFactoryPlan({
      entrySkills: ['atomic-second', 'atomic-first'],
      preferredSkills: ['atomic-first', 'atomic-second'],
      resolvedSkills: [resolved('atomic-first', 0, first), resolved('atomic-second', 1, second)],
    });

    expect(result.callChain).toEqual([
      { skill: 'atomic-second', preferenceIndex: 1 },
      { skill: 'atomic-first', preferenceIndex: 0 },
    ]);
    expect(result.composition).toMatchObject({
      entrySkills: ['atomic-second', 'atomic-first'],
      issues: [],
    });
  });

  it('expands source Skill flow.yaml into a final call chain', async () => {
    const review = await writeSkill(
      root,
      'review-workflow',
      `steps:
  - use: brainstorming
  - use: writing-plans
`,
    );
    const brainstorming = await writeSkill(root, 'brainstorming');
    const writingPlans = await writeSkill(root, 'writing-plans');

    const result = await composeBundleFactoryPlan({
      preferredSkills: ['review-workflow', 'brainstorming', 'writing-plans'],
      resolvedSkills: [
        resolved('review-workflow', 0, review),
        resolved('brainstorming', 1, brainstorming),
        resolved('writing-plans', 2, writingPlans),
      ],
    });

    expect(result.callChain.map((item) => item.skill)).toEqual(['brainstorming', 'writing-plans']);
    expect(result.composition.steps).toEqual([
      expect.objectContaining({
        skill: 'brainstorming',
        source: 'flow',
        fromSkill: 'review-workflow',
      }),
      expect.objectContaining({
        skill: 'writing-plans',
        source: 'flow',
        fromSkill: 'review-workflow',
      }),
    ]);
    expect(result.composition.issues).toEqual([]);
  });

  it('expands nested source Skill flow.yaml recursively without adding the template Skill', async () => {
    const review = await writeSkill(
      root,
      'review-workflow',
      `steps:
  - use: planning-workflow
`,
    );
    const planning = await writeSkill(
      root,
      'planning-workflow',
      `steps:
  - use: brainstorming
  - use: writing-plans
`,
    );
    const brainstorming = await writeSkill(root, 'brainstorming');
    const writingPlans = await writeSkill(root, 'writing-plans');

    const result = await composeBundleFactoryPlan({
      preferredSkills: ['review-workflow', 'planning-workflow', 'brainstorming', 'writing-plans'],
      resolvedSkills: [
        resolved('review-workflow', 0, review),
        resolved('planning-workflow', 1, planning),
        resolved('brainstorming', 2, brainstorming),
        resolved('writing-plans', 3, writingPlans),
      ],
    });

    expect(result.callChain.map((item) => item.skill)).toEqual(['brainstorming', 'writing-plans']);
    expect(result.callChain.map((item) => item.skill)).not.toContain('planning-workflow');
    expect(result.composition.steps).toEqual([
      expect.objectContaining({
        skill: 'brainstorming',
        source: 'flow',
        fromSkill: 'planning-workflow',
      }),
      expect.objectContaining({
        skill: 'writing-plans',
        source: 'flow',
        fromSkill: 'planning-workflow',
      }),
    ]);
    expect(result.composition.issues).toEqual([]);
  });

  it('selects the preferred available option for a choose block', async () => {
    const author = await writeSkill(
      root,
      'authoring',
      `steps:
  - choose:
      id: review
      options:
        - team-review
        - requesting-code-review
`,
    );
    const codeReview = await writeSkill(root, 'requesting-code-review');
    const teamReview = await writeSkill(root, 'team-review');

    const result = await composeBundleFactoryPlan({
      preferredSkills: ['authoring', 'requesting-code-review', 'team-review'],
      resolvedSkills: [
        resolved('authoring', 0, author),
        resolved('requesting-code-review', 1, codeReview),
        resolved('team-review', 2, teamReview),
      ],
    });

    expect(result.callChain.map((item) => item.skill)).toEqual(['requesting-code-review']);
    expect(result.composition.choices).toEqual([
      expect.objectContaining({
        id: 'review',
        fromSkill: 'authoring',
        options: ['team-review', 'requesting-code-review'],
        selectedSkill: 'requesting-code-review',
        reason: expect.stringContaining('preferredSkills'),
      }),
    ]);
    expect(result.composition.steps).toEqual([
      expect.objectContaining({
        skill: 'requesting-code-review',
        source: 'choice',
        choiceId: 'review',
      }),
    ]);
  });

  it('explains when a choose block falls back to the first available option in flow order', async () => {
    const author = await writeSkill(
      root,
      'authoring',
      `steps:
  - choose:
      id: review
      options:
        - team-review
        - requesting-code-review
`,
    );
    const teamReview = await writeSkill(root, 'team-review');
    const codeReview = await writeSkill(root, 'requesting-code-review');

    const result = await composeBundleFactoryPlan({
      preferredSkills: ['authoring'],
      resolvedSkills: [
        resolved('authoring', 0, author),
        resolved('team-review', null, teamReview),
        resolved('requesting-code-review', null, codeReview),
      ],
    });

    expect(result.callChain.map((item) => item.skill)).toEqual(['team-review']);
    expect(result.composition.choices).toEqual([
      expect.objectContaining({
        id: 'review',
        selectedSkill: 'team-review',
        reason: expect.stringContaining('first available option in flow order'),
      }),
    ]);
  });

  it('records a duplicate-step issue when multiple flow paths reference the same final Skill', async () => {
    const workflow = await writeSkill(
      root,
      'workflow',
      `steps:
  - use: brainstorming
  - choose:
      id: explore
      options:
        - brainstorming
`,
    );
    const brainstorming = await writeSkill(root, 'brainstorming');

    const result = await composeBundleFactoryPlan({
      preferredSkills: ['workflow', 'brainstorming'],
      resolvedSkills: [
        resolved('workflow', 0, workflow),
        resolved('brainstorming', 1, brainstorming),
      ],
    });

    expect(result.callChain).toEqual([{ skill: 'brainstorming', preferenceIndex: 1 }]);
    expect(result.composition.issues).toEqual([
      expect.objectContaining({
        type: 'duplicate-step',
        skill: 'brainstorming',
      }),
    ]);
  });

  it('records a duplicate-flow issue when a composed Skill is referenced twice', async () => {
    const workflow = await writeSkill(
      root,
      'workflow',
      `steps:
  - use: planning-workflow
  - use: planning-workflow
`,
    );
    const planningWorkflow = await writeSkill(
      root,
      'planning-workflow',
      `steps:
  - use: brainstorming
  - use: writing-plans
`,
    );
    const brainstorming = await writeSkill(root, 'brainstorming');
    const writingPlans = await writeSkill(root, 'writing-plans');

    const result = await composeBundleFactoryPlan({
      preferredSkills: ['workflow', 'planning-workflow', 'brainstorming', 'writing-plans'],
      resolvedSkills: [
        resolved('workflow', 0, workflow),
        resolved('planning-workflow', 1, planningWorkflow),
        resolved('brainstorming', 2, brainstorming),
        resolved('writing-plans', 3, writingPlans),
      ],
    });

    expect(result.callChain.map((item) => item.skill)).toEqual(['brainstorming', 'writing-plans']);
    expect(result.composition.issues).toEqual([
      expect.objectContaining({
        type: 'duplicate-flow',
        skill: 'planning-workflow',
      }),
    ]);
  });

  it('records an empty-flow issue instead of silently compiling an empty template', async () => {
    const workflow = await writeSkill(
      root,
      'workflow',
      `steps: []
`,
    );

    const result = await composeBundleFactoryPlan({
      preferredSkills: ['workflow'],
      resolvedSkills: [resolved('workflow', 0, workflow)],
    });

    expect(result.callChain).toEqual([]);
    expect(result.composition.issues).toEqual([
      expect.objectContaining({
        type: 'empty-flow',
        skill: 'workflow',
      }),
    ]);
  });

  it('records an unresolved-choice issue when no choose option is available', async () => {
    const author = await writeSkill(
      root,
      'authoring',
      `steps:
  - choose:
      id: review
      options:
        - requesting-code-review
        - team-review
`,
    );

    const result = await composeBundleFactoryPlan({
      preferredSkills: ['authoring'],
      resolvedSkills: [resolved('authoring', 0, author)],
    });

    expect(result.callChain).toEqual([]);
    expect(result.composition.choices).toEqual([
      expect.objectContaining({
        id: 'review',
        selectedSkill: null,
      }),
    ]);
    expect(result.composition.issues).toEqual([
      expect.objectContaining({ type: 'unresolved-choice', choiceId: 'review' }),
    ]);
  });

  it('records an unavailable-use issue when a flow references an unavailable Skill', async () => {
    const workflow = await writeSkill(
      root,
      'workflow',
      `steps:
  - use: missing-step
  - use: available-step
`,
    );
    const available = await writeSkill(root, 'available-step');

    const result = await composeBundleFactoryPlan({
      entrySkills: ['workflow'],
      preferredSkills: ['workflow', 'missing-step', 'available-step'],
      resolvedSkills: [resolved('workflow', 0, workflow), resolved('available-step', 2, available)],
    });

    expect(result.callChain).toEqual([{ skill: 'available-step', preferenceIndex: 2 }]);
    expect(result.callChain.map((item) => item.skill)).not.toContain('missing-step');
    expect(result.composition.issues).toEqual([
      expect.objectContaining({
        type: 'unavailable-use',
        fromSkill: 'workflow',
        skill: 'missing-step',
        message: expect.stringContaining('workflow'),
      }),
    ]);
    expect(result.composition.issues[0]?.message).toContain('missing-step');
  });

  it('records a cycle issue and stops recursive expansion', async () => {
    const a = await writeSkill(
      root,
      'a',
      `steps:
  - use: b
`,
    );
    const b = await writeSkill(
      root,
      'b',
      `steps:
  - use: a
`,
    );

    const result = await composeBundleFactoryPlan({
      preferredSkills: ['a', 'b'],
      resolvedSkills: [resolved('a', 0, a), resolved('b', 1, b)],
    });

    expect(result.callChain).toEqual([]);
    expect(result.composition.issues).toEqual([
      expect.objectContaining({ type: 'cycle', path: ['a', 'b', 'a'] }),
    ]);
  });

  it('rejects invalid flow.yaml schema with an actionable field path', async () => {
    const invalidSteps = await writeSkill(
      root,
      'invalid-steps',
      `steps: nope
`,
    );
    const invalidChoice = await writeSkill(
      root,
      'invalid-choice',
      `steps:
  - choose:
      id: review
      options: nope
`,
    );

    await expect(
      composeBundleFactoryPlan({
        preferredSkills: ['invalid-steps'],
        resolvedSkills: [resolved('invalid-steps', 0, invalidSteps)],
      }),
    ).rejects.toThrow(/flow\.yaml.*steps/u);

    await expect(
      composeBundleFactoryPlan({
        preferredSkills: ['invalid-choice'],
        resolvedSkills: [resolved('invalid-choice', 0, invalidChoice)],
      }),
    ).rejects.toThrow(/flow\.yaml.*steps\[0\]\.choose\.options/u);
  });

  it('rejects flow.yaml documents with unknown top-level fields', async () => {
    const source = await writeSkill(
      root,
      'unknown-top-level',
      `steps: []
extra: nope
`,
    );

    await expect(
      composeBundleFactoryPlan({
        preferredSkills: ['unknown-top-level'],
        resolvedSkills: [resolved('unknown-top-level', 0, source)],
      }),
    ).rejects.toThrow(/flow\.yaml.*extra/u);
  });
});
