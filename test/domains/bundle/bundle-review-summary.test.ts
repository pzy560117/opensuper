import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { parse, stringify } from 'yaml';
import { createBundleDraft } from '../../../domains/bundle/draft.js';
import { hashBundle } from '../../../domains/bundle/hash.js';
import { loadBundle } from '../../../domains/bundle/load.js';
import { buildReadinessUserSummary } from '../../../domains/bundle/readiness-user-summary.js';
import { buildBundleReviewSummary } from '../../../domains/bundle/review-summary.js';
import {
  generateBundleDraftFromFactoryState,
  initializeBundleFactoryState,
} from '../../../domains/bundle/factory.js';
import { normalizeWorkflowDefinition } from '../../../domains/workflow-contract/index.js';
import {
  reconcileBundleAuthoringState,
  writeBundleAuthoringState,
} from '../../../domains/bundle/state.js';
import type { BundleAuthoringState } from '../../../domains/bundle/types.js';
import { workflowFor as workflowDefinitionFor } from '../../helpers/workflow-plan.js';

async function writeMinimalBundle(root: string, name: string): Promise<void> {
  await fs.mkdir(path.join(root, 'skills', name), { recursive: true });
  await fs.writeFile(
    path.join(root, 'skills', name, 'SKILL.md'),
    `---\nname: ${name}\ndescription: Demo.\n---\n\n# ${name}\n`,
  );
  await fs.writeFile(
    path.join(root, 'bundle.yaml'),
    `apiVersion: opensuper/v1alpha1
kind: SkillBundle
metadata:
  name: ${name}
  version: 1.0.0
  description: Demo
  defaultLocale: en
  locales: [en]
skills:
  - id: ${name}
    path: skills/${name}
    visibility: entry
resources:
  rules: []
  hooks: []
  references: []
  scripts: []
  assets: []
platforms:
  requires: [skills]
  optional: []
  overrides: []
engine:
  enabled: false
`,
  );
}

async function writeHookedBundle(root: string, name: string): Promise<void> {
  await fs.mkdir(path.join(root, 'skills', name), { recursive: true });
  await fs.mkdir(path.join(root, 'hooks'), { recursive: true });
  await fs.mkdir(path.join(root, 'scripts'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'skills', name, 'SKILL.md'),
    `---\nname: ${name}\ndescription: Demo.\n---\n\n# ${name}\n`,
  );
  await fs.writeFile(
    path.join(root, 'hooks', 'protect-write.yaml'),
    `event: before_write
script: verify
failure: block
requiresConfirmation: false
`,
  );
  await fs.writeFile(path.join(root, 'scripts', 'verify.mjs'), 'console.log("verify");\n');
  await fs.writeFile(
    path.join(root, 'bundle.yaml'),
    `apiVersion: opensuper/v1alpha1
kind: SkillBundle
metadata:
  name: ${name}
  version: 1.0.0
  description: Demo
  defaultLocale: en
  locales: [en]
skills:
  - id: ${name}
    path: skills/${name}
    visibility: entry
resources:
  rules: []
  hooks:
    - id: protect-write
      path: hooks/protect-write.yaml
  references: []
  scripts:
    - id: verify
      path: scripts/verify.mjs
      sideEffect: read
      runtime: node
  assets: []
platforms:
  requires: [skills, hooks]
  optional: []
  overrides: []
engine:
  enabled: false
`,
  );
}

