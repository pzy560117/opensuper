import { describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import {
  getManagedSkillPaths,
  getManifestSkills,
  getUserFacingSkillNames,
  readManifest,
  type Manifest,
} from '../../../domains/skill/platform-install.js';

const manifest: Manifest = {
  version: '1.0.0',
  skills: ['opensuper/SKILL.md', 'opensuper-open/SKILL.md', 'opensuper/scripts/runtime.mjs'],
  internalSkills: ['opensuper/runtime/classic/skill.yaml'],
};

describe('internal Skill assets', () => {
  it('binds every Classic entry Skill to an explicit current change', async () => {
    const skillNames = [
      'opensuper-classic',
      'opensuper-open',
      'opensuper-design',
      'opensuper-build',
      'opensuper-verify',
      'opensuper-archive',
      'opensuper-hotfix',
      'opensuper-tweak',
    ];

    for (const name of skillNames) {
      const [chinese, english] = await Promise.all(
        ['assets/skills-zh', 'assets/skills'].map((root) =>
          fs.readFile(path.resolve(root, name, 'SKILL.md'), 'utf8'),
        ),
      );
      expect(chinese, `${name} Chinese selection protocol`).toContain(
        'opensuper state select <change-name>',
      );
      expect(english, `${name} English selection protocol`).toContain(
        'opensuper state select <change-name>',
      );
    }

    const [chineseRule, englishRule] = await Promise.all([
      fs.readFile(path.resolve('assets/skills/opensuper/rules/opensuper-phase-guard.md'), 'utf8'),
      fs.readFile(
        path.resolve('assets/skills/opensuper/rules/opensuper-phase-guard.en.md'),
        'utf8',
      ),
    ]);
    expect(chineseRule).toContain('多个 active change');
    expect(chineseRule).toContain('不随当前 manifest 安装');
    expect(englishRule).toContain('multiple active changes');
    expect(englishRule).toContain('not installed by the current manifest');

    const [chineseBuild, englishBuild] = await Promise.all([
      fs.readFile(path.resolve('assets/skills-zh/opensuper-build/SKILL.md'), 'utf8'),
      fs.readFile(path.resolve('assets/skills/opensuper-build/SKILL.md'), 'utf8'),
    ]);
    for (const build of [chineseBuild, englishBuild]) {
      const selection = build.indexOf('opensuper state select <change-name>');
      const entry = build.indexOf('opensuper state check <name> build --json');
      expect(selection).toBeGreaterThanOrEqual(0);
      expect(entry).toBeGreaterThan(selection);
    }
  });

  it('includes internal Skills in managed lifecycle paths', () => {
    expect(getManagedSkillPaths(manifest)).toEqual([
      'opensuper/SKILL.md',
      'opensuper-open/SKILL.md',
      'opensuper/scripts/runtime.mjs',
      'opensuper/runtime/classic/skill.yaml',
    ]);
  });

  it('keeps the bilingual Hotfix execution summary aligned', async () => {
    const [chinese, english] = await Promise.all([
      fs.readFile(path.resolve('assets/skills-zh/opensuper-hotfix/SKILL.md'), 'utf8'),
      fs.readFile(path.resolve('assets/skills/opensuper-hotfix/SKILL.md'), 'utf8'),
    ]);

    expect(chinese).toContain('open → build → 根因消除检查 → verify → archive');
    expect(english).toContain('open → build → root-cause elimination check → verify → archive');
  });

  it('excludes internal Skills from user-facing command names', () => {
    expect(getUserFacingSkillNames(manifest)).toEqual(['opensuper', 'opensuper-open']);
  });

  it('declares the internalSkills collection in the shipped manifest', async () => {
    const shipped = await readManifest();

    expect(shipped.internalSkills).toEqual([
      'opensuper/runtime/classic/skill.yaml',
      'opensuper/runtime/classic/guardrails.yaml',
      'opensuper/runtime/classic/checks.yaml',
    ]);
    expect(getUserFacingSkillNames(shipped)).toContain('opensuper-classic');
    expect(getUserFacingSkillNames(shipped)).not.toContain('runtime');
    expect(await getManifestSkills()).toEqual(getManagedSkillPaths(shipped));
  });

  it('selects Native, Classic, and shared opensuper-any assets by workflow', async () => {
    const shipped = await readManifest();
    const native = await getManifestSkills('native');
    const classic = await getManifestSkills('classic');
    const both = await getManifestSkills('both');

    expect(native).toEqual(
      getManagedSkillPaths(shipped).filter(
        (skillPath) =>
          skillPath === 'opensuper/SKILL.md' ||
          skillPath.startsWith('opensuper-review/') ||
          skillPath === 'opensuper/scripts/opensuper-entry-runtime.mjs' ||
          skillPath === 'opensuper/scripts/opensuper-hook-router.mjs' ||
          skillPath.startsWith('opensuper-memory/') ||
          skillPath.startsWith('opensuper-native/') ||
          skillPath.startsWith('opensuper-any/'),
      ),
    );
    expect(native).toContain('opensuper-any/SKILL.md');
    expect(native).toContain('opensuper-review/SKILL.md');
    expect(native).not.toContain('opensuper-classic/SKILL.md');
    expect(native).not.toContain('opensuper-classic/reference/scripts.md');
    expect(native).not.toContain('opensuper-open/SKILL.md');

    expect(classic).toContain('opensuper-any/SKILL.md');
    expect(classic).toContain('opensuper-review/SKILL.md');
    expect(classic).toContain('opensuper-classic/SKILL.md');
    expect(classic).toContain('opensuper-classic/reference/scripts.md');
    expect(classic).toContain('opensuper-open/SKILL.md');
    expect(classic).not.toContain('opensuper-native/SKILL.md');
    expect(both).toEqual(getManagedSkillPaths(shipped));
  });
});
