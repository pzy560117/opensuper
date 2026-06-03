import path from 'path';
import os from 'os';
import { createRequire } from 'module';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { fileExists, readDir, readJson } from '../utils/file-system.js';
import { getBaseDir } from '../core/detect.js';
import { copyOpenSuperSkillsForPlatform, getManifestSkills } from '../core/skills.js';
import { PLATFORMS, type Platform } from '../core/platforms.js';
import type { InstallScope } from '../core/types.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');
const PACKAGE_NAME = '@pzy560117/opensuper';

interface UpdateOptions {
  json?: boolean;
  language?: string;
  scope?: InstallScope;
  skipNpm?: boolean;
}

type SkillLanguage = 'en' | 'zh';

interface InstalledOpenSuperTarget {
  scope: InstallScope;
  platform: Platform;
  language: SkillLanguage;
}

interface DetectTargetsOptions {
  scopes?: InstallScope[];
  globalBaseDir?: string;
}

function languageToSkillsDir(language: string | undefined, fallback: SkillLanguage): string {
  return (language ?? fallback) === 'zh' ? 'skills-zh' : 'skills';
}

function getScopedBaseDir(
  scope: InstallScope,
  projectPath: string,
  globalBaseDir = os.homedir(),
): string {
  return scope === 'global' ? globalBaseDir : projectPath;
}

async function hasLocalOpenSuperSkills(baseDir: string, platform: Platform): Promise<boolean> {
  const skillsDir = path.join(baseDir, platform.skillsDir, 'skills');
  const entries = await readDir(skillsDir);
  return entries.some((entry) => entry.startsWith('opensuper'));
}

async function detectInstalledOpenSuperLanguage(
  baseDir: string,
  platform: Platform,
): Promise<SkillLanguage> {
  const skillsDir = path.join(baseDir, platform.skillsDir, 'skills');
  const entries = (await readDir(skillsDir)).filter((entry) => entry.startsWith('opensuper'));

  for (const entry of entries) {
    const skillPath = path.join(skillsDir, entry, 'SKILL.md');
    if (!(await fileExists(skillPath))) continue;

    try {
      const content = await fs.readFile(skillPath, 'utf-8');
      if (/[\u3400-\u9fff]/u.test(content)) return 'zh';
    } catch {
      // Fall through to the default English asset set if the file cannot be read.
    }
  }

  return 'en';
}

async function detectInstalledOpenSuperTargets(
  projectPath: string,
  options: DetectTargetsOptions = {},
): Promise<InstalledOpenSuperTarget[]> {
  const scopes = options.scopes ?? (['project', 'global'] as InstallScope[]);
  const targets: InstalledOpenSuperTarget[] = [];

  for (const scope of scopes) {
    const baseDir = getScopedBaseDir(scope, projectPath, options.globalBaseDir);

    for (const platform of PLATFORMS) {
      if (!(await hasLocalOpenSuperSkills(baseDir, platform))) continue;

      targets.push({
        scope,
        platform,
        language: await detectInstalledOpenSuperLanguage(baseDir, platform),
      });
    }
  }

  return targets;
}

