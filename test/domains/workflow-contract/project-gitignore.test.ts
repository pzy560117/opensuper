import { promises as fs } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ensureOpenSuperProjectGitignore,
  renderOpenSuperProjectGitignore,
} from '../../../domains/workflow-contract/project-gitignore.js';

function git(projectRoot: string, args: string[]) {
  return spawnSync('git', args, { cwd: projectRoot, encoding: 'utf8' });
}

describe('OpenSuper project .gitignore', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-project-gitignore-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('preserves user rules and normalizes one idempotent managed block', () => {
    const source = [
      'node_modules/',
      '# >>> OpenSuper managed project state >>>',
      '.opensuper/',
      '# <<< OpenSuper managed project state <<<',
      'coverage/',
      '',
    ].join('\r\n');

    const rendered = renderOpenSuperProjectGitignore(source);

    expect(rendered).toContain('node_modules/\r\ncoverage/\r\n');
    expect(rendered).toContain(
      [
        '# >>> OpenSuper managed project state >>>',
        '!/.opensuper/',
        '/.opensuper/*',
        '!/.opensuper/config.yaml',
        '# <<< OpenSuper managed project state <<<',
        '',
      ].join('\r\n'),
    );
    expect(rendered.match(/>>> OpenSuper managed project state >>>/gu)).toHaveLength(1);
    expect(renderOpenSuperProjectGitignore(rendered)).toBe(rendered);
  });

  it('allows only config.yaml while keeping every local .opensuper category ignored and unstaged', async () => {
    expect(git(root, ['init']).status).toBe(0);
    await fs.writeFile(
      path.join(root, '.gitignore'),
      ['node_modules/', '.opensuper/', 'dist/', ''].join('\n'),
      'utf8',
    );
    const files = [
      '.opensuper/config.yaml',
      '.opensuper/current-change.json',
      '.opensuper/skills/demo/SKILL.md',
      '.opensuper/drafts/demo.md',
      '.opensuper/cache/index.json',
      '.opensuper/runtime/native/changes/demo/state.json',
      '.opensuper/runtime/native/locks/demo.lock',
      '.opensuper/runtime/native/transactions/demo/journal.json',
    ];
    for (const relative of files) {
      const target = path.join(root, ...relative.split('/'));
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, `${relative}\n`, 'utf8');
    }

    await ensureOpenSuperProjectGitignore(root);
    const once = await fs.readFile(path.join(root, '.gitignore'), 'utf8');
    await ensureOpenSuperProjectGitignore(root);

    expect(await fs.readFile(path.join(root, '.gitignore'), 'utf8')).toBe(once);
    expect(once).toContain('node_modules/\n');
    expect(once).toContain('dist/\n');
    expect(git(root, ['check-ignore', '--quiet', '.opensuper/config.yaml']).status).toBe(1);
    for (const relative of files.slice(1)) {
      expect(git(root, ['check-ignore', '--quiet', relative]).status, relative).toBe(0);
    }
    expect(git(root, ['add', '--dry-run', '--', '.opensuper/config.yaml']).status).toBe(0);
    expect(git(root, ['diff', '--cached', '--name-only']).stdout).toBe('');
    expect(
      git(root, ['status', '--short', '--untracked-files=all', '--', '.opensuper']).stdout,
    ).toBe('?? .opensuper/config.yaml\n');
  });

  it('fails closed for malformed managed state and redirected project roots', async () => {
    await fs.writeFile(
      path.join(root, '.gitignore'),
      '# >>> OpenSuper managed project state >>>\n.opensuper/\n',
      'utf8',
    );
    await expect(ensureOpenSuperProjectGitignore(root)).rejects.toThrow(
      'managed block is incomplete',
    );

    const realRoot = path.join(root, 'real-project');
    const linkedRoot = path.join(root, 'linked-project');
    await fs.mkdir(realRoot);
    await fs.symlink(realRoot, linkedRoot, process.platform === 'win32' ? 'junction' : 'dir');
    await expect(ensureOpenSuperProjectGitignore(linkedRoot)).rejects.toThrow(
      'project root must be a real directory',
    );
  });
});
