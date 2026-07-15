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
    const shellTests = await fs.readFile(
      path.resolve('test', 'ts', 'opensuper-scripts.test.ts'),
      'utf-8',
    );

    expect(runner).toContain("process.platform === 'win32' && /linux/i.test(probe.stdout)");
    expect(shellTests).toContain("process.platform === 'win32' && /linux/i.test(probe.stdout)");
  });

  it('prefers an absolute Git Bash path before the PATH fallback on Windows', async () => {
    const runner = await fs.readFile(path.resolve('scripts', 'run-bats.js'), 'utf-8');
    const shellTests = await fs.readFile(
      path.resolve('test', 'ts', 'opensuper-scripts.test.ts'),
      'utf-8',
    );

    for (const content of [runner, shellTests]) {
      const directBash = content.indexOf("'C:\\\\Program Files\\\\Git\\\\usr\\\\bin\\\\bash.exe'");
      const wrapperBash = content.indexOf("'C:\\\\Program Files\\\\Git\\\\bin\\\\bash.exe'");

      expect(directBash).toBeGreaterThan(-1);
      expect(directBash).toBeLessThan(wrapperBash);
      expect(wrapperBash).toBeLessThan(content.indexOf("'bash',"));
    }
  });

  it('serializes test files on Windows to avoid concurrent Git Bash contention', async () => {
    const config = await fs.readFile(path.resolve('vitest.config.ts'), 'utf-8');

    expect(config).toContain("fileParallelism: process.platform !== 'win32'");
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
    expect(runner).toContain(
      "const BATS_FILE_TIMEOUT_MS = process.platform === 'win32' ? 15 * 60_000 : 10 * 60_000",
    );
    expect(runner.match(/timeout: BASH_PROBE_TIMEOUT_MS/g)).toHaveLength(2);
    expect(runner).toContain('timeout: BATS_FILE_TIMEOUT_MS');
    expect(shellTests).toContain(
      "const SCRIPT_TIMEOUT_MS = process.platform === 'win32' ? 120_000 : 60_000",
    );
    expect(shellTests).toContain(
      "const TEST_CASE_TIMEOUT_MS = process.platform === 'win32' ? 300_000 : 60_000",
    );
    expect(shellTests).not.toContain('}, 25_000);');
    expect(shellTests).toContain('timeout = SCRIPT_TIMEOUT_MS');
    expect(shellTests).toContain('timeout: SCRIPT_TIMEOUT_MS');
    expect(gateTests).toContain('const GATE_PROCESS_TIMEOUT_MS = 150_000');
    expect(gateTests).toContain('timeout: GATE_PROCESS_TIMEOUT_MS');

    const config = await fs.readFile(path.resolve('vitest.config.ts'), 'utf-8');
    expect(config).toContain("testTimeout: process.platform === 'win32' ? 300_000 : 5_000");
  });

  it('checks explicit opensuper bash paths before shelling out to discover fallbacks', async () => {
    const content = await fs.readFile(
      path.resolve('assets', 'skills', 'opensuper', 'scripts', 'opensuper-env.sh'),
      'utf-8',
    );

    const opensuperBashCheck = content.indexOf(
      'if _opensuper_bash_is_usable "${opensuper_BASH:-}"',
    );
    const currentBashCheck = content.indexOf('if _opensuper_bash_is_usable "${BASH:-}"');
    const shellFallback = content.indexOf('command -v sh');

    expect(opensuperBashCheck).toBeGreaterThan(-1);
    expect(currentBashCheck).toBeGreaterThan(opensuperBashCheck);
    expect(shellFallback).toBeGreaterThan(currentBashCheck);
    expect(content).not.toContain('for _opensuper_bash_candidate in \\');
  });
});
