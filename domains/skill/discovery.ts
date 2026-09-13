import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadSkillPackage } from './load.js';
import { hashSkillPackage } from './snapshot.js';
import type { SkillPackage } from './types.js';
import { validateSkillPackage } from './validate.js';

export type SkillOrigin = 'explicit' | 'project' | 'builtin';

export interface ResolveSkillOptions {
  projectRoot: string;
  builtinRoot?: string;
  cwd?: string;
}

export interface ResolvedSkill {
  name: string;
  version: string;
  origin: SkillOrigin;
  root: string;
  hash: string;
  package: SkillPackage;
}

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

function defaultBuiltinRoot(): string {
  return path.resolve(moduleDirectory, '..', '..', 'assets', 'skills');
}

async function directoryExists(target: string): Promise<boolean> {
  try {
    return (await fs.stat(target)).isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

function formatValidationErrors(errors: string[]): string {
  return errors.map((error) => `  - ${error}`).join('\n');
}

async function loadResolved(
  root: string,
  origin: SkillOrigin,
  requestedName?: string,
): Promise<ResolvedSkill> {
  let pkg: SkillPackage;
  try {
    pkg = await loadSkillPackage(root);
  } catch (error) {
    const label = requestedName ? `${origin} Skill "${requestedName}"` : `${origin} Skill`;
    throw new Error(
      `Invalid ${label} at ${root}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  const errors = validateSkillPackage(pkg);
  if (requestedName && pkg.definition.metadata.name !== requestedName) {
    errors.unshift(
      `metadata.name must match the discovered name: expected ${requestedName}, got ${pkg.definition.metadata.name}`,
    );
  }
  if (errors.length > 0) {
    const label = requestedName ? `${origin} Skill "${requestedName}"` : `${origin} Skill`;
    throw new Error(`Invalid ${label} at ${root}:\n${formatValidationErrors(errors)}`);
  }

  return {
    name: pkg.definition.metadata.name,
    version: pkg.definition.metadata.version,
    origin,
    root: pkg.root,
    hash: await hashSkillPackage(pkg),
    package: pkg,
  };
}

function looksLikePath(selector: string): boolean {
  return (
    path.isAbsolute(selector) ||
    selector.startsWith('.') ||
    selector.includes('/') ||
    selector.includes('\\')
  );
}

function validateSkillName(name: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(name)) {
    throw new Error(`Invalid Skill name: ${name}`);
  }
}

export async function resolveSkill(
  selector: string,
  options: ResolveSkillOptions,
): Promise<ResolvedSkill> {
  const explicit = path.resolve(options.cwd ?? process.cwd(), selector);
  if (await directoryExists(explicit)) {
    return loadResolved(explicit, 'explicit');
  }
  if (looksLikePath(selector)) {
    throw new Error(`Skill directory not found: ${explicit}`);
  }

  validateSkillName(selector);
  const projectPath = path.resolve(options.projectRoot, '.opensuper', 'skills', selector);
  const builtinPath = path.resolve(options.builtinRoot ?? defaultBuiltinRoot(), selector);

  if (await directoryExists(projectPath)) {
    return loadResolved(projectPath, 'project', selector);
  }
  if (await directoryExists(builtinPath)) {
    return loadResolved(builtinPath, 'builtin', selector);
  }

  throw new Error(
    `Skill "${selector}" was not found. Searched:\n  - ${projectPath}\n  - ${builtinPath}`,
  );
}
