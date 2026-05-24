import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { statusCommand } from '../../src/commands/status.js';

describe('status command', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `opensuper-status-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('prints the next command for active changes', async () => {
    const changeDir = path.join(tmpDir, 'openspec', 'changes', 'next-build');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(
      path.join(changeDir, '.opensuper.yaml'),
      [
        'workflow: full',
        'phase: build',
        'build_mode: executing-plans',
        'isolation: branch',
        'verify_mode: light',
        'verify_result: pending',
        'design_doc: docs/superpowers/specs/next-build.md',
        'plan: docs/superpowers/plans/next-build.md',
        'archived: false',
        '',
      ].join('\n'),
    );
    await fs.writeFile(path.join(changeDir, 'tasks.md'), '- [x] done\n- [ ] todo\n');

    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    let output = '';
    try {
      await statusCommand(tmpDir);
      output = log.mock.calls.map((call) => call.join(' ')).join('\n');
    } finally {
      log.mockRestore();
    }

    expect(output).toContain('next: /opensuper-build');
    expect(output).toContain('[1/2 tasks]');
  });

  it('includes next command in JSON output', async () => {
    const changeDir = path.join(tmpDir, 'openspec', 'changes', 'next-verify');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(
      path.join(changeDir, '.opensuper.yaml'),
      ['workflow: full', 'phase: verify', 'archived: false', ''].join('\n'),
    );

    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    let json = '';
    try {
      await statusCommand(tmpDir, { json: true });
      json = log.mock.calls.map((call) => call.join(' ')).join('\n');
    } finally {
      log.mockRestore();
    }

    expect(JSON.parse(json).changes[0].nextCommand).toBe('/opensuper-verify');
  });
});
