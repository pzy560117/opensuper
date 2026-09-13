import { promises as fs } from 'fs';
import path from 'path';
import {
  planBundleHook,
  planBundleOverride,
  planBundleRule,
  type BundlePlatformTarget,
} from './bundle-platform.js';
import { planSkillDirectoryCopy } from '../skill/platform-install.js';
import type {
  BundleCapability,
  BundleCompilerIr,
  ExecutableDisclosure,
  PlatformInstallFile,
} from './types.js';

export interface PlatformCompileReport {
  platform: string;
  scope: 'project' | 'global';
  files: PlatformInstallFile[];
  entrySkills: string[];
  unsupported: Array<{
    capability: BundleCapability;
    required: boolean;
    reason: string;
  }>;
  executableDisclosures: ExecutableDisclosure[];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function required(ir: BundleCompilerIr, capability: BundleCapability): boolean {
  return ir.capabilities.requires.includes(capability);
}

function addUnsupported(
  report: PlatformCompileReport,
  ir: BundleCompilerIr,
  capability: BundleCapability,
  reason: string,
  forcedRequired?: boolean,
): void {
  if (report.unsupported.some((item) => item.capability === capability)) return;
  report.unsupported.push({
    capability,
    required: forcedRequired ?? required(ir, capability),
    reason,
  });
}

function overrideFor(
  ir: BundleCompilerIr,
  platform: string,
  replaces: string,
): BundleCompilerIr['overrides'][number] | undefined {
  return ir.overrides.find(
    (override) => override.platform === platform && override.replaces === replaces,
  );
}

function skillResourceDestination(
  ir: BundleCompilerIr,
  target: BundlePlatformTarget,
  logicalPath: string,
): string | null {
  for (const skill of ir.skills) {
    const prefix = `${skill.logicalRoot.replace(/\/+$/, '')}/`;
    if (!logicalPath.startsWith(prefix)) continue;
    return path.join(
      target.layout.skillsRoot,
      skill.id,
      ...logicalPath.slice(prefix.length).split('/'),
    );
  }
  return null;
}

function capabilityCoveredByOverrides(
  ir: BundleCompilerIr,
  platform: string,
  capability: BundleCapability,
): boolean {
  if (capability === 'hooks') {
    return (
      ir.hooks.length > 0 &&
      ir.hooks.every((hook) => overrideFor(ir, platform, `hooks.${hook.id}`) !== undefined)
    );
  }
  if (capability === 'rules') {
    return (
      ir.rules.length > 0 &&
      ir.rules.every((rule) => overrideFor(ir, platform, `rules.${rule.id}`) !== undefined)
    );
  }
  return false;
}

async function collectEngineFiles(
  root: string,
  directory: string,
  destinationRoot: string,
  files: PlatformInstallFile[],
): Promise<void> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => compareText(left.name, right.name));
  for (const entry of entries) {
    const source = path.join(directory, entry.name);
    const stats = await fs.lstat(source);
    if (stats.isSymbolicLink()) {
      throw new Error(`${path.relative(root, source).replaceAll('\\', '/')} is a symbolic link`);
    }
    if (stats.isDirectory()) {
      await collectEngineFiles(root, source, destinationRoot, files);
    } else if (stats.isFile()) {
      files.push({
        source,
        destination: path.join(destinationRoot, path.relative(root, source)),
        kind: 'engine',
      });
    }
  }
}

