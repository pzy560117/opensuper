import os from 'os';
import { loadBundle } from './load.js';
import { compileBundleIr } from './compiler.js';
import { hashBundle } from './hash.js';
import { compileBundleForPlatform, type PlatformCompileReport } from './platform.js';
import { reconcileBundleAuthoringState } from './state.js';
import type { BundleCapability, PlatformInstallFile } from './types.js';
import {
  applyPlatformInstallPlan,
  listBundlePlatformTargets,
  type BundlePlatformTarget,
} from './bundle-platform.js';

export interface BundleDistributionResult {
  bundle: string;
  hash: string;
  preview: boolean;
  platforms: Array<{
    platform: string;
    status: 'planned' | 'installed' | 'skipped' | 'failed' | 'cancelled';
    written: string[];
    skipped: string[];
    unsupported: PlatformCompileReport['unsupported'];
    executableDisclosures: PlatformCompileReport['executableDisclosures'];
    plannedFiles: Array<{ kind: PlatformInstallFile['kind']; destination: string }>;
    manualAction?: string;
    error?: string;
  }>;
}

function blockingUnsupported(
  report: PlatformCompileReport,
  skipCapabilities: BundleCapability[],
): PlatformCompileReport['unsupported'] {
  return report.unsupported.filter(
    (item) => item.required || !skipCapabilities.includes(item.capability),
  );
}

function requestedTargets(
  targets: BundlePlatformTarget[],
  ids: string[],
): Array<{ id: string; target: BundlePlatformTarget | null }> {
  return ids.map((id) => ({
    id,
    target: targets.find((candidate) => candidate.id === id) ?? null,
  }));
}

function plannedFiles(
  report: PlatformCompileReport,
): Array<{ kind: PlatformInstallFile['kind']; destination: string }> {
  return report.files.map((file) => ({ kind: file.kind, destination: file.destination }));
}

export async function distributeBundle(options: {
  projectRoot: string;
  name: string;
  platforms: string[];
  scope: 'project' | 'global';
  locale?: string;
  overwrite?: boolean;
  skipCapabilities?: BundleCapability[];
  confirmedExecutables?: boolean;
  preview?: boolean;
}): Promise<BundleDistributionResult> {
  const state = await reconcileBundleAuthoringState(options.projectRoot, options.name);
  if (state.status !== 'ready' || !state.ready) {
    throw new Error(`Bundle ${options.name} must be ready before distribution`);
  }

  const bundle = await loadBundle(state.ready.path);
  const currentHash = await hashBundle(bundle);
  if (currentHash !== state.ready.hash || currentHash !== state.currentHash) {
    throw new Error(`Bundle ${options.name} ready state is not bound to the current hash`);
  }

  const locale = options.locale ?? state.defaultLocale;
  const ir = await compileBundleIr(bundle, { locale });
  if (ir.bundle.hash !== currentHash) {
    throw new Error(`Bundle ${options.name} hash changed during distribution compilation`);
  }

  const skipCapabilities = options.skipCapabilities ?? [];
  const targets = requestedTargets(
    listBundlePlatformTargets({
      projectRoot: options.projectRoot,
      homeDir: os.homedir(),
      scope: options.scope,
    }),
    options.platforms,
  );

  const planned: Array<{
    id: string;
    target: BundlePlatformTarget;
    report: PlatformCompileReport;
  }> = [];
  const results: BundleDistributionResult['platforms'] = [];

  for (const item of targets) {
    if (!item.target) {
      results.push({
        platform: item.id,
        status: 'failed',
        written: [],
        skipped: [],
        unsupported: [],
        executableDisclosures: [],
        plannedFiles: [],
        error: `Unknown platform: ${item.id}`,
      });
      continue;
    }
    const report = await compileBundleForPlatform(ir, item.target, {
      projectRoot: options.projectRoot,
      scope: options.scope,
      locale,
    });
    const blocking = blockingUnsupported(report, skipCapabilities);
    if (blocking.length > 0) {
      results.push({
        platform: item.id,
        status: 'cancelled',
        written: [],
        skipped: [],
        unsupported: report.unsupported,
        executableDisclosures: report.executableDisclosures,
        plannedFiles: plannedFiles(report),
        error: `Unsupported capabilities require a decision: ${blocking
          .map((unsupported) => unsupported.capability)
          .join(', ')}`,
      });
      continue;
    }
    planned.push({ id: item.id, target: item.target, report });
  }

  if (options.preview === true) {
    for (const item of planned) {
      results.push({
        platform: item.id,
        status: 'planned',
        written: [],
        skipped: [],
        unsupported: item.report.unsupported,
        executableDisclosures: item.report.executableDisclosures,
        plannedFiles: plannedFiles(item.report),
        manualAction:
          item.report.executableDisclosures.length > 0
            ? 'Review executable disclosures and rerun without --preview plus --confirm-executables when acceptable'
            : 'Rerun without --preview to install',
      });
    }
    const order = new Map(options.platforms.map((id, index) => [id, index]));
    results.sort(
      (left, right) => (order.get(left.platform) ?? 0) - (order.get(right.platform) ?? 0),
    );
    return {
      bundle: options.name,
      hash: currentHash,
      preview: true,
      platforms: results,
    };
  }

  const executableDisclosures = planned.flatMap((item) => item.report.executableDisclosures);
  if (executableDisclosures.length > 0 && options.confirmedExecutables !== true) {
    for (const item of planned) {
      results.push({
        platform: item.id,
        status: 'cancelled',
        written: [],
        skipped: [],
        unsupported: item.report.unsupported,
        executableDisclosures: item.report.executableDisclosures,
        plannedFiles: plannedFiles(item.report),
        error: 'Bundle distribution includes executable hooks; confirm executables first',
      });
    }
    const order = new Map(options.platforms.map((id, index) => [id, index]));
    results.sort(
      (left, right) => (order.get(left.platform) ?? 0) - (order.get(right.platform) ?? 0),
    );
    return {
      bundle: options.name,
      hash: currentHash,
      preview: false,
      platforms: results,
    };
  }

  for (const item of planned) {
    try {
      const applied = await applyPlatformInstallPlan({
        target: item.target,
        files: item.report.files,
        overwrite: options.overwrite ?? false,
      });
      results.push({
        platform: item.id,
        status: applied.written.length > 0 ? 'installed' : 'skipped',
        written: applied.written,
        skipped: applied.skipped,
        unsupported: item.report.unsupported,
        executableDisclosures: item.report.executableDisclosures,
        plannedFiles: plannedFiles(item.report),
      });
    } catch (error) {
      results.push({
        platform: item.id,
        status: 'failed',
        written: [],
        skipped: [],
        unsupported: item.report.unsupported,
        executableDisclosures: item.report.executableDisclosures,
        plannedFiles: plannedFiles(item.report),
        error: (error as Error).message,
      });
    }
  }

  const order = new Map(options.platforms.map((id, index) => [id, index]));
  results.sort((left, right) => (order.get(left.platform) ?? 0) - (order.get(right.platform) ?? 0));
  return {
    bundle: options.name,
    hash: currentHash,
    preview: false,
    platforms: results,
  };
}
