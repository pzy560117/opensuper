import path from 'node:path';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { inspectOpenSuperHook } from '../../../domains/opensuper-entry/hook-router.js';
import {
  main,
  isDirectEntry,
  projectRootFrom,
  runOpenSuperHookRouter,
} from '../../../domains/opensuper-entry/hook-router-entry.js';
import { resolveOpenSuperHookProjectRoot } from '../../../domains/opensuper-entry/hook-project-root.js';

vi.mock('../../../domains/opensuper-entry/hook-router.js', () => ({
  inspectOpenSuperHook: vi.fn(),
}));

vi.mock('../../../domains/opensuper-entry/hook-project-root.js', () => ({
  resolveOpenSuperHookProjectRoot: vi.fn((root: string) => root),
}));

describe('OpenSuper Hook Router entry', () => {
  let stderr: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FILE_PATH = 'src/entry.ts';
    stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    delete process.env.FILE_PATH;
    stderr.mockRestore();
  });

  it('returns usage errors before reading a Hook request', async () => {
    await expect(runOpenSuperHookRouter([])).resolves.toBe(64);
    await expect(runOpenSuperHookRouter(['--unknown'])).resolves.toBe(64);
    await expect(runOpenSuperHookRouter(['--platform', 'unsupported'])).resolves.toBe(64);

    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('--platform is required'));
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Unknown argument: --unknown'));
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('unsupported Hook platform'));
    expect(inspectOpenSuperHook).not.toHaveBeenCalled();
  });

  it('routes an explicit project request and renders an allow decision', async () => {
    vi.mocked(inspectOpenSuperHook).mockResolvedValue({ allowed: true, reason: 'allowed' });
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'opensuper-hook-router-configured-'));
    try {
      await mkdir(path.join(projectRoot, '.opensuper'), { recursive: true });
      await writeFile(
        path.join(projectRoot, '.opensuper', 'config.yaml'),
        'schema: opensuper.project.v1\ndefault_workflow: native\nworkflows: [native]\nnative:\n  artifact_root: docs\n',
      );

      await expect(
        runOpenSuperHookRouter(['--platform', 'codex', '--project-root', projectRoot]),
      ).resolves.toBe(0);

      expect(resolveOpenSuperHookProjectRoot).toHaveBeenCalledWith(
        projectRoot,
        expect.objectContaining({ intent: 'write', targets: ['src/entry.ts'] }),
      );
      expect(inspectOpenSuperHook).toHaveBeenCalledWith(
        projectRoot,
        expect.objectContaining({ targets: ['src/entry.ts'] }),
      );
      expect(stderr).not.toHaveBeenCalled();
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('renders a denied decision and exposes the main entry wrapper', async () => {
    vi.mocked(inspectOpenSuperHook).mockResolvedValue({ allowed: false, reason: 'blocked' });

    await expect(main(['--platform', 'codex', '--project-root', 'project'])).resolves.toBe(2);
    expect(stderr).toHaveBeenCalledWith('blocked\n');
  });

  it('fails closed when Hook inspection throws', async () => {
    vi.mocked(inspectOpenSuperHook).mockRejectedValue(new Error('inspection failed'));

    await expect(
      runOpenSuperHookRouter(['--platform', 'codex', '--project-root', 'project']),
    ).resolves.toBe(2);
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining('OpenSuper Hook Router failed closed during project discovery'),
    );
  });

  it('requires a valid OpenSuper config and keeps a legacy invocation neutral without a request cwd', async () => {
    const parsed = { platformId: 'codex' } as Parameters<typeof projectRootFrom>[0];
    await expect(projectRootFrom(parsed)).resolves.toBeNull();
    await expect(projectRootFrom(parsed, undefined)).resolves.toBeNull();
    const plainGit = await mkdtemp(path.join(tmpdir(), 'opensuper-hook-router-plain-git-'));
    const configured = await mkdtemp(path.join(tmpdir(), 'opensuper-hook-router-project-'));
    try {
      await mkdir(path.join(plainGit, '.git'));
      await expect(
        projectRootFrom({ platformId: 'codex', projectRoot: plainGit }),
      ).resolves.toBeNull();

      await mkdir(path.join(configured, '.opensuper'), { recursive: true });
      await writeFile(
        path.join(configured, '.opensuper', 'config.yaml'),
        'schema: opensuper.project.v1\ndefault_workflow: native\nworkflows: [native]\nnative:\n  artifact_root: docs\n',
      );
      await expect(projectRootFrom({ platformId: 'codex', projectRoot: configured })).resolves.toBe(
        configured,
      );
    } finally {
      await rm(plainGit, { recursive: true, force: true });
      await rm(configured, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform === 'win32')(
    'recognizes a direct invocation through a POSIX symlink',
    async () => {
      const tempDir = await mkdtemp(path.join(tmpdir(), 'opensuper-hook-router-entry-'));
      const target = path.join(tempDir, 'router.mjs');
      const link = path.join(tempDir, 'linked-router.mjs');
      try {
        await writeFile(target, 'export {};\n');
        await symlink(target, link);

        expect(isDirectEntry(link, pathToFileURL(target).href)).toBe(true);
        expect(isDirectEntry(undefined, pathToFileURL(target).href)).toBe(false);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
  );
});
