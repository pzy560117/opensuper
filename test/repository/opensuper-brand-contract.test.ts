import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve('.');

function walkFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    if (entry === '.git' || entry === 'node_modules' || entry === 'dist' || entry === 'website') {
      return [];
    }
    const absolutePath = path.join(directory, entry);
    return statSync(absolutePath).isDirectory() ? walkFiles(absolutePath) : [absolutePath];
  });
}

describe('OpenSuper downstream identity', () => {
  it('publishes the OpenSuper package and CLI', () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'),
    ) as { name: string; bin: Record<string, string> };

    expect(packageJson.name).toBe('@pzy560117/opensuper');
    expect(packageJson.bin).toEqual({ opensuper: 'bin/opensuper.js' });
  });

  it('ships only OpenSuper workflow skills', () => {
    const legacyProductName = ['co', 'met'].join('');
    const manifest = JSON.parse(
      readFileSync(path.join(repositoryRoot, 'assets', 'manifest.json'), 'utf8'),
    ) as { skills: string[] };

    expect(manifest.skills).toContain('opensuper/SKILL.md');
    expect(manifest.skills.some((entry) => entry.toLowerCase().includes(legacyProductName))).toBe(
      false,
    );
  });

  it('uses the OpenSuper project state root', () => {
    const legacyProductName = ['co', 'met'].join('');
    expect(statSync(path.join(repositoryRoot, '.opensuper')).isDirectory()).toBe(true);
    expect(() => statSync(path.join(repositoryRoot, `.${legacyProductName}`))).toThrow();
  });

  it('contains no legacy quality-gate integration in product and package inputs', () => {
    const legacyMarker = ['open', 'test'].join('');
    const productRoots = ['app', 'domains', 'platform', 'assets', 'bin', 'scripts'];
    const matches = productRoots
      .flatMap((root) => walkFiles(path.join(repositoryRoot, root)))
      .filter((file) => readFileSync(file, 'utf8').toLowerCase().includes(legacyMarker));

    expect(matches).toEqual([]);
  });
});
