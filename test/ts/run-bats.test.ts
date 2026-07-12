import { describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('run-bats shell runner', () => {
  it('resolves a usable bash instead of directly invoking PATH bash', async () => {
    const content = await fs.readFile(path.resolve('scripts', 'run-bats.js'), 'utf-8');

    expect(content).toContain('function findUsableBash');
    expect(content).toContain('process.env.opensuper_TEST_BASH');
    expect(content).toContain('process.env.opensuper_BASH');
    expect(content).not.toContain("spawnSync('bash'");
  });

  it('rejects WSL bash when resolving bash on Windows', async () => {
    const runner = await fs.readFile(path.resolve('scripts', 'run-bats.js'), 'utf-8');
    const shellTests = await fs.readFile(path.resolve('test', 'ts', 'opensuper-scripts.test.ts'), 'utf-8');

    expect(runner).toContain("process.platform === 'win32' && /linux/i.test(probe.stdout)");
    expect(shellTests).toContain("process.platform === 'win32' && /linux/i.test(probe.stdout)");
  });

  it('bounds synchronous Bash and provider processes with explicit timeouts', async () => {
    const runner = await fs.readFile(path.resolve('scripts', 'run-bats.js'), 'utf-8');
    const shellTests = await fs.readFile(
      path.resolve('test', 'ts', 'opensuper-scripts.test.ts'),
      'utf-8',
    );
    const gateTests = await fs.readFile(
      path.resolve('test', 'ts', 'opentest-gate.test.ts'),
      'utf-8',
    );

    expect(runner).toContain('const BASH_PROBE_TIMEOUT_MS = 10_000');
    expect(runner).toContain('const BATS_FILE_TIMEOUT_MS = 10 * 60_000');
    expect(runner.match(/timeout: BASH_PROBE_TIMEOUT_MS/g)).toHaveLength(2);
    expect(runner).toContain('timeout: BATS_FILE_TIMEOUT_MS');
    expect(shellTests).toContain('const SCRIPT_TIMEOUT_MS = 60_000');
    expect(shellTests).toContain('timeout = SCRIPT_TIMEOUT_MS');
    expect(shellTests).toContain('timeout: SCRIPT_TIMEOUT_MS');
    expect(gateTests).toContain('const GATE_PROCESS_TIMEOUT_MS = 150_000');
    expect(gateTests).toContain('timeout: GATE_PROCESS_TIMEOUT_MS');
  });

  it('checks explicit opensuper bash paths before shelling out to discover fallbacks', async () => {
    const content = await fs.readFile(
      path.resolve('assets', 'skills', 'opensuper', 'scripts', 'opensuper-env.sh'),
      'utf-8',
    );

    const opensuperBashCheck = content.indexOf('if _opensuper_bash_is_usable "${opensuper_BASH:-}"');
    const currentBashCheck = content.indexOf('if _opensuper_bash_is_usable "${BASH:-}"');
    const shellFallback = content.indexOf('command -v sh');

    expect(opensuperBashCheck).toBeGreaterThan(-1);
    expect(currentBashCheck).toBeGreaterThan(opensuperBashCheck);
    expect(shellFallback).toBeGreaterThan(currentBashCheck);
    expect(content).not.toContain('for _opensuper_bash_candidate in \\');
  });
});
