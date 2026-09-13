import { discoverCachedNativeProject, readCachedProjectConfig } from './entry-reads.js';
import type { OpenSuperEntryResolution, OpenSuperWorkflow } from './types.js';

function configuredResolution(workflow: OpenSuperWorkflow): OpenSuperEntryResolution {
  return {
    workflow,
    skill: workflow === 'native' ? 'opensuper-native' : 'opensuper-classic',
    source: 'project-config',
  };
}

export async function resolveOpenSuperEntry(startPath: string): Promise<OpenSuperEntryResolution> {
  const projectRoot = await discoverCachedNativeProject(startPath);
  const config = await readCachedProjectConfig(projectRoot);
  if (!config) {
    throw new Error(
      'OpenSuper workflow entry is unavailable because .opensuper/config.yaml is missing',
    );
  }
  return configuredResolution(config.default_workflow);
}
