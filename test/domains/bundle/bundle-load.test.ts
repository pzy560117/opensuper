import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { loadBundle } from '../../../domains/bundle/load.js';

const manifest = `apiVersion: opensuper/v1alpha1
kind: SkillBundle
metadata:
  name: demo-bundle
  version: 1.0.0
  description: Demo workflow
  defaultLocale: zh
  locales: [zh, en]
skills:
  - id: demo
    path: skills/demo
    visibility: entry
  - id: demo-verify
    path: skills/demo-verify
    visibility: entry
  - id: demo-helper
    path: skills/demo-helper
    visibility: internal
resources:
  rules:
    - id: workflow-rule
      path: rules/workflow.md
      mode: always
      required: true
  hooks:
    - id: protect-write
      path: hooks/protect-write.yaml
  references: [references/state.md]
  scripts:
    - id: verify-state
      path: scripts/verify-state.mjs
      sideEffect: read
      runtime: node
platforms:
  requires: [skills]
  optional: [rules, hooks, scripts]
engine:
  enabled: false
`;

describe('loadBundle', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-bundle-load-'));
    await fs.writeFile(path.join(root, 'bundle.yaml'), manifest);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('loads and normalizes a multi-entry bundle manifest', async () => {
    const bundle = await loadBundle(root);

    expect(bundle.root).toBe(path.resolve(root));
    expect(bundle.manifest.skills).toHaveLength(3);
    expect(bundle.manifest.skills.filter((skill) => skill.visibility === 'entry')).toHaveLength(2);
    expect(bundle.manifest.metadata).toMatchObject({
      defaultLocale: 'zh',
      locales: ['zh', 'en'],
    });
    expect(bundle.manifest.resources).toEqual({
      rules: [
        {
          id: 'workflow-rule',
          path: 'rules/workflow.md',
          mode: 'always',
          required: true,
        },
      ],
      hooks: [{ id: 'protect-write', path: 'hooks/protect-write.yaml' }],
      references: ['references/state.md'],
      scripts: [
        {
          id: 'verify-state',
          path: 'scripts/verify-state.mjs',
          sideEffect: 'read',
          runtime: 'node',
        },
      ],
      assets: [],
      agents: [],
    });
    expect(bundle.manifest.platforms).toEqual({
      requires: ['skills'],
      optional: ['rules', 'hooks', 'scripts'],
      overrides: [],
    });
    expect(bundle.manifest.engine).toEqual({ enabled: false });
  });

  it.each([
    {
      name: 'an unsupported API version',
      source: manifest.replace('opensuper/v1alpha1', 'opensuper/v2'),
      field: 'apiVersion',
    },
    {
      name: 'an unsupported kind',
      source: manifest.replace('kind: SkillBundle', 'kind: Workflow'),
      field: 'kind',
    },
    {
      name: 'a missing skill visibility',
      source: manifest.replace('    visibility: internal\n', ''),
      field: 'skills[2].visibility',
    },
  ])('rejects $name with an actionable field path', async ({ source, field }) => {
    await fs.writeFile(path.join(root, 'bundle.yaml'), source);

    await expect(loadBundle(root)).rejects.toThrow(
      new RegExp(`bundle[\\\\/]?\\.yaml.*${field.replace('[', '\\[').replace(']', '\\]')}`),
    );
  });
});
