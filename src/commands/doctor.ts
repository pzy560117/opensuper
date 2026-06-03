import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { fileExists, readDir } from '../utils/file-system.js';
import { isCommandAvailable } from '../core/openspec.js';
import { readManifest, getAssetsDir } from '../core/skills.js';
import { PLATFORMS } from '../core/platforms.js';
import type { InstallScope } from '../core/types.js';

interface CheckResult {
  check: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

type DoctorScope = InstallScope | 'auto';

const VALID_YAML_FIELDS = new Set([
  'workflow',
  'phase',
  'build_mode',
  'isolation',
  'verify_mode',
  'verify_result',
  'design_doc',
  'plan',
  'verification_report',
  'branch_status',
  'archived',
  'verified_at',
]);

async function checkOpenSpecCli(): Promise<CheckResult> {
  if (!isCommandAvailable('openspec')) {
    return {
      check: 'openspec CLI',
      status: 'warn',
      message: 'not installed — install with: npm install -g @fission-ai/openspec@latest',
    };
  }
  try {
    const version = execSync('openspec --version', { stdio: 'pipe', timeout: 10_000 })
      .toString()
      .trim();
    return { check: 'openspec CLI', status: 'pass', message: `installed (${version})` };
  } catch {
    return { check: 'openspec CLI', status: 'pass', message: 'installed' };
  }
}

async function checkWorkingDirs(projectPath: string): Promise<CheckResult> {
  const specsDir = path.join(projectPath, 'docs', 'superpowers', 'specs');
  const plansDir = path.join(projectPath, 'docs', 'superpowers', 'plans');
  const specsExist = await fileExists(specsDir);
  const plansExist = await fileExists(plansDir);

  if (specsExist && plansExist) {
    return { check: 'working directories', status: 'pass', message: 'present' };
  }
  if (!specsExist && !plansExist) {
    return {
      check: 'working directories',
      status: 'fail',
      message: 'missing — run: opensuper init',
    };
  }
  const missing = [];
  if (!specsExist) missing.push('specs');
  if (!plansExist) missing.push('plans');
  return {
    check: 'working directories',
    status: 'warn',
    message: `partial (missing: ${missing.join(', ')})`,
  };
}

function getScopeBases(
  projectPath: string,
  scope: DoctorScope,
): Array<{
  scope: InstallScope;
  baseDir: string;
}> {
  if (scope === 'project') return [{ scope, baseDir: projectPath }];
  if (scope === 'global') return [{ scope, baseDir: os.homedir() }];

  const bases: Array<{ scope: InstallScope; baseDir: string }> = [
    { scope: 'project', baseDir: projectPath },
  ];
  if (path.resolve(projectPath) !== path.resolve(os.homedir())) {
    bases.push({ scope: 'global', baseDir: os.homedir() });
  }
  return bases;
}

async function checkSkillCompleteness(
  projectPath: string,
  scope: DoctorScope,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const manifest = await readManifest();

  let anyPlatform = false;
  for (const base of getScopeBases(projectPath, scope)) {
    for (const platform of PLATFORMS) {
      const skillsDir = path.join(base.baseDir, platform.skillsDir, 'skills');
      if (!(await fileExists(skillsDir))) continue;
      anyPlatform = true;

      const missing: string[] = [];
      for (const relPath of manifest.skills) {
        const fullPath = path.join(base.baseDir, platform.skillsDir, 'skills', relPath);
        if (!(await fileExists(fullPath))) {
          missing.push(relPath);
        }
      }

      results.push(
        missing.length === 0
          ? {
              check: `skills: ${platform.name} (${base.scope})`,
              status: 'pass' as const,
              message: `complete (${manifest.skills.length} files)`,
            }
          : {
              check: `skills: ${platform.name} (${base.scope})`,
              status: 'warn' as const,
              message: `missing ${missing.length}: ${missing.join(', ')}`,
            },
      );
    }
  }

  if (!anyPlatform) {
    results.push({
      check: 'skills',
      status: 'warn',
      message:
        scope === 'auto'
          ? 'no platforms detected in project or global scope — run opensuper init'
          : `no platforms detected in ${scope} scope — run opensuper init`,
    });
  }

  return results;
}

async function checkScriptsPresent(): Promise<CheckResult> {
  const assetsDir = getAssetsDir();
  const scriptsDir = path.join(assetsDir, 'skills', 'opensuper', 'scripts');
  if (!(await fileExists(scriptsDir))) {
    return { check: 'scripts present', status: 'warn', message: 'scripts directory not found' };
  }

  const entries = await readDir(scriptsDir);
  const shFiles = entries.filter((e) => e.endsWith('.sh'));

  return {
    check: 'scripts executable',
    status: 'pass',
    message: `OK (${shFiles.length} scripts)`,
  };
}

async function checkOpenSuperYamlValidity(projectPath: string): Promise<CheckResult[]> {
  const changesDir = path.join(projectPath, 'openspec', 'changes');
  if (!(await fileExists(changesDir))) return [];

  const entries = await readDir(changesDir);
  const results: CheckResult[] = [];

  for (const entry of entries) {
    const yamlPath = path.join(changesDir, entry, '.opensuper.yaml');
    if (!(await fileExists(yamlPath))) continue;

    const raw = await fs.readFile(yamlPath, 'utf-8');
    const unknownFields: string[] = [];

    for (const line of raw.split('\n')) {
      const match = line.match(/^(\w[\w_]*):/);
      if (match && !VALID_YAML_FIELDS.has(match[1])) {
        unknownFields.push(match[1]);
      }
    }

    results.push(
      unknownFields.length === 0
        ? { check: `.opensuper.yaml: ${entry}`, status: 'pass' as const, message: 'valid' }
        : {
            check: `.opensuper.yaml: ${entry}`,
            status: 'fail' as const,
            message: `unknown field(s): ${unknownFields.join(', ')}`,
          },
    );
  }

  return results;
}

async function collectResults(projectPath: string, scope: DoctorScope): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  results.push(await checkOpenSpecCli());
  if (scope !== 'global') {
    results.push(await checkWorkingDirs(projectPath));
  }
  results.push(...(await checkSkillCompleteness(projectPath, scope)));
  results.push(await checkScriptsPresent());
  results.push(...(await checkOpenSuperYamlValidity(projectPath)));
  return results;
}

function icon(status: string): string {
  if (status === 'pass') return '✓';
  if (status === 'warn') return '⚠';
  return '✗';
}

interface DoctorOptions {
  json?: boolean;
  scope?: DoctorScope;
}

export async function doctorCommand(
  targetPath: string,
  options: DoctorOptions = {},
): Promise<void> {
  const projectPath = path.resolve(targetPath);
  const scope = options.scope ?? 'auto';
  const results = await collectResults(projectPath, scope);

  if (options.json) {
    console.log(JSON.stringify({ scope, results }, null, 2));
    return;
  }

  console.log(`OpenSuper Doctor (scope: ${scope})\n`);

  for (const r of results) {
    console.log(`  ${icon(r.status)} ${r.check}: ${r.message}`);
  }

  console.log();
}