function isSameOrInside(childPath: string, parentPath: string): boolean {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function detectOpenSuperPackageScope(
  projectPath: string,
  packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'),
): Promise<InstallScope> {
  const localPackageRoot = path.join(projectPath, 'node_modules', 'opensuper');
  if (isSameOrInside(packageRoot, localPackageRoot)) return 'project';

  const packageJsonPath = path.join(projectPath, 'package.json');
  if (await fileExists(packageJsonPath)) {
    const pkg = await readJson<{
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    }>(packageJsonPath);

    if (
      pkg.dependencies?.[PACKAGE_NAME] ||
      pkg.devDependencies?.[PACKAGE_NAME] ||
      pkg.optionalDependencies?.[PACKAGE_NAME]
    ) {
      return 'project';
    }
  }

  return 'global';
}

function buildNpmUpdateArgs(scope: InstallScope): string[] {
  return scope === 'global'
    ? ['install', '-g', `${PACKAGE_NAME}@latest`]
    : ['install', `${PACKAGE_NAME}@latest`];
}

function formatNpmUpdateCommand(scope: InstallScope): string {
  return ['npm', ...buildNpmUpdateArgs(scope)].join(' ');
}

function formatSkillUpdateCommand(
  scope: InstallScope,
  platform: Platform,
  languageSkillsDir: string,
): string {
  const destPrefix = scope === 'global' ? '~/' : '';
  return `copy assets/${languageSkillsDir} -> ${destPrefix}${platform.skillsDir}/skills/ (${scope})`;
}

function getNpmExecutable(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

async function updateOpenSuperNpmPackage(
  scope: InstallScope,
  projectPath: string,
): Promise<boolean> {
  const args = buildNpmUpdateArgs(scope);
  const cwd = scope === 'global' ? process.cwd() : projectPath;

  return new Promise((resolve) => {
    const child = spawn(getNpmExecutable(), args, { cwd, stdio: 'inherit' });
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
}

export async function updateCommand(
  targetPath: string,
  options: UpdateOptions = {},
): Promise<void> {
  const projectPath = path.resolve(targetPath);
  const log = options.json ? () => undefined : console.log;

  log(`\n  OpenSuper Update v${version}\n`);

  const packageScope = options.scope ?? (await detectOpenSuperPackageScope(projectPath));
  let npmStatus: 'updated' | 'failed' | 'skipped' = 'skipped';
  if (!options.skipNpm) {
    log(`  Updating npm package (${packageScope} scope)...`);
    log(`    $ ${formatNpmUpdateCommand(packageScope)}`);
    const npmUpdated = await updateOpenSuperNpmPackage(packageScope, projectPath);
    if (npmUpdated) {
      npmStatus = 'updated';
      log(`  npm package: updated to latest ${PACKAGE_NAME}`);
    } else {
      npmStatus = 'failed';
      log(`  npm package: update failed, continuing with bundled skills`);
    }
  }

  const targets = await detectInstalledOpenSuperTargets(projectPath, {
    scopes: options.scope ? [options.scope] : undefined,
  });

  if (targets.length === 0) {
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            npm: {
              scope: options.skipNpm ? 'skipped' : packageScope,
              status: npmStatus,
              command: options.skipNpm ? null : formatNpmUpdateCommand(packageScope),
            },
            skills: { totalCopied: 0, targets: [] },
          },
          null,
          2,
        ),
      );
      return;
    }
    log('\n  No platforms with opensuper skills installed. Run `opensuper init` first.\n');
    return;
  }

  log(`\n  Updating opensuper skills on ${targets.length} installed target(s):`);
  for (const target of targets) {
    const language = options.language ?? target.language;
    const scopeLabel = target.scope === 'global' ? 'global' : `project (${projectPath})`;
    const languageSkillsDir = languageToSkillsDir(options.language, target.language);
    log(`    - ${target.platform.name} (${scopeLabel}, ${language})`);
    log(`      $ ${formatSkillUpdateCommand(target.scope, target.platform, languageSkillsDir)}`);
  }

  // Copy skills for each platform (overwrite)
  log(`\n  Copying ${(await getManifestSkills()).length} skill files...\n`);

  let totalCopied = 0;
  const targetResults = [];
  for (const target of targets) {
    const baseDir = getBaseDir(target.scope, projectPath);
    const languageSkillsDir = languageToSkillsDir(options.language, target.language);
    const { copied, skipped } = await copyOpenSuperSkillsForPlatform(
      baseDir,
      target.platform,
      true,
      languageSkillsDir,
    );
    totalCopied += copied;
    targetResults.push({
      scope: target.scope,
      platform: target.platform.id,
      platformName: target.platform.name,
      language: options.language ?? target.language,
      source: languageSkillsDir,
      copied,
      skipped,
      command: formatSkillUpdateCommand(target.scope, target.platform, languageSkillsDir),
    });
    log(
      `  ${target.platform.name} (${target.scope}, ${languageSkillsDir}): ${copied} copied, ${skipped} skipped`,
    );
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          npm: {
            scope: options.skipNpm ? 'skipped' : packageScope,
            status: npmStatus,
            command: options.skipNpm ? null : formatNpmUpdateCommand(packageScope),
          },
          skills: {
            totalCopied,
            targets: targetResults,
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  const languages = [...new Set(targetResults.map((target) => target.language))].join(', ');
  const scopes = [...new Set(targetResults.map((target) => target.scope))].join(', ');
  log(`\n  Summary:`);
  log(`    npm: ${npmStatus}${options.skipNpm ? '' : ` (${packageScope})`}`);
  log(`    skills: ${targets.length} target(s), ${totalCopied} files updated`);
  log(`    scope: ${scopes}`);
  log(`    language: ${languages}`);
  log(`\n  Update complete.\n`);
}

export {
  buildNpmUpdateArgs,
  detectOpenSuperPackageScope,
  detectInstalledOpenSuperLanguage,
  detectInstalledOpenSuperTargets,
  formatNpmUpdateCommand,
  formatSkillUpdateCommand,
};
export type { InstalledOpenSuperTarget, SkillLanguage };
