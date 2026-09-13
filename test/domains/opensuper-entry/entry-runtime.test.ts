import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  formatOpenSuperWorkflowResolution,
  resolveOpenSuperWorkflowResolution,
} from '../../../domains/opensuper-entry/workflow-resolution.js';
import {
  runOpenSuperEntryRuntime,
  tryRunConfiguredOpenSuperEntryRuntime,
} from '../../../domains/opensuper-entry/entry-runtime.js';

vi.mock('../../../domains/opensuper-entry/workflow-resolution.js', () => ({
  formatOpenSuperWorkflowResolution: vi.fn(),
  resolveOpenSuperWorkflowResolution: vi.fn(),
}));

function io() {
  return { stdout: vi.fn(), stderr: vi.fn() };
}

describe('OpenSuper entry runtime', () => {
  it('resolves configured activation without loading installation or changing its output', async () => {
    const output = io();
    const resolution = {
      schema: 'opensuper.workflow-resolution.v1' as const,
      workflow: 'native',
      skill: 'opensuper-native',
      source: 'project-config',
    } as const;
    vi.mocked(resolveOpenSuperWorkflowResolution).mockResolvedValue(resolution);
    expect(
      await tryRunConfiguredOpenSuperEntryRuntime(['project', '--activate', '--json'], output),
    ).toBe(true);
    expect(output.stdout).toHaveBeenCalledWith(`${JSON.stringify(resolution, null, 2)}\n`);
    output.stdout.mockClear();
    vi.mocked(formatOpenSuperWorkflowResolution).mockReturnValue('workflow: native');
    expect(await tryRunConfiguredOpenSuperEntryRuntime(['project', '--activate'], output)).toBe(
      true,
    );
    expect(output.stdout).toHaveBeenCalledWith('workflow: native\n');
    expect(output.stderr).not.toHaveBeenCalled();
  });

  it.each(['missing configuration', 'invalid configuration', 'incomplete configuration'])(
    'returns to the full facade without output for %s',
    async (message) => {
      const output = io();
      vi.mocked(resolveOpenSuperWorkflowResolution).mockRejectedValue(new Error(message));
      expect(
        await tryRunConfiguredOpenSuperEntryRuntime(['project', '--activate', '--json'], output),
      ).toBe(false);
      expect(output.stdout).not.toHaveBeenCalled();
      expect(output.stderr).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['--json'],
    ['--activate', '--help'],
    ['--activate', '--task', 'x'],
    ['--activate', 'one', 'two'],
  ])('leaves unsupported activation arguments to the facade: %j', async (...args) => {
    const output = io();
    expect(await tryRunConfiguredOpenSuperEntryRuntime(args, output)).toBe(false);
    expect(resolveOpenSuperWorkflowResolution).not.toHaveBeenCalled();
    expect(output.stdout).not.toHaveBeenCalled();
    expect(output.stderr).not.toHaveBeenCalled();
  });

  it('emits machine-readable usage and resolution failures in JSON mode', async () => {
    const output = io();
    expect(await runOpenSuperEntryRuntime(['--unknown', '--json'], output)).toBe(64);
    expect(JSON.parse(output.stdout.mock.calls[0][0])).toMatchObject({
      status: 'failed',
      exitCode: 64,
      error: expect.stringContaining('--unknown'),
    });
    output.stdout.mockClear();
    vi.mocked(resolveOpenSuperWorkflowResolution).mockRejectedValue(
      new Error('unreadable project'),
    );
    expect(await runOpenSuperEntryRuntime(['project', '--json'], output)).toBe(65);
    expect(JSON.parse(output.stdout.mock.calls[0][0])).toMatchObject({
      status: 'failed',
      exitCode: 65,
      error: 'unreadable project',
    });
    expect(output.stderr).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('formats a human-readable workflow resolution by default', async () => {
    const output = io();
    vi.mocked(resolveOpenSuperWorkflowResolution).mockResolvedValue({} as never);
    vi.mocked(formatOpenSuperWorkflowResolution).mockReturnValue('classic: demo');

    await expect(runOpenSuperEntryRuntime([], output)).resolves.toBe(0);

    expect(resolveOpenSuperWorkflowResolution).toHaveBeenCalledWith(process.cwd());
    expect(formatOpenSuperWorkflowResolution).toHaveBeenCalledWith({});
    expect(output.stdout).toHaveBeenCalledWith('classic: demo\n');
    expect(output.stderr).not.toHaveBeenCalled();
  });

  it('prints help without resolving a project', async () => {
    const output = io();

    await expect(runOpenSuperEntryRuntime(['--help'], output)).resolves.toBe(0);
    await expect(runOpenSuperEntryRuntime(['-h'], output)).resolves.toBe(0);

    expect(resolveOpenSuperWorkflowResolution).not.toHaveBeenCalled();
    expect(output.stdout).toHaveBeenNthCalledWith(
      1,
      'Usage: opensuper workflow resolve [path] [--json]\n',
    );
    expect(output.stdout).toHaveBeenNthCalledWith(
      2,
      'Usage: opensuper workflow resolve [path] [--json]\n',
    );
  });

  it('prints JSON for an explicit target path', async () => {
    const output = io();
    const resolution = { workflow: 'native', change: 'demo' };
    vi.mocked(resolveOpenSuperWorkflowResolution).mockResolvedValue(resolution as never);

    await expect(runOpenSuperEntryRuntime(['--json', 'project'], output)).resolves.toBe(0);

    expect(resolveOpenSuperWorkflowResolution).toHaveBeenCalledWith(
      expect.stringMatching(/[\\/]project$/u),
    );
    expect(output.stdout).toHaveBeenCalledWith(`${JSON.stringify(resolution, null, 2)}\n`);
  });

  it.each([
    [['--unknown'], 'Unknown option: --unknown'],
    [['first', 'second'], 'Unexpected argument: second'],
  ])('returns a usage error for invalid arguments %j', async (args, message) => {
    const output = io();

    await expect(runOpenSuperEntryRuntime(args, output)).resolves.toBe(64);
    expect(output.stderr).toHaveBeenCalledWith(
      `${message}\nUsage: opensuper workflow resolve [path] [--json]\n`,
    );
  });

  it('returns a runtime error when workflow resolution fails', async () => {
    const output = io();
    vi.mocked(resolveOpenSuperWorkflowResolution).mockRejectedValue(
      new Error('unreadable project'),
    );

    await expect(runOpenSuperEntryRuntime(['project'], output)).resolves.toBe(65);
    expect(output.stderr).toHaveBeenCalledWith('unreadable project\n');
  });

  it('formats a non-Error workflow resolution failure', async () => {
    const output = io();
    vi.mocked(resolveOpenSuperWorkflowResolution).mockRejectedValue('unreadable project');

    await expect(runOpenSuperEntryRuntime(['project'], output)).resolves.toBe(65);
    expect(output.stderr).toHaveBeenCalledWith('unreadable project\n');
  });
});