export async function compileBundleForPlatform(
  ir: BundleCompilerIr,
  target: BundlePlatformTarget,
  options: { projectRoot: string; scope: 'project' | 'global'; locale: string },
): Promise<PlatformCompileReport> {
  const report: PlatformCompileReport = {
    platform: target.id,
    scope: options.scope,
    files: [],
    entrySkills: ir.skills
      .filter((skill) => skill.visibility === 'entry')
      .map((skill) => skill.id)
      .sort(compareText),
    unsupported: [],
    executableDisclosures: [],
  };

  for (const skill of ir.skills) {
    const planned = planSkillDirectoryCopy(
      skill.files,
      path.join(target.layout.skillsRoot, skill.id),
    );
    report.files.push(...planned.map((file) => ({ ...file, kind: 'skill' as const })));
  }

  for (const rule of ir.rules) {
    const replacement = overrideFor(ir, target.id, `rules.${rule.id}`);
    if (replacement) {
      report.files.push(planBundleOverride(target, replacement, 'rule'));
      continue;
    }
    const planned = planBundleRule(target, rule);
    if (planned.length > 0) report.files.push(...planned);
    else
      addUnsupported(report, ir, 'rules', `Platform ${target.id} cannot express rule ${rule.id}`);
  }

  for (const hook of ir.hooks) {
    const replacement = overrideFor(ir, target.id, `hooks.${hook.id}`);
    if (replacement) {
      report.files.push(planBundleOverride(target, replacement, 'hook'));
      continue;
    }
    const hookScript = ir.scripts.find((script) => script.id === hook.script);
    const installedScript = hookScript
      ? skillResourceDestination(ir, target, hookScript.path)
      : null;
    const commandScript = installedScript
      ? path.relative(target.layout.baseDir, installedScript).replaceAll('\\', '/')
      : undefined;
    const planned = planBundleHook(
      target,
      hook,
      ir.scripts,
      ir.bundle.name,
      installedScript ?? undefined,
      commandScript,
    );
    if (planned) {
      report.files.push(...planned.files);
      report.executableDisclosures.push(planned.disclosure);
    } else {
      addUnsupported(report, ir, 'hooks', `Platform ${target.id} cannot express hook ${hook.id}`);
    }
  }

  const supportRoot = path.join(target.layout.scriptsRoot!, ir.bundle.name);
  for (const script of ir.scripts) {
    if (skillResourceDestination(ir, target, script.path)) continue;
    report.files.push({
      source: script.source,
      destination: path.join(supportRoot, ...script.path.split('/')),
      kind: 'script',
    });
  }
  for (const reference of ir.references) {
    if (skillResourceDestination(ir, target, reference.logicalPath)) continue;
    report.files.push({
      source: reference.source,
      destination: path.join(supportRoot, ...reference.logicalPath.split('/')),
      kind: 'reference',
    });
  }
  for (const asset of ir.assets) {
    if (skillResourceDestination(ir, target, asset.logicalPath)) continue;
    report.files.push({
      source: asset.source,
      destination: path.join(supportRoot, ...asset.logicalPath.split('/')),
      kind: 'asset',
    });
  }

  for (const agent of ir.agents) {
    if (agent.platform !== target.id || !target.layout.agentsRoot) {
      if (agent.required) {
        addUnsupported(
          report,
          ir,
          'agents',
          `Platform ${target.id} cannot express agent ${agent.id}`,
          true,
        );
      }
      continue;
    }
    report.files.push({
      source: agent.source,
      destination: path.join(target.layout.agentsRoot, `${agent.id}.md`),
      kind: 'agent',
    });
  }

  if (ir.engine) {
    await collectEngineFiles(
      ir.engine.sourceRoot,
      ir.engine.sourceRoot,
      path.join(supportRoot, 'engine'),
      report.files,
    );
  }

  for (const capability of [...ir.capabilities.requires, ...ir.capabilities.optional]) {
    if (
      !target.capabilities.has(capability) &&
      !capabilityCoveredByOverrides(ir, target.id, capability) &&
      !report.unsupported.some((item) => item.capability === capability)
    ) {
      addUnsupported(
        report,
        ir,
        capability,
        `Platform ${target.id} does not support ${capability}`,
      );
    }
  }

  report.files.sort((left, right) => compareText(left.destination, right.destination));
  report.unsupported.sort((left, right) => compareText(left.capability, right.capability));
  report.executableDisclosures.sort((left, right) => compareText(left.id, right.id));
  return report;
}

export type { BundlePlatformTarget };
