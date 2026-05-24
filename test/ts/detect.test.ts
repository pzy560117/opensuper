import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  getBaseDir,
  detectPlatforms,
  hasSkills,
  hasPluginSuperpowers,
} from '../../src/core/detect.js';
import type { Platform } from '../../src/core/platforms.js';

const mockPlatform: Platform = {
  id: 'claude',
  name: 'Claude Code',
  skillsDir: '.claude',
  openspecToolId: 'claude',
};

describe('detect', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(
      os.tmpdir(),
      `opensuper-detect-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('getBaseDir', () => {
    it('returns home directory for global scope', () => {
      expect(getBaseDir('global', tmpDir)).toBe(os.homedir());
    });

    it('returns project path for project scope', () => {
      expect(getBaseDir('project', tmpDir)).toBe(tmpDir);
    });
  });

  describe('detectPlatforms', () => {
    it('detects claude platform when .claude directory exists', async () => {
      await fs.mkdir(path.join(tmpDir, '.claude'));
      const detected = await detectPlatforms(tmpDir);
      expect(detected.has('claude')).toBe(true);
    });

    it('detects github-copilot when copilot-instructions.md exists', async () => {
      await fs.mkdir(path.join(tmpDir, '.github'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, '.github', 'copilot-instructions.md'), '');
      const detected = await detectPlatforms(tmpDir);
      expect(detected.has('github-copilot')).toBe(true);
    });

    it('does not detect github-copilot when only .github dir exists', async () => {
      await fs.mkdir(path.join(tmpDir, '.github'));
      const detected = await detectPlatforms(tmpDir);
      expect(detected.has('github-copilot')).toBe(false);
    });

    it('detects multiple platforms', async () => {
      await fs.mkdir(path.join(tmpDir, '.claude'));
      await fs.mkdir(path.join(tmpDir, '.cursor'));
      const detected = await detectPlatforms(tmpDir);
      expect(detected.has('claude')).toBe(true);
      expect(detected.has('cursor')).toBe(true);
      expect(detected.size).toBeGreaterThanOrEqual(2);
    });

    it('returns empty set when no platforms detected', async () => {
      const detected = await detectPlatforms(tmpDir);
      expect(detected.size).toBe(0);
    });
  });

  describe('hasSkills', () => {
    it('detects openspec skills when openspec- prefixed dirs exist', async () => {
      await fs.mkdir(path.join(tmpDir, '.claude', 'skills', 'openspec-core'), {
        recursive: true,
      });
      expect(await hasSkills(tmpDir, mockPlatform, 'openspec')).toBe(true);
    });

    it('detects superpowers skills', async () => {
      await fs.mkdir(path.join(tmpDir, '.claude', 'skills', 'brainstorming'), {
        recursive: true,
      });
      await fs.mkdir(path.join(tmpDir, '.claude', 'skills', 'using-superpowers'), {
        recursive: true,
      });
      expect(await hasSkills(tmpDir, mockPlatform, 'superpowers')).toBe(true);
    });

    it('detects opensuper skills', async () => {
      await fs.mkdir(path.join(tmpDir, '.claude', 'skills', 'opensuper'), { recursive: true });
      expect(await hasSkills(tmpDir, mockPlatform, 'opensuper')).toBe(true);
    });

    it('returns false for missing skills', async () => {
      await fs.mkdir(path.join(tmpDir, '.claude', 'skills'), { recursive: true });
      expect(await hasSkills(tmpDir, mockPlatform, 'opensuper')).toBe(false);
    });

    it('returns false when skills directory does not exist', async () => {
      expect(await hasSkills(tmpDir, mockPlatform, 'opensuper')).toBe(false);
    });

    it('detects plugin-installed superpowers for claude platform', async () => {
      const origEnv = process.env.CLAUDE_CONFIG_DIR;
      const pluginDir = path.join(tmpDir, '.claude');
      process.env.CLAUDE_CONFIG_DIR = pluginDir;

      const skillsDir = path.join(
        pluginDir,
        'plugins',
        'cache',
        'claude-plugins-official',
        'superpowers',
        '5.0.0',
        'skills',
      );
      await fs.mkdir(skillsDir, { recursive: true });
      await fs.mkdir(path.join(skillsDir, 'brainstorming'));
      await fs.mkdir(path.join(skillsDir, 'using-superpowers'));

      // No skills in the normal location
      await fs.mkdir(path.join(tmpDir, '.claude', 'skills'), { recursive: true });

      expect(await hasSkills(tmpDir, mockPlatform, 'superpowers')).toBe(true);

      if (origEnv !== undefined) {
        process.env.CLAUDE_CONFIG_DIR = origEnv;
      } else {
        delete process.env.CLAUDE_CONFIG_DIR;
      }
    });

    it('does not detect plugin superpowers for non-claude platforms', async () => {
      const origEnv = process.env.CLAUDE_CONFIG_DIR;
      const pluginDir = path.join(tmpDir, '.claude');
      process.env.CLAUDE_CONFIG_DIR = pluginDir;

      const skillsDir = path.join(
        pluginDir,
        'plugins',
        'cache',
        'claude-plugins-official',
        'superpowers',
        '5.0.0',
        'skills',
      );
      await fs.mkdir(skillsDir, { recursive: true });
      await fs.mkdir(path.join(skillsDir, 'brainstorming'));

      const cursorPlatform: Platform = {
        id: 'cursor',
        name: 'Cursor',
        skillsDir: '.cursor',
        openspecToolId: 'cursor',
      };

      expect(await hasSkills(tmpDir, cursorPlatform, 'superpowers')).toBe(false);

      if (origEnv !== undefined) {
        process.env.CLAUDE_CONFIG_DIR = origEnv;
      } else {
        delete process.env.CLAUDE_CONFIG_DIR;
      }
    });
  });

  describe('hasPluginSuperpowers', () => {
    it('returns true when superpowers plugin is installed', async () => {
      const origEnv = process.env.CLAUDE_CONFIG_DIR;
      const pluginDir = path.join(tmpDir, '.claude');
      process.env.CLAUDE_CONFIG_DIR = pluginDir;

      const skillsDir = path.join(
        pluginDir,
        'plugins',
        'cache',
        'test-marketplace',
        'superpowers',
        '5.0.0',
        'skills',
      );
      await fs.mkdir(skillsDir, { recursive: true });
      await fs.mkdir(path.join(skillsDir, 'brainstorming'));
      await fs.mkdir(path.join(skillsDir, 'using-superpowers'));

      expect(await hasPluginSuperpowers()).toBe(true);

      if (origEnv !== undefined) {
        process.env.CLAUDE_CONFIG_DIR = origEnv;
      } else {
        delete process.env.CLAUDE_CONFIG_DIR;
      }
    });

    it('returns false when no plugin cache exists', async () => {
      const origEnv = process.env.CLAUDE_CONFIG_DIR;
      process.env.CLAUDE_CONFIG_DIR = path.join(tmpDir, 'nonexistent');

      expect(await hasPluginSuperpowers()).toBe(false);

      if (origEnv !== undefined) {
        process.env.CLAUDE_CONFIG_DIR = origEnv;
      } else {
        delete process.env.CLAUDE_CONFIG_DIR;
      }
    });

    it('returns false when plugin exists but has no matching skills', async () => {
      const origEnv = process.env.CLAUDE_CONFIG_DIR;
      const pluginDir = path.join(tmpDir, '.claude');
      process.env.CLAUDE_CONFIG_DIR = pluginDir;

      const skillsDir = path.join(
        pluginDir,
        'plugins',
        'cache',
        'test-marketplace',
        'superpowers',
        '5.0.0',
        'skills',
      );
      await fs.mkdir(skillsDir, { recursive: true });
      await fs.mkdir(path.join(skillsDir, 'unrelated-skill'));

      expect(await hasPluginSuperpowers()).toBe(false);

      if (origEnv !== undefined) {
        process.env.CLAUDE_CONFIG_DIR = origEnv;
      } else {
        delete process.env.CLAUDE_CONFIG_DIR;
      }
    });
  });
});
