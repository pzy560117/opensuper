import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { loadBundle, resolveBundleLocale } from '../../../domains/bundle/load.js';

const manifest = `apiVersion: opensuper/v1alpha1
kind: SkillBundle
metadata:
  name: localized-bundle
  version: 1.0.0
  description: Localized workflow
  defaultLocale: zh
  locales: [zh, en]
skills:
  - id: demo
    path: skills/demo
    visibility: entry
resources:
  rules:
    - id: workflow
      path: rules/workflow.md
      mode: always
      required: true
  references: [references/state.md]
  scripts:
    - id: verify
      path: scripts/verify-state.mjs
      sideEffect: read
      runtime: node
  assets: [assets/icon.bin]
platforms:
  requires: [skills]
  optional: [rules, references, scripts, assets]
engine:
  enabled: false
`;

describe('resolveBundleLocale', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-bundle-locale-'));
    await fs.mkdir(path.join(root, 'skills', 'demo'), { recursive: true });
    await fs.mkdir(path.join(root, 'rules'), { recursive: true });
    await fs.mkdir(path.join(root, 'references'), { recursive: true });
    await fs.mkdir(path.join(root, 'scripts'), { recursive: true });
    await fs.mkdir(path.join(root, 'assets'), { recursive: true });
    await fs.mkdir(path.join(root, 'locales', 'en', 'skills', 'demo'), { recursive: true });
    await fs.mkdir(path.join(root, 'locales', 'en', 'rules'), { recursive: true });
    await fs.writeFile(path.join(root, 'bundle.yaml'), manifest);
    await fs.writeFile(path.join(root, 'skills', 'demo', 'SKILL.md'), '# 中文\n');
    await fs.writeFile(path.join(root, 'skills', 'demo', 'reference.md'), '中文参考\n');
    await fs.writeFile(path.join(root, 'rules', 'workflow.md'), '中文规则\n');
    await fs.writeFile(path.join(root, 'references', 'state.md'), '中文状态\n');
    await fs.writeFile(path.join(root, 'scripts', 'verify-state.mjs'), 'process.exit(0);\n');
    await fs.writeFile(path.join(root, 'assets', 'icon.bin'), Buffer.from([1, 2, 3]));
    await fs.writeFile(
      path.join(root, 'locales', 'en', 'skills', 'demo', 'SKILL.md'),
      '# English\n',
    );
    await fs.writeFile(path.join(root, 'locales', 'en', 'rules', 'workflow.md'), 'English rule\n');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('overlays localized files and retains shared resources', async () => {
    const resolved = await resolveBundleLocale(await loadBundle(root), 'en');

    expect(resolved.locale).toBe('en');
    expect(await fs.readFile(resolved.files.get('skills/demo/SKILL.md')!, 'utf8')).toContain(
      'English',
    );
    expect(await fs.readFile(resolved.files.get('rules/workflow.md')!, 'utf8')).toContain(
      'English',
    );
    expect(resolved.files.has('skills/demo/reference.md')).toBe(true);
    expect(resolved.files.has('scripts/verify-state.mjs')).toBe(true);
    expect(resolved.files.has('assets/icon.bin')).toBe(true);
  });

  it('uses root files for the default locale without requiring overlays', async () => {
    const resolved = await resolveBundleLocale(await loadBundle(root));

    expect(resolved.locale).toBe('zh');
    expect(await fs.readFile(resolved.files.get('skills/demo/SKILL.md')!, 'utf8')).toContain(
      '中文',
    );
  });

  it('rejects an unsupported locale', async () => {
    await expect(resolveBundleLocale(await loadBundle(root), 'ja')).rejects.toThrow(
      'Unsupported Bundle locale: ja',
    );
  });

  it('rejects locale files outside the declared resource graph', async () => {
    await fs.mkdir(path.join(root, 'locales', 'en', 'extra'), { recursive: true });
    await fs.writeFile(path.join(root, 'locales', 'en', 'extra', 'notes.md'), 'not declared\n');

    await expect(resolveBundleLocale(await loadBundle(root), 'en')).rejects.toThrow(
      'Locale overlay is outside the Bundle resource graph: extra/notes.md',
    );
  });

  it.each(['scripts/verify-state.mjs', 'assets/icon.bin'])(
    'does not allow locale overlays for shared file %s',
    async (relative) => {
      const target = path.join(root, 'locales', 'en', relative);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, 'localized\n');

      await expect(resolveBundleLocale(await loadBundle(root), 'en')).rejects.toThrow(
        `Locale overlay cannot replace shared resource: ${relative}`,
      );
    },
  );
});
