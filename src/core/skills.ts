import path from 'path';
import { fileURLToPath } from 'url';

import { fileExists, readJson, copyFile, ensureDir } from '../utils/file-system.js';
import type { Platform } from './platforms.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type LanguageConfig = {
  id: string;
  name: string;
  skillsDir: string;
};

type Manifest = {
  version: string;
  skills: string[];
  languages?: LanguageConfig[];
};

function getAssetsDir(): string {
  return path.resolve(__dirname, '..', '..', 'assets');
}

async function copyOpenSuperSkillsForPlatform(
  baseDir: string,
  platform: Platform,
  overwrite: boolean,
  languageSkillsDir: string = 'skills',
): Promise<{ copied: number; skipped: number }> {
  const assetsDir = getAssetsDir();
  const manifestPath = path.join(assetsDir, 'manifest.json');

  if (!(await fileExists(manifestPath))) {
    throw new Error(`Manifest not found at ${manifestPath}`);
  }

  const manifest = await readJson<Manifest>(manifestPath);
  if (!manifest || !Array.isArray(manifest.skills)) {
    throw new Error(`Invalid manifest at ${manifestPath}: "skills" must be an array`);
  }
  let copied = 0;
  let skippedCount = 0;

  for (const skillRelPath of manifest.skills) {
    const isScript = skillRelPath.includes('/scripts/');
    const sourceDir = isScript ? 'skills' : languageSkillsDir;

    const src = path.join(assetsDir, sourceDir, skillRelPath);
    const dest = path.join(baseDir, platform.skillsDir, 'skills', skillRelPath);

    if (!overwrite && (await fileExists(dest))) {
      skippedCount++;
      continue;
    }

    try {
      await copyFile(src, dest);
      copied++;
    } catch (err) {
      console.error(`    Failed to copy ${skillRelPath}: ${(err as Error).message}`);
    }
  }

  return { copied, skipped: skippedCount };
}

async function readManifest(): Promise<Manifest> {
  const assetsDir = getAssetsDir();
  const manifestPath = path.join(assetsDir, 'manifest.json');
  return readJson<Manifest>(manifestPath);
}

async function getManifestSkills(): Promise<string[]> {
  const manifest = await readManifest();
  return manifest.skills;
}

async function createWorkingDirs(projectPath: string): Promise<void> {
  const dirs = [
    path.join(projectPath, 'docs', 'superpowers', 'specs'),
    path.join(projectPath, 'docs', 'superpowers', 'plans'),
  ];

  for (const dir of dirs) {
    await ensureDir(dir);
  }
}

export {
  copyOpenSuperSkillsForPlatform,
  readManifest,
  getManifestSkills,
  createWorkingDirs,
  getAssetsDir,
};
export type { Manifest, LanguageConfig };
