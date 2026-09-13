import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { loadSkillPackage } from './load.js';
import { hashSkillPackage } from './snapshot.js';
import { validateSkillPackage } from './validate.js';

export interface InstallProjectSkillOptions {
  overwrite?: boolean;
}

export interface InstalledProjectSkill {
  name: string;
  version: string;
  hash: string;
  destination: string;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function rejectSymbolicLinks(root: string, current = root): Promise<void> {
  for (const entry of await fs.readdir(current, { withFileTypes: true })) {
    const target = path.join(current, entry.name);
    const stat = await fs.lstat(target);
    if (stat.isSymbolicLink()) {
      throw new Error(`Skill installation rejects symbolic link: ${path.relative(root, target)}`);
    }
    if (stat.isDirectory()) {
      await rejectSymbolicLinks(root, target);
    }
  }
}

function assertInstallableName(name: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(name)) {
    throw new Error(`Skill metadata.name is not safe for installation: ${name}`);
  }
}

export async function installProjectSkill(
  source: string,
  projectRoot: string,
  options: InstallProjectSkillOptions = {},
): Promise<InstalledProjectSkill> {
  const sourceRoot = path.resolve(source);
  const pkg = await loadSkillPackage(sourceRoot);
  const errors = validateSkillPackage(pkg);
  if (errors.length > 0) {
    throw new Error(`Invalid Skill package:\n${errors.map((error) => `  - ${error}`).join('\n')}`);
  }
  assertInstallableName(pkg.definition.metadata.name);
  await rejectSymbolicLinks(sourceRoot);

  const skillsRoot = path.resolve(projectRoot, '.opensuper', 'skills');
  const destination = path.join(skillsRoot, pkg.definition.metadata.name);
  if (path.resolve(destination) === sourceRoot) {
    throw new Error('Source Skill is already installed at the project destination');
  }
  const exists = await pathExists(destination);
  if (exists && !options.overwrite) {
    throw new Error(
      `Skill "${pkg.definition.metadata.name}" is already installed at ${destination}; use --overwrite to replace it`,
    );
  }

  await fs.mkdir(skillsRoot, { recursive: true });
  const temporary = path.join(skillsRoot, `.tmp-${pkg.definition.metadata.name}-${randomUUID()}`);
  const backup = path.join(skillsRoot, `.backup-${pkg.definition.metadata.name}-${randomUUID()}`);
  let movedExisting = false;

  try {
    await fs.cp(sourceRoot, temporary, { recursive: true, errorOnExist: true, force: false });
    if (exists) {
      await fs.rename(destination, backup);
      movedExisting = true;
    }
    await fs.rename(temporary, destination);
    if (movedExisting) {
      await fs.rm(backup, { recursive: true, force: true });
    }
  } catch (error) {
    await fs.rm(temporary, { recursive: true, force: true });
    if (movedExisting && !(await pathExists(destination)) && (await pathExists(backup))) {
      await fs.rename(backup, destination);
    }
    throw error;
  }

  return {
    name: pkg.definition.metadata.name,
    version: pkg.definition.metadata.version,
    hash: await hashSkillPackage(pkg),
    destination,
  };
}