async function writeFactorySkill(projectRoot: string, name: string): Promise<void> {
  const skillRoot = path.join(projectRoot, '.opensuper', 'skills', name);
  await fs.mkdir(skillRoot, { recursive: true });
  await fs.writeFile(
    path.join(skillRoot, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${name}.\n---\n\n# ${name}\n`,
    'utf8',
  );
}

function workflowFor(name: string, skills: string[]): ReturnType<typeof workflowDefinitionFor> {
  return workflowDefinitionFor(name, skills);
}

async function createFactoryStateWithGeneratedPackage(
  projectRoot: string,
  name: string,
): Promise<BundleAuthoringState> {
  await writeFactorySkill(projectRoot, `${name}-source`);
  const planFile = path.join(projectRoot, `${name}-plan.json`);
  await fs.mkdir(projectRoot, { recursive: true });
  await fs.writeFile(
    planFile,
    JSON.stringify(
      {
        goal: `Generate ${name}.`,
        preferredSkills: [`${name}-source`],
        workflow: workflowFor(name, [`${name}-source`]),
        engineMode: 'deterministic',
        runnerMode: 'standalone',
        defaultLocale: 'en',
        locales: ['en'],
      },
      null,
      2,
    ),
    'utf8',
  );
  const initialized = await initializeBundleFactoryState({
    projectRoot,
    name,
    filePath: planFile,
    confirmedProposal: true,
  });
  return generateBundleDraftFromFactoryState({ projectRoot, state: initialized });
}

async function authorGeneratedEntryDecisionCore(
  state: BundleAuthoringState,
): Promise<{ currentHash: string }> {
  const generatedPackageRoot = state.factory!.generatedSkillPackage!.packageRoot;
  const generatedEntrySkillPath = path.join(generatedPackageRoot, 'SKILL.md');
  await fs.writeFile(
    generatedEntrySkillPath,
    (await fs.readFile(generatedEntrySkillPath, 'utf8')).replace(
      '<!-- AUTHORING PENDING -->',
      'The Decision Core has been authored for this readiness fixture.',
    ),
    'utf8',
  );
  return { currentHash: await hashBundle(await loadBundle(state.draftPath)) };
}

async function authorAllGeneratedSkillMarkers(
  state: BundleAuthoringState,
): Promise<{ currentHash: string }> {
  const generatedPackage = state.factory!.generatedSkillPackage!;
  const skillsRoot = path.dirname(generatedPackage.packageRoot);
  const skillRoots = [
    generatedPackage.packageRoot,
    ...generatedPackage.internalSkills.map((skill) => path.join(skillsRoot, skill)),
  ];
  for (const skillRoot of skillRoots) {
    const skillPath = path.join(skillRoot, 'SKILL.md');
    await fs.writeFile(
      skillPath,
      (await fs.readFile(skillPath, 'utf8')).replace(
        '<!-- AUTHORING PENDING -->',
        'The generated Skill content has been authored for this readiness fixture.',
      ),
      'utf8',
    );
  }
  return { currentHash: await hashBundle(await loadBundle(state.draftPath)) };
}

describe('Bundle review summary readiness', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-review-summary-'));
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it('blocks unresolved Skill Creator candidates and missing eval evidence', async () => {
    const state = await createBundleDraft({
      projectRoot,
      name: 'factory-demo',
      candidates: [],
      defaultLocale: 'en',
      locales: ['en'],
      engineEnabled: true,
      factory: {
        goal: 'Demo',
        preferredSkills: ['missing-skill'],
        resolvedSkills: [
          { query: 'missing-skill', preferenceIndex: 0, status: 'missing', sources: [] },
        ],
        callChain: [{ skill: 'missing-skill', preferenceIndex: 0 }],
        deviations: [],
        engineMode: 'deterministic',
        runnerMode: 'standalone',
      },
    });
    await writeMinimalBundle(state.draftPath, 'factory-demo');

    const summary = await buildBundleReviewSummary({
      projectRoot,
      name: 'factory-demo',
      platform: 'claude',
    });

    expect(summary.readiness.state).toBe('blocked');
    expect(summary.readiness.blockers).toContain(
      '[candidate] Unresolved Skill Creator candidates: missing-skill (missing)',
    );
    expect(summary.readiness.blockers).toContain(
      '[eval] Eval evidence for the current draft hash is missing',
    );
  });

  it('blocks readiness when repository eval evidence is below quality gates', async () => {
    await createBundleDraft({
      projectRoot,
      name: 'repo-eval-failed',
      candidates: [],
      defaultLocale: 'en',
      locales: ['en'],
      engineEnabled: true,
    });
    const draftPath = path.join(projectRoot, '.opensuper', 'bundle-drafts', 'repo-eval-failed');
    await writeMinimalBundle(draftPath, 'repo-eval-failed');
    const state = await reconcileBundleAuthoringState(projectRoot, 'repo-eval-failed');
    const evalResult = path.join(projectRoot, 'repo-eval-failed-result.json');
    await fs.writeFile(
      evalResult,
      JSON.stringify(
        {
          schemaVersion: 2,
          provider: 'opensuper-eval',
          level: 'full',
          draftHash: state.currentHash,
          evalManifestHash: 'c'.repeat(64),
          tasks: ['entry-smoke'],
          treatments: ['generated-skill'],
          passAtK: { '1': 0 },
          weightedScore: { overall: 0.42 },
          instabilityGap: { overall: 0.2 },
          failures: ['entry-smoke failed'],
          reports: ['eval-report.html'],
          passed: false,
          summary: 'Repository eval failed entry smoke.',
        },
        null,
        2,
      ),
      'utf8',
    );
    await writeBundleAuthoringState(projectRoot, {
      ...state,
      eval: {
        level: 'full',
        hash: state.currentHash!,
        resultPath: evalResult,
        passed: false,
      },
    });

    const summary = await buildBundleReviewSummary({
      projectRoot,
      name: 'repo-eval-failed',
      platform: 'claude',
    });

    expect(summary.readiness.blockers).toContain(
      '[eval] Eval evidence is below publish quality gates: Repository eval failed entry smoke.',
    );
    expect(summary.readiness.evidence.evalResult).toBe(evalResult);
  });

  it('blocks readiness when repository eval result failures conflict with state', async () => {
    await createBundleDraft({
      projectRoot,
      name: 'repo-eval-conflict',
      candidates: [],
      defaultLocale: 'en',
      locales: ['en'],
      engineEnabled: true,
    });
    const draftPath = path.join(projectRoot, '.opensuper', 'bundle-drafts', 'repo-eval-conflict');
    await writeMinimalBundle(draftPath, 'repo-eval-conflict');
    const state = await reconcileBundleAuthoringState(projectRoot, 'repo-eval-conflict');
    const evalResult = path.join(projectRoot, 'repo-eval-conflict-result.json');
    await fs.writeFile(
      evalResult,
      JSON.stringify(
        {
          schemaVersion: 2,
          provider: 'opensuper-eval',
          level: 'full',
          draftHash: state.currentHash,
          evalManifestHash: 'd'.repeat(64),
          tasks: ['entry-smoke'],
          treatments: ['generated-skill'],
          passAtK: { '1': 1 },
          weightedScore: { overall: 0.91 },
          instabilityGap: { overall: 0.03 },
          failures: ['quality gate failed after retry'],
          reports: ['eval-report.html'],
          passed: true,
          summary: 'Repository eval reported a quality gate failure.',
        },
        null,
        2,
      ),
      'utf8',
    );
    await writeBundleAuthoringState(projectRoot, {
      ...state,
      status: 'eval-passed',
      eval: {
        level: 'full',
        hash: state.currentHash!,
        resultPath: evalResult,
        passed: true,
      },
    });

    const summary = await buildBundleReviewSummary({
      projectRoot,
      name: 'repo-eval-conflict',
      platform: 'claude',
    });

    expect(summary.readiness.blockers).toContain(
      '[eval] Eval evidence is below publish quality gates: Repository eval reported a quality gate failure.',
    );
  });

  it('surfaces Skill Creator composition issues as readiness blockers', async () => {
    const state = await createBundleDraft({
      projectRoot,
      name: 'factory-composition-blocked',
      candidates: [],
      defaultLocale: 'en',
      locales: ['en'],
      engineEnabled: true,
      factory: {
        goal: 'Demo',
        preferredSkills: ['task3-choice-flow'],
        resolvedSkills: [],
        callChain: [{ skill: 'task3-choice-flow', preferenceIndex: 0 }],
        deviations: [],
        composition: {
          schemaVersion: 1,
          entrySkills: ['task3-choice-flow'],
          steps: [],
          choices: [
            {
              id: 'review',
              fromSkill: 'task3-choice-flow',
              options: ['task3-missing-review'],
              selectedSkill: null,
              reason: 'No options are available in resolved Skills.',
            },
          ],
          issues: [
            {
              type: 'unresolved-choice',
              message: 'Choice review from task3-choice-flow has no available options.',
              choiceId: 'review',
            },
          ],
        },
        engineMode: 'deterministic',
        runnerMode: 'standalone',
      },
    });
    await writeMinimalBundle(state.draftPath, 'factory-composition-blocked');

    const summary = await buildBundleReviewSummary({
      projectRoot,
      name: 'factory-composition-blocked',
      platform: 'claude',
    });

    expect(summary.readiness.state).toBe('blocked');
    expect(summary.readiness.blockers).toContain(
      '[composition] Choice review from task3-choice-flow has no available options.',
    );
    expect(summary.readiness.evidence).toMatchObject({
      compositionIssues: '1 issue(s)',
      compositionChoices: '1 choice(s)',
    });
    expect(summary.readiness.evidence).not.toHaveProperty('composition');
  });

  it('blocks publish readiness when Skill Creator proposal confirmation is missing', async () => {
    const generated = await createFactoryStateWithGeneratedPackage(
      projectRoot,
      'missing-proposal-confirmation',
    );
    const legacyState: BundleAuthoringState = {
      ...generated,
      status: 'review-approved',
      eval: {
        level: 'quick',
        hash: generated.currentHash!,
        resultPath: 'eval.json',
        passed: true,
      },
      review: {
        hash: generated.currentHash!,
        decision: 'approved',
        reviewer: 'alice',
        at: '2026-06-24T00:00:00.000Z',
      },
      factory: {
        ...generated.factory!,
        proposalConfirmation: undefined,
      },
    };
    delete legacyState.factory!.proposalConfirmation;
    await writeBundleAuthoringState(projectRoot, legacyState);

    const summary = await buildBundleReviewSummary({
      projectRoot,
      name: 'missing-proposal-confirmation',
      platform: 'claude',
    });

    expect(summary.readiness.state).toBe('blocked');
    expect(summary.readiness.blockers).toContain(
      '[proposal] Skill Creator proposal confirmation is missing',
    );
    expect(summary.userSummary.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'proposal',
          severity: 'blocker',
          nextAction: expect.objectContaining({
            command: expect.stringContaining('--confirmed-proposal'),
          }),
        }),
      ]),
    );
  });

  it('blocks readiness when generated packages still contain authoring pending markers', async () => {
    await createFactoryStateWithGeneratedPackage(projectRoot, 'pending-authoring');

    const summary = await buildBundleReviewSummary({
      projectRoot,
      name: 'pending-authoring',
      platform: 'claude',
    });

    expect(summary.readiness.blockers).toContain('[authoring] Entry Decision Core is not authored');
    expect(summary.readiness.blockers).toContain(
      '[authoring] Generated package still contains AUTHORING PENDING markers',
    );
    expect(summary.readiness.evidence.wrapperClassification).toBe('scaffold-blocked');
    expect(summary.userSummary.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'authoring',
          nextAction: expect.objectContaining({
            label: 'Complete generated Skill authoring',
          }),
        }),
      ]),
    );
  });

  it('does not report entry Decision Core blockers for partial authoring when only node content is pending', async () => {
    const state = await createFactoryStateWithGeneratedPackage(projectRoot, 'partial-authoring');
    const { currentHash } = await authorGeneratedEntryDecisionCore(state);
    await writeBundleAuthoringState(projectRoot, {
      ...state,
      currentHash,
    });

    const summary = await buildBundleReviewSummary({
      projectRoot,
      name: 'partial-authoring',
      platform: 'claude',
    });

    expect(summary.readiness.blockers).not.toContain(
      '[authoring] Entry Decision Core is not authored',
    );
    expect(summary.readiness.blockers).toEqual(
      expect.arrayContaining([
        expect.stringContaining('[authoring] Substance nodes lack authored content'),
      ]),
    );
  });

  it('detects authoring pending markers in sibling generated node skill roots', async () => {
    const state = await createFactoryStateWithGeneratedPackage(projectRoot, 'sibling-authoring');
    const { currentHash } = await authorGeneratedEntryDecisionCore(state);
    await writeBundleAuthoringState(projectRoot, {
      ...state,
      currentHash,
      factory: {
        ...state.factory!,
        generatedSkillPackage: {
          ...state.factory!.generatedSkillPackage!,
          unauthoredSubstanceNodes: [],
        },
      },
    });

    const summary = await buildBundleReviewSummary({
      projectRoot,
      name: 'sibling-authoring',
      platform: 'claude',
    });

    expect(summary.readiness.blockers).not.toContain(
      '[authoring] Entry Decision Core is not authored',
    );
    expect(summary.readiness.blockers).toContain(
      '[authoring] Generated package still contains AUTHORING PENDING markers',
    );
  });

  it('surfaces preference hash evidence and drift warnings', async () => {
    await fs.mkdir(path.join(projectRoot, '.opensuper'), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, '.opensuper', 'skill-preferences.yaml'),
      `version: 1
mode: advisory
prefer:
  - preference-drift-source
`,
      'utf8',
    );
    const state = await createFactoryStateWithGeneratedPackage(projectRoot, 'preference-drift');
    await fs.writeFile(
      path.join(projectRoot, '.opensuper', 'skill-preferences.yaml'),
      `version: 1
mode: advisory
prefer:
  - changed-skill
`,
      'utf8',
    );

    const summary = await buildBundleReviewSummary({
      projectRoot,
      name: state.name,
      platform: 'claude',
    });

    expect(summary.readiness.evidence).toHaveProperty(
      'preferenceHash',
      state.factory?.preferenceHash,
    );
    expect(summary.readiness.warnings).toContain(
      '[preference] Project Skill preferences changed after Factory initialization',
    );
  });

  it('blocks strict preference drift', async () => {
    await fs.mkdir(path.join(projectRoot, '.opensuper'), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, '.opensuper', 'skill-preferences.yaml'),
      `version: 1
mode: strict
prefer:
  - strict-preference-drift-source
`,
      'utf8',
    );
    const state = await createFactoryStateWithGeneratedPackage(
      projectRoot,
      'strict-preference-drift',
    );
    await fs.writeFile(
      path.join(projectRoot, '.opensuper', 'skill-preferences.yaml'),
      `version: 1
mode: strict
prefer:
  - changed-skill
`,
      'utf8',
    );

    const summary = await buildBundleReviewSummary({
      projectRoot,
      name: state.name,
      platform: 'claude',
    });

    expect(summary.readiness.blockers).toContain(
      '[preference] Project Skill preferences changed after Factory initialization',
    );
  });

  it('blocks unresolved required Skills in strict preference mode', async () => {
    const state = await createBundleDraft({
      projectRoot,
      name: 'strict-required-missing',
      candidates: [],
      defaultLocale: 'en',
      locales: ['en'],
      engineEnabled: true,
      factory: {
        goal: 'Demo',
        preferredSkills: ['missing-skill'],
        requiredSkills: ['missing-skill'],
        preferenceMode: 'strict',
        resolvedSkills: [
          { query: 'missing-skill', preferenceIndex: 0, status: 'missing', sources: [] },
        ],
        callChain: [{ skill: 'missing-skill', preferenceIndex: 0 }],
        deviations: [],
        engineMode: 'deterministic',
        runnerMode: 'standalone',
      },
    });
    await writeMinimalBundle(state.draftPath, 'strict-required-missing');

    const summary = await buildBundleReviewSummary({
      projectRoot,
      name: 'strict-required-missing',
      platform: 'claude',
    });

    expect(summary.readiness.blockers).toContain(
      '[preference] Required Skill candidates are unresolved: missing-skill (missing)',
    );
  });

  it('surfaces missing factory control-plane files as readiness blockers', async () => {
    const state = await createFactoryStateWithGeneratedPackage(
      projectRoot,
      'stable-missing-control',
    );
    await fs.rm(
      path.join(
        state.draftPath,
        'skills',
        'stable-missing-control',
        'scripts',
        'opensuper-check.mjs',
      ),
    );

    const summary = await buildBundleReviewSummary({
      projectRoot,
      name: 'stable-missing-control',
      platform: 'claude',
    });

    expect(summary.readiness.blockers).toEqual(
      expect.arrayContaining(['[control-plane] missing scripts/opensuper-check.mjs']),
    );
    expect(summary.readiness.blockers).not.toContain(
      '[agent] Claude Code custom agent definitions are missing from platform preview',
    );
    expect(summary.userSummary.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'agent' })]),
    );
    expect(summary.readiness.evidence.controlPlane).toEqual(expect.stringMatching(/file\(s\)$/u));
    expect(summary.readiness.evidence.controlPlaneErrors).toEqual(
      expect.stringMatching(/error\(s\)$/u),
    );
  });

  it('surfaces degraded factory bundle.yaml capabilities as readiness blockers', async () => {
    const state = await createFactoryStateWithGeneratedPackage(
      projectRoot,
      'stable-degraded-capabilities',
    );
    const manifestPath = path.join(state.draftPath, 'bundle.yaml');
    const manifest = parse(await fs.readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    manifest.platforms = {
      requires: ['skills', 'scripts', 'rules', 'hooks'],
      optional: [],
      overrides: [],
    };
    await fs.writeFile(manifestPath, stringify(manifest), 'utf8');

    const summary = await buildBundleReviewSummary({
      projectRoot,
      name: 'stable-degraded-capabilities',
      platform: 'claude',
    });

    expect(summary.readiness.blockers).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/\[control-plane\].*references|required capabilities/iu),
      ]),
    );
  });

  it('is publishable only when eval and review match the current hash', async () => {
    await createBundleDraft({
      projectRoot,
      name: 'factory-ready',
      candidates: [],
      defaultLocale: 'en',
      locales: ['en'],
      engineEnabled: true,
    });
    const draftPath = path.join(projectRoot, '.opensuper', 'bundle-drafts', 'factory-ready');
    await writeMinimalBundle(draftPath, 'factory-ready');
    const state = await reconcileBundleAuthoringState(projectRoot, 'factory-ready');
    const readyState: BundleAuthoringState = {
      ...state,
      status: 'review-approved',
      currentHash: state.currentHash,
      eval: {
        level: 'quick',
        hash: state.currentHash!,
        resultPath: 'eval.json',
        passed: true,
      },
      review: {
        hash: state.currentHash!,
        decision: 'approved',
        reviewer: 'alice',
        at: '2026-06-22T00:00:00.000Z',
      },
    };
    await writeBundleAuthoringState(projectRoot, readyState);

    const summary = await buildBundleReviewSummary({
      projectRoot,
      name: 'factory-ready',
      platform: 'claude',
    });

    expect(summary.readiness.state).toBe('publishable');
    expect(summary.readiness.blockers).toEqual([]);
    expect(summary.userSummary.nextSteps).toEqual([
      {
        label: 'Publish the approved candidate',
        command: 'opensuper publish run factory-ready --platform <reference-platform>',
      },
    ]);
  });

  it('adds fallback next steps for publishable and published states without user-summary items', () => {
    expect(
      buildReadinessUserSummary('ready-bundle', {
        state: 'publishable',
        blockers: [],
        warnings: [],
        evidence: {},
      }).nextSteps,
    ).toEqual([
      {
        label: 'Publish the approved candidate',
        command: 'opensuper publish run ready-bundle --platform <reference-platform>',
      },
    ]);

    expect(
      buildReadinessUserSummary('ready-bundle', {
        state: 'published',
        blockers: [],
        warnings: [],
        evidence: {},
      }).nextSteps,
    ).toEqual([
      {
        label: 'Preview distribution before installing into Agent platforms',
        command:
          'opensuper publish distribute ready-bundle --platform <platform> --scope project --preview',
      },
    ]);
  });

  it('classifies readiness blockers by type and exposes all readiness states', async () => {
    const generatedState = await createFactoryStateWithGeneratedPackage(
      projectRoot,
      'factory-classified',
    );
    const draftPath = generatedState.draftPath;
    const workflow = normalizeWorkflowDefinition(
      workflowFor('factory-classified', ['missing-skill']),
    );
    const blockedState = await reconcileBundleAuthoringState(projectRoot, 'factory-classified');
    await writeBundleAuthoringState(projectRoot, {
      ...blockedState,
      status: 'draft',
      currentHash: generatedState.currentHash,
      factory: {
        ...blockedState.factory!,
        preferredSkills: ['missing-skill'],
        workflowDefinition: workflow.input,
        workflowProtocol: workflow.protocol,
        resolvedSkills: [
          { query: 'missing-skill', preferenceIndex: 0, status: 'missing', sources: [] },
        ],
        callChain: [{ skill: 'missing-skill', preferenceIndex: 0 }],
      },
    });

    const blocked = await buildBundleReviewSummary({
      projectRoot,
      name: 'factory-classified',
      platform: 'claude',
    });
    expect(blocked.readiness.state).toBe('blocked');
    expect(blocked.readiness.blockers).toEqual(
      expect.arrayContaining([
        expect.stringContaining('[candidate]'),
        expect.stringContaining('[eval]'),
      ]),
    );
    expect(blocked.userSummary).toMatchObject({
      conclusion: 'blocked',
      title: 'Cannot publish yet',
    });
    expect(blocked.userSummary.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'candidate',
          severity: 'blocker',
          nextAction: expect.objectContaining({
            label: expect.stringContaining('Resolve'),
          }),
        }),
        expect.objectContaining({
          code: 'eval',
          severity: 'blocker',
          nextAction: expect.objectContaining({
            command: expect.stringContaining('opensuper eval '),
          }),
        }),
      ]),
    );

    const { currentHash: authoredHash } = await authorAllGeneratedSkillMarkers(blockedState);
    await writeBundleAuthoringState(projectRoot, {
      ...blockedState,
      status: 'eval-passed',
      currentHash: authoredHash,
      factory: {
        ...blockedState.factory!,
        proposalConfirmation: {
          confirmed: true,
          confirmedAt: '2026-06-23T00:00:00.000Z',
          proposalHash: 'a'.repeat(64),
          preferenceHash: null,
          acceptedCapabilities: ['skills', 'scripts', 'rules', 'hooks', 'references'],
          warnings: [],
        },
        resolvedSkills: [
          {
            query: 'missing-skill',
            preferenceIndex: 0,
            status: 'available',
            sources: [
              {
                hash: 'sha256:demo',
                root: path.join(projectRoot, 'skills', 'missing-skill'),
                scope: 'project',
                skillMd: path.join(projectRoot, 'skills', 'missing-skill', 'SKILL.md'),
                references: [],
                scripts: [],
              },
            ],
          },
        ],
        generatedSkillPackage: {
          ...blockedState.factory!.generatedSkillPackage!,
          unauthoredSubstanceNodes: [],
          wrapperClassification: 'kernel-authored',
        },
      },
      eval: {
        level: 'quick',
        hash: authoredHash,
        resultPath: path.join(projectRoot, 'eval.json'),
        passed: true,
      },
    });

    const reviewable = await buildBundleReviewSummary({
      projectRoot,
      name: 'factory-classified',
      platform: 'claude',
    });
    expect(reviewable.readiness.state).toBe('reviewable');
    expect(reviewable.userSummary).toMatchObject({
      conclusion: 'needs-confirmation',
      title: 'Ready for review approval',
    });
    expect(reviewable.readiness.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('[review]')]),
    );

    await writeBundleAuthoringState(projectRoot, {
      ...(await reconcileBundleAuthoringState(projectRoot, 'factory-classified')),
      status: 'review-approved',
      currentHash: authoredHash,
      eval: {
        level: 'quick',
        hash: authoredHash,
        resultPath: path.join(projectRoot, 'eval.json'),
        passed: true,
      },
      review: {
        hash: authoredHash,
        decision: 'approved',
        reviewer: 'alice',
        at: '2026-06-23T00:00:00.000Z',
      },
    });

    const publishable = await buildBundleReviewSummary({
      projectRoot,
      name: 'factory-classified',
      platform: 'claude',
    });
    expect(publishable.readiness.state).toBe('publishable');
    expect(publishable.userSummary).toMatchObject({
      conclusion: 'can-publish',
      title: 'Ready to publish',
    });
    expect(publishable.userSummary.nextSteps.length).toBeGreaterThan(0);

    await writeBundleAuthoringState(projectRoot, {
      ...(await reconcileBundleAuthoringState(projectRoot, 'factory-classified')),
      status: 'ready',
      currentHash: authoredHash,
      eval: {
        level: 'quick',
        hash: authoredHash,
        resultPath: path.join(projectRoot, 'eval.json'),
        passed: true,
      },
      review: {
        hash: authoredHash,
        decision: 'approved',
        reviewer: 'alice',
        at: '2026-06-23T00:00:00.000Z',
      },
      ready: {
        hash: authoredHash,
        path: path.join(projectRoot, '.opensuper', 'bundles', 'factory-classified'),
        publishedAt: '2026-06-23T00:00:00.000Z',
      },
    });
    await fs.mkdir(path.join(projectRoot, '.opensuper', 'bundles'), { recursive: true });
    await fs.cp(draftPath, path.join(projectRoot, '.opensuper', 'bundles', 'factory-classified'), {
      recursive: true,
    });

    const published = await buildBundleReviewSummary({
      projectRoot,
      name: 'factory-classified',
      platform: 'claude',
    });
    expect(published.status).toBe('ready');
    expect(published.readiness.state).toBe('published');
    expect(published.userSummary).toMatchObject({
      conclusion: 'published',
      title: 'Already published',
    });
    expect(published.userSummary.nextSteps.length).toBeGreaterThan(0);
  });

  it('surfaces capability and executable-disclosure readiness hints from real platform compile output', async () => {
    await createBundleDraft({
      projectRoot,
      name: 'factory-capability',
      candidates: [],
      defaultLocale: 'en',
      locales: ['en'],
      engineEnabled: false,
    });
    const draftPath = path.join(projectRoot, '.opensuper', 'bundle-drafts', 'factory-capability');
    await writeHookedBundle(draftPath, 'factory-capability');
    const state = await reconcileBundleAuthoringState(projectRoot, 'factory-capability');
    await writeBundleAuthoringState(projectRoot, {
      ...state,
      status: 'eval-passed',
      eval: {
        level: 'quick',
        hash: state.currentHash!,
        resultPath: path.join(projectRoot, 'eval.json'),
        passed: true,
      },
    });

    const kimiSummary = await buildBundleReviewSummary({
      projectRoot,
      name: 'factory-capability',
      platform: 'kimicode',
    });
    expect(kimiSummary.readiness.blockers).toEqual(
      expect.arrayContaining([expect.stringContaining('[capability]')]),
    );

    const claudeSummary = await buildBundleReviewSummary({
      projectRoot,
      name: 'factory-capability',
      platform: 'claude',
    });
    expect(claudeSummary.readiness.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('[executable]')]),
    );
  });
});
