import type { OpenSuperEntryResolution } from './types.js';
import { resolveOpenSuperEntry } from './resolve-entry.js';

export const OPENSUPER_WORKFLOW_RESOLUTION_SCHEMA = 'opensuper.workflow-resolution.v1' as const;

export interface OpenSuperWorkflowResolution extends OpenSuperEntryResolution {
  schema: typeof OPENSUPER_WORKFLOW_RESOLUTION_SCHEMA;
}

export async function resolveOpenSuperWorkflowResolution(
  startPath: string,
): Promise<OpenSuperWorkflowResolution> {
  return {
    schema: OPENSUPER_WORKFLOW_RESOLUTION_SCHEMA,
    ...(await resolveOpenSuperEntry(startPath)),
  };
}

export function formatOpenSuperWorkflowResolution(resolution: OpenSuperWorkflowResolution): string {
  return [
    `workflow: ${resolution.workflow}`,
    `skill: ${resolution.skill}`,
    `source: ${resolution.source}`,
  ].join('\n');
}
