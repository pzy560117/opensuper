import path from 'path';

import {
  OPENSUPER_WORKFLOW_RESOLUTION_SCHEMA,
  formatOpenSuperWorkflowResolution,
  resolveOpenSuperWorkflowResolution,
} from '../../domains/opensuper-entry/workflow-resolution.js';
import { resolveOrActivateOpenSuperEntry } from '../../domains/opensuper-entry/project-activation.js';
import { collectOpenSuperPluginContext } from '../../domains/opensuper-entry/plugin-context.js';

interface WorkflowResolveOptions {
  json?: boolean;
  activate?: boolean;
  task?: string;
  path?: string;
  phase?: string;
}

export async function workflowResolveCommand(
  targetPath: string,
  options: WorkflowResolveOptions = {},
): Promise<void> {
  const absoluteTarget = path.resolve(targetPath);
  if (options.task?.trim()) {
    try {
      const context = await collectOpenSuperPluginContext(absoluteTarget, {
        task: options.task,
        ...(options.path ? { path: options.path } : {}),
        ...(options.phase ? { phase: options.phase } : {}),
      });
      if (context.length > 0) {
        process.stderr.write(
          `OpenSuper context:\n${context.map((entry) => `- ${entry.text}`).join('\n')}\n`,
        );
      }
    } catch {
      // Context injection is best effort; resolution must remain available.
    }
  }
  const resolution = options.activate
    ? {
        schema: OPENSUPER_WORKFLOW_RESOLUTION_SCHEMA,
        ...(await resolveOrActivateOpenSuperEntry(absoluteTarget)),
      }
    : await resolveOpenSuperWorkflowResolution(absoluteTarget);
  if (options.json) {
    console.log(JSON.stringify(resolution, null, 2));
    return;
  }
  console.log(formatOpenSuperWorkflowResolution(resolution));
}
