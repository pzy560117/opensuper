import path from 'path';
import os from 'os';

import { fileExists, readDir } from '../utils/file-system.js';
import { PLATFORMS, type Platform } from './platforms.js';

import type { InstallScope } from './types.js';

const SUPERPOWERS_SKILLS = [
  'brainstorming',
  'using-superpowers',
  'writing-plans',
  'test-driven-development',
  'subagent-driven-development',
];

function getBaseDir(scope: InstallScope, projectPath: string): string {
  return scope === 'global' ? os.homedir() : projectPath;
}

/**
 * Check if superpowers are installed via Claude Code plugin system.
 * Looks in ~/.claude/plugins/cache/{marketplace}/superpowers/{version}/skills/
 */
async function hasPluginSuperpowers(): Promise<boolean> {
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const pluginsCacheDir = path.join(claudeDir, 'plugins', 'cache');

  const marketplaceEntries = await readDir(pluginsCacheDir);
  for (const marketplace of marketplaceEntries) {
    const superpowersDir = path.join(pluginsCacheDir, marketplace, 'superpowers');
    if (!(await fileExists(superpowersDir))) continue;

    const versionEntries = await readDir(superpowersDir);
    for (const version of versionEntries) {
      const skillsDir = path.join(superpowersDir, version, 'skills');
      const skills = await readDir(skillsDir);
      if (SUPERPOWERS_SKILLS.some((name) => skills.includes(name))) {
        return true;
      }
    }
  }
  return false;
}

async function detectPlatforms(projectPath: string): Promise<Set<string>> {
  const detected = new Set<string>();

  for (const platform of PLATFORMS) {
    if (platform.detectionPaths && platform.detectionPaths.length > 0) {
      for (const p of platform.detectionPaths) {
        if (await fileExists(path.join(projectPath, p))) {
          detected.add(platform.id);
          break;
        }
      }
    } else {
      const dirPath = path.join(projectPath, platform.skillsDir);
      if (await fileExists(dirPath)) {
        detected.add(platform.id);
      }
    }
  }

  return detected;
}

async function hasSkills(
  baseDir: string,
  platform: Platform,
  component: 'openspec' | 'superpowers' | 'opensuper',
  _selectedPlatforms: Platform[] = [],
): Promise<boolean> {
  const skillsDir = path.join(baseDir, platform.skillsDir, 'skills');
  const entries = await readDir(skillsDir);

  switch (component) {
    case 'openspec':
      if (entries.some((e) => e.startsWith('openspec-'))) return true;
      break;
    case 'superpowers':
      if (SUPERPOWERS_SKILLS.some((name) => entries.includes(name))) return true;
      break;
    case 'opensuper':
      if (entries.some((e) => e.startsWith('opensuper'))) return true;
      break;
  }

  if (baseDir !== os.homedir()) {
    const globalSkillsDir = path.join(os.homedir(), platform.skillsDir, 'skills');
    const globalEntries = await readDir(globalSkillsDir);

    switch (component) {
      case 'openspec':
        if (globalEntries.some((e) => e.startsWith('openspec-'))) return true;
        break;
      case 'superpowers':
        if (SUPERPOWERS_SKILLS.some((name) => globalEntries.includes(name))) return true;
        break;
      case 'opensuper':
        if (globalEntries.some((e) => e.startsWith('opensuper'))) return true;
        break;
    }
  }

  // Check Claude Code plugin cache for plugin-installed superpowers
  if (component === 'superpowers' && platform.id === 'claude') {
    if (await hasPluginSuperpowers()) return true;
  }

  return false;
}

export { detectPlatforms, hasSkills, hasPluginSuperpowers, getBaseDir };
export type { InstallScope };
