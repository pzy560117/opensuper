import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { compileBundleIr } from '../../../domains/bundle/compiler.js';
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
  - id: demo-verify
    path: skills/demo-verify
    visibility: entry
  - id: demo
    path: skills/demo
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
  optional: [rules, hooks, scripts, references]
engine:
  enabled: false
`;

describe('compileBundleIr', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-bundle-compiler-'));
    for (const skill of ['demo', 'demo-verify', 'demo-helper']) {
      await fs.mkdir(path.join(root, 'skills', skill), { recursive: true });
      await fs.writeFile(path.join(root, 'skills', skill, 'SKILL.md'), `# ${skill}\n`);
    }
    await fs.mkdir(path.join(root, 'rules'), { recursive: true });
    await fs.mkdir(path.join(root, 'hooks'), { recursive: true });
    await fs.mkdir(path.join(root, 'references'), { recursive: true });
    await fs.mkdir(path.join(root, 'scripts'), { recursive: true });
    await fs.mkdir(path.join(root, 'locales', 'en', 'skills', 'demo'), { recursive: true });
    await fs.writeFile(path.join(root, 'bundle.yaml'), manifest);
    await fs.writeFile(path.join(root, 'rules', 'workflow.md'), '# Workflow\n');
    await fs.writeFile(
      path.join(root, 'hooks', 'protect-write.yaml'),
      `event: before_write
script: verify-state
failure: block
requiresConfirmation: false
`,
    );
    await fs.writeFile(path.join(root, 'references', 'state.md'), '# State\n');
    await fs.writeFile(path.join(root, 'scripts', 'verify-state.mjs'), 'process.exit(0);\n');
    await fs.writeFile(
      path.join(root, 'locales', 'en', 'skills', 'demo', 'SKILL.md'),
      '# English demo\n',
    );
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('compiles a normalized, deterministic Bundle IR', async () => {
    const ir = await compileBundleIr(await loadBundle(root), { locale: 'zh' });

    expect(ir.bundle).toEqual({
      name: 'demo-bundle',
      version: '1.0.0',
      locale: 'zh',
      hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(ir.skills.map(({ id, visibility }) => ({ id, visibility }))).toEqual([
      { id: 'demo', visibility: 'entry' },
      { id: 'demo-helper', visibility: 'internal' },
      { id: 'demo-verify', visibility: 'entry' },
    ]);
    expect(ir.skills.every((skill) => path.isAbsolute(skill.sourceRoot))).toBe(true);
    expect(ir.rules).toMatchObject([{ id: 'workflow-rule', mode: 'always', required: true }]);
    expect(ir.hooks).toMatchObject([{ id: 'protect-write', script: 'verify-state' }]);
    expect(ir.scripts).toMatchObject([{ id: 'verify-state', sideEffect: 'read' }]);
    expect(ir.engine).toBeNull();
  });

  it('retains internal Skills in the IR as non-entry packages', async () => {
    const ir = await compileBundleIr(await loadBundle(root));

    expect(ir.skills.find((skill) => skill.id === 'demo-helper')).toMatchObject({
      visibility: 'internal',
      files: [{ relativePath: 'SKILL.md', source: expect.any(String) }],
    });
  });

  it('uses locale overlay sources without dropping root Skill files', async () => {
    await fs.writeFile(path.join(root, 'skills', 'demo', 'reference.md'), '# Shared reference\n');

    const ir = await compileBundleIr(await loadBundle(root), { locale: 'en' });
    const demo = ir.skills.find((skill) => skill.id === 'demo')!;
    const skillMd = demo.files.find((file) => file.relativePath === 'SKILL.md')!;
    const reference = demo.files.find((file) => file.relativePath === 'reference.md')!;

    expect(await fs.readFile(skillMd.source, 'utf8')).toContain('English');
    expect(await fs.readFile(reference.source, 'utf8')).toContain('Shared reference');
  });
});
