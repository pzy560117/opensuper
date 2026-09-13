import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { workflowResolveCommand } from '../../app/commands/workflow.js';
import {
  defaultProjectConfig,
  writeProjectConfig,
} from '../../domains/opensuper-native/native-config.js';

const { collectOpenSuperPluginContext } = vi.hoisted(() => ({
  collectOpenSuperPluginContext: vi.fn(async () => [] as readonly { readonly text: string }[]),
}));

vi.mock('../../domains/opensuper-entry/plugin-context.js', () => ({
  collectOpenSuperPluginContext,
}));

describe('workflow resolve command', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-workflow-command-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it('prints the stable JSON resolution contract', async () => {
    await writeProjectConfig(projectRoot, defaultProjectConfig('.'));
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await workflowResolveCommand(projectRoot, { json: true });

    expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({
      schema: 'opensuper.workflow-resolution.v1',
      workflow: 'native',
      skill: 'opensuper-native',
      source: 'project-config',
    });
  });

  it('fails closed when project configuration is absent', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(workflowResolveCommand(projectRoot)).rejects.toThrow(
      '.opensuper/config.yaml is missing',
    );

    expect(log).not.toHaveBeenCalled();
  });

  it('activates an unconfigured project only when explicitly requested', async () => {
    await fs.mkdir(path.join(projectRoot, '.git'));
    const emptyHome = path.join(projectRoot, 'empty-home');
    await fs.mkdir(emptyHome);
    vi.spyOn(os, 'homedir').mockReturnValue(emptyHome);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await workflowResolveCommand(projectRoot, { activate: true, json: true });

    expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({
      schema: 'opensuper.workflow-resolution.v1',
      workflow: 'native',
      source: 'built-in-default',
    });
    await expect(
      fs.access(path.join(projectRoot, '.opensuper', 'config.yaml')),
    ).resolves.toBeUndefined();
  });

  it('fails closed when project configuration is malformed', async () => {
    await fs.mkdir(path.join(projectRoot, '.opensuper'));
    await fs.writeFile(path.join(projectRoot, '.opensuper', 'config.yaml'), 'schema: [', 'utf8');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(workflowResolveCommand(projectRoot, { json: true })).rejects.toThrow(
      /Invalid \.opensuper\/config\.yaml/u,
    );
    expect(log).not.toHaveBeenCalled();
  });

  it('prints best-effort task context before the human-readable resolution', async () => {
    await writeProjectConfig(projectRoot, defaultProjectConfig('.'));
    collectOpenSuperPluginContext.mockResolvedValue([
      { text: 'Use the project verification command.' },
    ]);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await workflowResolveCommand(projectRoot, {
      task: 'verify this change',
      path: 'src/example.ts',
      phase: 'verify',
    });

    expect(stderr).toHaveBeenCalledWith(
      'OpenSuper context:\n- Use the project verification command.\n',
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining('workflow: native'));
  });

  it('registers the nested workflow resolve command in Commander', async () => {
    const source = await fs.readFile(path.resolve('app', 'cli', 'index.ts'), 'utf8');

    // Command handlers are lazy-imported inside `.action()`; assert the
    // registration and the lazy import path instead of a top-level import.
    expect(source).toContain(".command('workflow')");
    expect(source).toContain(".command('resolve [path]')");
    expect(source).toContain(".option('--activate'");
    expect(source).toContain(
      "const { workflowResolveCommand } = await import('../commands/workflow.js');",
    );
  });
});
