import {
  clearOpenSuperCurrentSelection,
  migrateLegacyClassicSelection,
} from './current-selection.js';
import { resolveHookWorkflowOwner } from './hook-router.js';

export interface RepairOpenSuperCurrentSelectionOptions {
  migrateLegacyClassic: boolean;
}

export interface RepairOpenSuperCurrentSelectionResult {
  migratedLegacyClassic: boolean;
  clearedStaleSelection: boolean;
}

interface RepairOpenSuperCurrentSelectionDependencies {
  migrateLegacyClassic: typeof migrateLegacyClassicSelection;
  resolveOwner: typeof resolveHookWorkflowOwner;
  clearSelection: typeof clearOpenSuperCurrentSelection;
}

const DEFAULT_DEPENDENCIES: RepairOpenSuperCurrentSelectionDependencies = {
  migrateLegacyClassic: migrateLegacyClassicSelection,
  resolveOwner: resolveHookWorkflowOwner,
  clearSelection: clearOpenSuperCurrentSelection,
};

export async function repairOpenSuperCurrentSelection(
  projectRoot: string,
  options: RepairOpenSuperCurrentSelectionOptions,
  dependencies: RepairOpenSuperCurrentSelectionDependencies = DEFAULT_DEPENDENCIES,
): Promise<RepairOpenSuperCurrentSelectionResult> {
  const migratedLegacyClassic = options.migrateLegacyClassic
    ? await dependencies.migrateLegacyClassic(projectRoot)
    : false;

  const resolution = await dependencies.resolveOwner(projectRoot);
  if (!('staleSelection' in resolution) || resolution.staleSelection?.code !== 'target-missing') {
    return { migratedLegacyClassic, clearedStaleSelection: false };
  }

  await dependencies.clearSelection(projectRoot);
  return { migratedLegacyClassic, clearedStaleSelection: true };
}
