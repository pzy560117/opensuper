import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  getAssetsDir,
  readManifest,
  getManifestSkills,
  createWorkingDirs,
  copyOpenSuperSkillsForPlatform,
} from '../../src/core/skills.js';
import type { Platform } from '../../src/core/platforms.js';

describe('skills', () => {
  let tmpDir: string;
  const zhSkillNames = [
    'opensuper',
    'opensuper-open',
    'opensuper-design',
    'opensuper-build',
    'opensuper-verify',
    'opensuper-archive',
    'opensuper-hotfix',
    'opensuper-tweak',
  ];
  const enSkillNames = zhSkillNames;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `opensuper-skills-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('getAssetsDir', () => {
    it('returns a path ending with assets', () => {
      const assetsDir = getAssetsDir();
      expect(path.basename(assetsDir)).toBe('assets');
    });
  });

  describe('readManifest', () => {
    it('reads and parses the manifest.json', async () => {
      const manifest = await readManifest();
      expect(manifest).toHaveProperty('version');
      expect(manifest).toHaveProperty('skills');
      expect(Array.isArray(manifest.skills)).toBe(true);
      expect(manifest.skills.length).toBeGreaterThan(0);
    });
  });

  describe('getManifestSkills', () => {
    it('returns the skills array from manifest', async () => {
      const skills = await getManifestSkills();
      expect(Array.isArray(skills)).toBe(true);
      expect(skills.length).toBeGreaterThan(0);
      expect(skills.some((s) => s.includes('opensuper/SKILL.md'))).toBe(true);
    });
  });

  describe('createWorkingDirs', () => {
    it('creates superpowers spec and plan directories', async () => {
      await createWorkingDirs(tmpDir);

      const specsDir = path.join(tmpDir, 'docs', 'superpowers', 'specs');
      const plansDir = path.join(tmpDir, 'docs', 'superpowers', 'plans');

      await expect(fs.stat(specsDir)).resolves.toBeDefined();
      await expect(fs.stat(plansDir)).resolves.toBeDefined();
    });

    it('does not throw when directories already exist', async () => {
      await createWorkingDirs(tmpDir);
      await expect(createWorkingDirs(tmpDir)).resolves.not.toThrow();
    });
  });

  describe('copyOpenSuperSkillsForPlatform', () => {
    const mockPlatform: Platform = {
      id: 'claude',
      name: 'Claude Code',
      skillsDir: '.claude',
      openspecToolId: 'claude',
    };

    it('copies skill files from assets to platform skills directory', async () => {
      const result = await copyOpenSuperSkillsForPlatform(tmpDir, mockPlatform, false);
      expect(result.copied).toBeGreaterThan(0);
      expect(result.skipped).toBe(0);

      // Verify a key file was copied
      const opensuperSkillPath = path.join(tmpDir, '.claude', 'skills', 'opensuper', 'SKILL.md');
      expect(await fileExists(opensuperSkillPath)).toBe(true);
    });

    it('skips existing files when overwrite is false', async () => {
      // First copy
      await copyOpenSuperSkillsForPlatform(tmpDir, mockPlatform, false);
      // Second copy should skip all
      const result = await copyOpenSuperSkillsForPlatform(tmpDir, mockPlatform, false);
      expect(result.copied).toBe(0);
      expect(result.skipped).toBeGreaterThan(0);
    });

    it('overwrites existing files when overwrite is true', async () => {
      await copyOpenSuperSkillsForPlatform(tmpDir, mockPlatform, false);
      const result = await copyOpenSuperSkillsForPlatform(tmpDir, mockPlatform, true);
      expect(result.copied).toBeGreaterThan(0);
    });

    it('copies to Chinese skills directory when language is zh', async () => {
      const result = await copyOpenSuperSkillsForPlatform(tmpDir, mockPlatform, false, 'skills-zh');
      expect(result.copied).toBeGreaterThan(0);

      // Chinese SKILL.md should exist
      const zhSkillPath = path.join(tmpDir, '.claude', 'skills', 'opensuper', 'SKILL.md');
      expect(await fileExists(zhSkillPath)).toBe(true);
    });
  });

  describe('output language contracts', () => {
    it.each(zhSkillNames)('declares Chinese as the default output language in %s', async (skillName) => {
      const skillPath = path.join('assets', 'skills-zh', skillName, 'SKILL.md');
      const content = await fs.readFile(skillPath, 'utf-8');

      expect(content).toContain('## 产出语言契约');
      expect(content).toContain('默认使用中文');
    });

    it.each(enSkillNames)('declares English as the default output language in %s', async (skillName) => {
      const skillPath = path.join('assets', 'skills', skillName, 'SKILL.md');
      const content = await fs.readFile(skillPath, 'utf-8');

      expect(content).toContain('## Output Language Contract');
      expect(content).toContain('English by default');
    });

    it('passes Chinese output requirements to external skills', async () => {
      const skillPaths = [
        path.join('assets', 'skills-zh', 'opensuper-open', 'SKILL.md'),
        path.join('assets', 'skills-zh', 'opensuper-design', 'SKILL.md'),
        path.join('assets', 'skills-zh', 'opensuper-build', 'SKILL.md'),
        path.join('assets', 'skills-zh', 'opensuper-verify', 'SKILL.md'),
        path.join('assets', 'skills-zh', 'opensuper-hotfix', 'SKILL.md'),
        path.join('assets', 'skills-zh', 'opensuper-tweak', 'SKILL.md'),
      ];

      for (const skillPath of skillPaths) {
        const content = await fs.readFile(skillPath, 'utf-8');
        expect(content).toContain('产出语言：中文');
      }
    });

    it('passes English output requirements to external skills', async () => {
      const skillPaths = [
        path.join('assets', 'skills', 'opensuper-open', 'SKILL.md'),
        path.join('assets', 'skills', 'opensuper-design', 'SKILL.md'),
        path.join('assets', 'skills', 'opensuper-build', 'SKILL.md'),
        path.join('assets', 'skills', 'opensuper-verify', 'SKILL.md'),
        path.join('assets', 'skills', 'opensuper-hotfix', 'SKILL.md'),
        path.join('assets', 'skills', 'opensuper-tweak', 'SKILL.md'),
      ];

      for (const skillPath of skillPaths) {
        const content = await fs.readFile(skillPath, 'utf-8');
        expect(content).toContain('Output language: English');
      }
    });
  });
});

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
