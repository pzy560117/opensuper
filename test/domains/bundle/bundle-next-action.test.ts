import { describe, expect, it } from 'vitest';
import {
  buildBundleResumeSummary,
  determineBundleNextAction,
} from '../../../domains/bundle/next-action.js';
import type { BundleAuthoringState } from '../../../domains/bundle/types.js';

function state(overrides: Partial<BundleAuthoringState> = {}): BundleAuthoringState {
  return {
    schemaVersion: 1,
    name: 'demo-skill',
    mode: 'create',
    status: 'draft',
    draftPath: '/project/.opensuper/bundle-drafts/demo-skill',
    currentHash: 'a'.repeat(64),
    candidates: [],
    defaultLocale: 'en',
    locales: ['en'],
    engineEnabled: true,
    ...overrides,
  };
}

function proposalConfirmation(preferenceHash: string | null = null) {
  return {
    confirmed: true,
    confirmedAt: '2026-06-24T00:00:00.000Z',
    proposalHash: 'b'.repeat(64),
    preferenceHash,
    acceptedCapabilities: ['skills', 'scripts', 'rules', 'hooks', 'references'] as const,
    warnings: [],
  };
}

describe('Bundle next action', () => {
  it('uses the generated eval manifest path in the user-facing eval command', () => {
    const action = determineBundleNextAction(
      state({
        factory: {
          goal: 'Create a demo Skill',
          preferredSkills: ['brainstorming'],
          resolvedSkills: [
            { query: 'brainstorming', preferenceIndex: 0, status: 'available', sources: [] },
          ],
          callChain: [{ skill: 'brainstorming', preferenceIndex: 0 }],
          deviations: [],
          engineMode: 'deterministic',
          runnerMode: 'standalone',
          proposalConfirmation: proposalConfirmation(),
          generatedSkillPackage: {
            entrySkill: 'demo-skill',
            internalSkills: [],
            packageRoot: '/project/.opensuper/bundle-drafts/demo-skill/skills/demo-skill',
            enginePath: null,
            evalManifestPath:
              '/project/.opensuper/bundle-drafts/demo-skill/skills/demo-skill/opensuper/eval.yaml',
          },
        },
      }),
    );

    expect(action).toMatchObject({
      action: 'choose-eval-level',
      category: 'eval',
      userLabel: 'Run repository eval for the generated Skill',
      reason: 'Current draft hash is missing passing eval evidence',
      userCommand:
        'opensuper eval /project/.opensuper/bundle-drafts/demo-skill/skills/demo-skill/opensuper/eval.yaml --quick --html',
    });
    expect(action.backendCommand).toBe('opensuper bundle eval-plan demo-skill --level quick');
  });

  it('requests review again when the current-hash review was rejected', () => {
    const reviewedState = state({
      status: 'draft',
      eval: {
        hash: 'a'.repeat(64),
        level: 'quick',
        resultPath: '/project/.opensuper/bundle-drafts/demo-skill/eval-result.json',
        passed: true,
      },
      review: {
        hash: 'a'.repeat(64),
        decision: 'rejected',
        reviewer: 'qa',
        at: '2026-06-24T00:00:00.000Z',
      },
    });

    expect(determineBundleNextAction(reviewedState)).toMatchObject({
      action: 'request-review',
      category: 'review',
    });

    expect(buildBundleResumeSummary(reviewedState)).toMatchObject({
      currentStep: 'needs-review',
      recommendedNextStep: {
        action: 'request-review',
      },
    });
  });

  it('builds a resume summary with completed and missing steps', () => {
    const summary = buildBundleResumeSummary(
      state({
        factory: {
          goal: 'Create a resumable Skill',
          preferredSkills: ['brainstorming'],
          resolvedSkills: [
            { query: 'brainstorming', preferenceIndex: 0, status: 'available', sources: [] },
          ],
          callChain: [{ skill: 'brainstorming', preferenceIndex: 0 }],
          deviations: [],
          engineMode: 'deterministic',
          runnerMode: 'standalone',
          preferenceHash: 'old-hash',
          proposalConfirmation: proposalConfirmation('old-hash'),
          generatedSkillPackage: {
            entrySkill: 'demo-skill',
            internalSkills: [],
            packageRoot: '/draft/skills/demo-skill',
            enginePath: null,
            evalManifestPath: '/draft/skills/demo-skill/opensuper/eval.yaml',
          },
        },
      }),
      { currentPreferenceHash: 'new-hash' },
    );

    expect(summary).toMatchObject({
      schemaVersion: 1,
      name: 'demo-skill',
      goal: 'Create a resumable Skill',
      currentStep: 'needs-eval',
      preferenceDrift: {
        changed: true,
        storedHash: 'old-hash',
        currentHash: 'new-hash',
      },
      recommendedNextStep: {
        action: 'choose-eval-level',
        category: 'eval',
      },
    });
    expect(summary.completed).toContain('Skill Creator metadata initialized');
    expect(summary.missing).toContain('Passing eval evidence for the current draft');
  });

  it('marks preference drift when the stored hash exists and the current hash is null', () => {
    const summary = buildBundleResumeSummary(
      state({
        factory: {
          goal: 'Create a resumable Skill',
          preferredSkills: ['brainstorming'],
          resolvedSkills: [
            { query: 'brainstorming', preferenceIndex: 0, status: 'available', sources: [] },
          ],
          callChain: [{ skill: 'brainstorming', preferenceIndex: 0 }],
          deviations: [],
          engineMode: 'deterministic',
          runnerMode: 'standalone',
          preferenceHash: 'old-hash',
          proposalConfirmation: proposalConfirmation('old-hash'),
          generatedSkillPackage: {
            entrySkill: 'demo-skill',
            internalSkills: [],
            packageRoot: '/draft/skills/demo-skill',
            enginePath: null,
            evalManifestPath: '/draft/skills/demo-skill/opensuper/eval.yaml',
          },
        },
      }),
      { currentPreferenceHash: null },
    );

    expect(summary.preferenceDrift).toEqual({
      changed: true,
      storedHash: 'old-hash',
      currentHash: null,
    });
  });
});
