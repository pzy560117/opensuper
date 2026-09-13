import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { hashBundle } from '../../../domains/bundle/hash.js';
import { loadBundle } from '../../../domains/bundle/load.js';

const manifest = `apiVersion: opensuper/v1alpha1
kind: SkillBundle
metadata:
  name: hash-bundle
  version: 1.0.0
  description: Hash fixture
  defaultLocale: zh
  locales: [zh, en]
skills:
  - id: demo
    path: skills/demo
    visibility: entry
  - id: helper
    path: skills/helper
    visibility: internal
resources:
  rules:
    - id: workflow
      path: rules/workflow.md
      mode: always
      required: true
  hooks:
    - id: protect
      path: hooks/protect.yaml
  references: [references/state.md]
  scripts:
    - id: verify
      path: scripts/verify.mjs
      sideEffect: read
      runtime: node
  assets: [assets/icon.txt]
platforms:
  requires: [skills]
  optional: [rules, hooks, scripts, references, assets]
  overrides:
    - platform: codex
      replaces: hooks.protect
      path: overrides/codex/protect.yaml
engine:
  enabled: false
`;

const files: Record<string, string> = {
  'bundle.yaml': manifest,
  'skills/demo/SKILL.md': '# Demo\n',
  'skills/helper/SKILL.md': '# Helper\n',
  'rules/workflow.md': '# Rule\n',
  'hooks/protect.yaml':
    'event: before_write\nscript: verify\nfailure: block\nrequiresConfirmation: false\n',
  'references/state.md': '# State\n',
  'scripts/verify.mjs': 'process.exit(0);\n',
  'assets/icon.txt': 'icon\n',
  'locales/en/skills/demo/SKILL.md': '# English Demo\n',
  'overrides/codex/protect.yaml':
    'event: before_write\nscript: verify\nfailure: warn\nrequiresConfirmation: false\n',
  'engine/notes.md': 'engine metadata\n',
};

const temporary: string[] = [];

async function fixture(order = Object.keys(files)): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-bundle-hash-'));
  temporary.push(root);
  for (const relative of order) {
    const target = path.join(root, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, files[relative]);
  }
  return root;
}

describe('hashBundle', () => {
  afterEach(async () => {
    await Promise.all(
      temporary.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
    );
  });

  it('is independent of file creation and enumeration order', async () => {
    const first = await fixture(Object.keys(files));
    const second = await fixture(Object.keys(files).reverse());

    expect(await hashBundle(await loadBundle(first))).toBe(
      await hashBundle(await loadBundle(second)),
    );
  });

  it.each([
    'skills/demo/SKILL.md',
    'skills/helper/SKILL.md',
    'rules/workflow.md',
    'hooks/protect.yaml',
    'references/state.md',
    'scripts/verify.mjs',
    'assets/icon.txt',
    'locales/en/skills/demo/SKILL.md',
    'overrides/codex/protect.yaml',
    'engine/notes.md',
  ])('changes when %s changes', async (relative) => {
    const root = await fixture();
    const bundle = await loadBundle(root);
    const before = await hashBundle(bundle);
    await fs.appendFile(path.join(root, relative), 'changed\n');

    expect(await hashBundle(bundle)).not.toBe(before);
  });

  it('changes when normalized manifest data changes', async () => {
    const root = await fixture();
    const before = await hashBundle(await loadBundle(root));
    await fs.writeFile(
      path.join(root, 'bundle.yaml'),
      manifest.replace('version: 1.0.0', 'version: 1.0.1'),
    );

    expect(await hashBundle(await loadBundle(root))).not.toBe(before);
  });

  it('ignores files outside the Bundle root', async () => {
    const root = await fixture();
    const bundle = await loadBundle(root);
    const before = await hashBundle(bundle);
    await fs.writeFile(
      path.join(path.dirname(root), `${path.basename(root)}-notes.txt`),
      'outside\n',
    );

    expect(await hashBundle(bundle)).toBe(before);
    await fs.rm(path.join(path.dirname(root), `${path.basename(root)}-notes.txt`), { force: true });
  });

  it('rejects symbolic links before hashing', async () => {
    const root = await fixture();
    const target = path.join(root, 'target');
    await fs.mkdir(target);
    await fs.symlink(target, path.join(root, 'linked'), 'junction');

    await expect(hashBundle(await loadBundle(root))).rejects.toThrow(/linked is a symbolic link/);
  });
});
