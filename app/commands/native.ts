import { runNativeCli } from '../../domains/opensuper-native/native-cli.js';
import {
  parseNativeLifecycleEvidence,
  parseNativeOutcomeEvidence,
} from '../../domains/opensuper-native/native-experience.js';
import {
  collectOpenSuperPluginContext,
  recordOpenSuperWorkflowResult,
} from '../../domains/opensuper-entry/plugin-context.js';
import path from 'node:path';

export async function runNativeFacade(args: readonly string[]): Promise<number> {
  const integration = splitIntegrationArgs(args);
  const projectRoot = path.resolve(integration.projectRoot ?? process.cwd());
  await emitContext(projectRoot, integration);
  const result = await runNativeCli(integration.cliArgs);
  await recordNativeResult(integration.cliArgs, result, integration.workflow);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr)
    process.stderr.write(result.stderr + (result.stderr.endsWith('\n') ? '' : '\n'));
  return result.exitCode;
}

async function recordNativeResult(
  args: readonly string[],
  result: Awaited<ReturnType<typeof runNativeCli>>,
  workflowOverride?: string,
): Promise<void> {
  const command = args.find((value) => ['next', 'archive', 'handoff', 'check'].includes(value));
  if (!command || !['next', 'archive', 'handoff', 'check'].includes(command)) return;
  if (args.includes('--dry-run')) return;
  if (result.exitCode !== 0 && command !== 'check') return;
  const commandIndex = args.indexOf(command);
  const projectIndex = args.indexOf('--project-root');
  const projectRoot = projectIndex >= 0 ? args[projectIndex + 1] : process.cwd();
  if (!projectRoot) return;
  const changeId = args
    .slice(commandIndex + 1, projectIndex >= 0 ? projectIndex : args.length)
    .find((value) => !value.startsWith('--'));
  try {
    const verificationCommand = command === 'check' ? 'opensuper native check' : undefined;
    const evidence = parseNativeLifecycleEvidence(result.stdout);
    const base: Parameters<typeof recordOpenSuperWorkflowResult>[0] = {
      projectRoot: path.resolve(projectRoot),
      workflow: workflowOverride ?? 'native',
      changeId: changeId ?? command,
      command,
      success: result.exitCode === 0,
      eventType:
        command === 'archive'
          ? 'change.archived'
          : command === 'check' || args.includes('--result')
            ? 'verification.completed'
            : 'episode.completed',
      ...(verificationCommand
        ? {
            verificationCommands: [verificationCommand],
            verificationResults: [{ command: verificationCommand, success: result.exitCode === 0 }],
          }
        : {}),
      ...(evidence.changedPaths.length > 0 ? { changedPaths: evidence.changedPaths } : {}),
      ...(evidence.artifactRefs.length > 0 ? { artifactRefs: evidence.artifactRefs } : {}),
    };
    await recordOpenSuperWorkflowResult(base);
    const outcome = parseNativeOutcomeEvidence(result.stdout);
    if (result.exitCode === 0 && outcome.reviewResolved) {
      await recordOpenSuperWorkflowResult({
        ...base,
        eventType: 'review.resolved',
        summary: outcome.summary ?? 'Native verifier accepted the change.',
      });
    }
    if (result.exitCode === 0 && outcome.failureResolved) {
      await recordOpenSuperWorkflowResult({
        ...base,
        eventType: 'failure.resolved',
        summary: outcome.summary ?? 'A previous Native verification failure was resolved.',
      });
    }
  } catch {
    // Plugin learning must never make a workflow command fail.
  }
}

interface NativeIntegrationArgs {
  readonly cliArgs: readonly string[];
  readonly projectRoot?: string;
  readonly task?: string;
  readonly contextPath?: string;
  readonly phase?: string;
  readonly workflow?: string;
}

function splitIntegrationArgs(args: readonly string[]): NativeIntegrationArgs {
  const cliArgs: string[] = [];
  let projectRoot: string | undefined;
  let task: string | undefined;
  let contextPath: string | undefined;
  let phase: string | undefined;
  let workflow: string | undefined;
  let summary: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    const next = args[index + 1];
    if (
      value === '--opensuper-task' ||
      value === '--opensuper-path' ||
      value === '--opensuper-phase' ||
      value === '--opensuper-workflow'
    ) {
      if (next === undefined) throw new Error(`${value} requires a value`);
      if (value === '--opensuper-task') task = next;
      if (value === '--opensuper-path') contextPath = next;
      if (value === '--opensuper-phase') phase = next;
      if (value === '--opensuper-workflow') workflow = next;
      index += 1;
      continue;
    }
    cliArgs.push(value);
    if (value === '--project-root' && next !== undefined) projectRoot = next;
    if (value === '--summary' && next !== undefined) summary = next;
  }
  return {
    cliArgs,
    projectRoot,
    task: task ?? process.env.OPENSUPER_TASK ?? summary,
    contextPath,
    phase,
    workflow,
  };
}

async function emitContext(projectRoot: string, options: NativeIntegrationArgs): Promise<void> {
  if (!options.task?.trim()) return;
  try {
    const contributions =
      (await collectOpenSuperPluginContext(projectRoot, {
        task: options.task,
        ...(options.contextPath ? { path: options.contextPath } : {}),
        ...(options.phase ? { phase: options.phase } : {}),
      })) ?? [];
    if (contributions.length === 0) return;
    process.stderr.write(
      `OpenSuper context:\n${contributions.map((entry) => `- ${entry.text}`).join('\n')}\n`,
    );
  } catch {
    // Context injection is best effort and must not block the workflow.
  }
}
