import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const tempDirs: string[] = [];
const scannerPath = path.resolve('scripts/prepublish-check.js');

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('prepublish security scan', () => {
  it.each(['.sh', '.mjs', '.cjs'])('scans published %s runtime files for secrets', async (extension) => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'opensuper-prepublish-'));
    tempDirs.push(tempDir);
    await writeFile(path.join(tempDir, `leak${extension}`), `token="${'x'.repeat(24)}"\n`, 'utf8');

    const result = spawnSync(process.execPath, [scannerPath], {
      cwd: tempDir,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Possible Secret/token');
  });

  it('scans generated dist files that are included in the npm package', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'opensuper-prepublish-'));
    tempDirs.push(tempDir);
    await mkdir(path.join(tempDir, 'dist'));
    await writeFile(
      path.join(tempDir, 'dist', 'leak.mjs'),
      `token="${'x'.repeat(24)}"\n`,
      'utf8',
    );

    const result = spawnSync(process.execPath, [scannerPath], {
      cwd: tempDir,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Possible Secret/token');
  });

  it('scans an explicit extracted-package root', async () => {
    const cwdDir = await mkdtemp(path.join(os.tmpdir(), 'opensuper-prepublish-cwd-'));
    const packageDir = await mkdtemp(path.join(os.tmpdir(), 'opensuper-prepublish-package-'));
    tempDirs.push(cwdDir, packageDir);
    await writeFile(path.join(packageDir, 'leak.mjs'), `token="${'x'.repeat(24)}"\n`, 'utf8');

    const result = spawnSync(process.execPath, [scannerPath, packageDir], {
      cwd: cwdDir,
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Possible Secret/token');
  });
});
