import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import type { Platform } from '../../src/core/platforms.js';
import {
  buildNpmUpdateArgs,
  detectOpenSuperPackageScope,
  detectInstalledOpenSuperLanguage,
  detectInstalledOpenSuperTargets,
  formatNpmUpdateCommand,
  formatSkillUpdateCommand,
  updateCommand,
} from '../../src/commands/update.js';

const claudePlatform: Platform = {
  id: 'claude',
  name: 'Claude Code',
  skillsDir: '.claude',
  openspecToolId: 'claude',
};

describe('update command helpers', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(
      os.tmpdir(),
      `opensuper-update-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('detects Chinese installed opensuper skills from existing skill content', async () => {
    await fs.mkdir(path.join(tmpDir, '.claude', 'skills', 'opensuper'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.claude', 'skills', 'opensuper', 'SKILL.md'),
      '# OpenSuper\n\n当用户提出需求时，先澄清目标再执行。',
      'utf-8',
    );

    await expect(detectInstalledOpenSuperLanguage(tmpDir, claudePlatform)).resolves.toBe('zh');
  });

  it('detects English installed opensuper skills from existing skill content', async () => {
    await fs.mkdir(path.join(tmpDir, '.claude', 'skills', 'opensuper'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.claude', 'skills', 'opensuper', 'SKILL.md'),
      '# OpenSuper\n\nUse this skill when starting a new change.',
      'utf-8',
    );

    await expect(detectInstalledOpenSuperLanguage(tmpDir, claudePlatform)).resolves.toBe('en');
  });

  it('finds only scopes and platforms that already have opensuper skills installed', async () => {
    const projectDir = path.join(tmpDir, 'project');
    const globalDir = path.join(tmpDir, 'home');

    await fs.mkdir(path.join(projectDir, '.claude', 'skills', 'opensuper'), { recursive: true });
    await fs.writeFile(
      path.join(projectDir, '.claude', 'skills', 'opensuper', 'SKILL.md'),
      '# OpenSuper\n\nUse this skill.',
      'utf-8',
    );

    await fs.mkdir(path.join(projectDir, '.cursor'), { recursive: true });

    await fs.mkdir(path.join(globalDir, '.codex', 'skills', 'opensuper'), { recursive: true });
    await fs.writeFile(
      path.join(globalDir, '.codex', 'skills', 'opensuper', 'SKILL.md'),
      '# OpenSuper\n\n当用户提出需求时使用这个技能。',
      'utf-8',
    );

    const targets = await detectInstalledOpenSuperTargets(projectDir, {
      globalBaseDir: globalDir,
    });

    expect(targets.map((t) => `${t.scope}:${t.platform.id}:${t.language}`)).toEqual([
      'project:claude:en',
      'global:codex:zh',
    ]);
  });

  it('respects explicit scope filtering when detecting installed targets', async () => {
    const projectDir = path.join(tmpDir, 'project');
    const globalDir = path.join(tmpDir, 'home');

    await fs.mkdir(path.join(projectDir, '.claude', 'skills', 'opensuper'), { recursive: true });
    await fs.writeFile(path.join(projectDir, '.claude', 'skills', 'opensuper', 'SKILL.md'), '# OpenSuper');
    await fs.mkdir(path.join(globalDir, '.codex', 'skills', 'opensuper'), { recursive: true });
    await fs.writeFile(path.join(globalDir, '.codex', 'skills', 'opensuper', 'SKILL.md'), '# OpenSuper');

    const targets = await detectInstalledOpenSuperTargets(projectDir, {
      globalBaseDir: globalDir,
      scopes: ['global'],
    });

    expect(targets.map((t) => `${t.scope}:${t.platform.id}`)).toEqual(['global:codex']);
  });

  it('detects project package scope from local node_modules install path', async () => {
    const projectDir = path.join(tmpDir, 'project');
    const packageRoot = path.join(projectDir, 'node_modules', 'opensuper');

    await expect(detectOpenSuperPackageScope(projectDir, packageRoot)).resolves.toBe('project');
  });

  it('detects project package scope from package.json dependencies', async () => {
    const projectDir = path.join(tmpDir, 'project');
    await fs.mkdir(projectDir, { recursive: true });
    await fs.writeFile(
      path.join(projectDir, 'package.json'),
      JSON.stringify({ devDependencies: { 'opensuper': '^0.2.4' } }),
      'utf-8',
    );

    await expect(detectOpenSuperPackageScope(projectDir, tmpDir)).resolves.toBe('project');
  });

  it('falls back to global package scope when no project install is found', async () => {
    const projectDir = path.join(tmpDir, 'project');
    await fs.mkdir(projectDir, { recursive: true });

    await expect(detectOpenSuperPackageScope(projectDir, tmpDir)).resolves.toBe('global');
  });

  it('builds npm update args preserving package install scope', () => {
    expect(buildNpmUpdateArgs('global')).toEqual(['install', '-g', 'opensuper@latest']);
    expect(buildNpmUpdateArgs('project')).toEqual(['install', 'opensuper@latest']);
  });

  it('formats the npm update command for friendly console output', () => {
    expect(formatNpmUpdateCommand('global')).toBe('npm install -g opensuper@latest');
    expect(formatNpmUpdateCommand('project')).toBe('npm install opensuper@latest');
  });

  it('formats the skill update command with scope, platform, and language source', () => {
    expect(formatSkillUpdateCommand('project', claudePlatform, 'skills-zh')).toBe(
      'copy assets/skills-zh -> .claude/skills/ (project)',
    );
    expect(formatSkillUpdateCommand('global', claudePlatform, 'skills')).toBe(
      'copy assets/skills -> ~/.claude/skills/ (global)',
    );
  });

  it('prints the skill update command when updating installed skills', async () => {
    await fs.mkdir(path.join(tmpDir, '.claude', 'skills', 'opensuper'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.claude', 'skills', 'opensuper', 'SKILL.md'),
      '# OpenSuper\n\n当用户提出需求时使用这个技能。',
      'utf-8',
    );

    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    let output = '';
    try {
      await updateCommand(tmpDir, { skipNpm: true });
      output = log.mock.calls.map((call) => call.join(' ')).join('\n');
    } finally {
      log.mockRestore();
    }

    expect(output).toContain('$ copy assets/skills-zh -> .claude/skills/ (project)');
  });

  it('prints structured JSON when requested', async () => {
    await fs.mkdir(path.join(tmpDir, '.claude', 'skills', 'opensuper'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.claude', 'skills', 'opensuper', 'SKILL.md'),
      '# OpenSuper\n\nUse this skill.',
      'utf-8',
    );

    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    let json = '';
    try {
      await updateCommand(tmpDir, { json: true, skipNpm: true });
      json = log.mock.calls.map((call) => call.join(' ')).join('\n');
    } finally {
      log.mockRestore();
    }

    const result = JSON.parse(json);
    expect(result.npm.scope).toBe('skipped');
    expect(result.skills.totalCopied).toBeGreaterThan(0);
    expect(result.skills.targets[0]).toMatchObject({
      scope: 'project',
      platform: 'claude',
      language: 'en',
      source: 'skills',
    });
  });
});
