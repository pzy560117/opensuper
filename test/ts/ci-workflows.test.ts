import { describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';

describe('CI workflows', () => {
  it('defines PR title linting with OpenSuper-specific semantic scopes', async () => {
    const workflow = (await fs.readFile('.github/workflows/pr-title-lint.yml', 'utf-8')).replace(/\r\n/g, '\n');

    expect(workflow).toContain('name: PR Title Lint');
    expect(workflow).toContain('pull-requests: read');
    expect(workflow).toContain('amannn/action-semantic-pull-request@v5');
    expect(workflow).toContain('types: [opened, edited, reopened, ready_for_review]');
    expect(workflow).not.toContain('synchronize');
    expect(workflow).toContain('requireScope: false');
    expect(workflow).toContain('subjectPattern: ^.{1,72}$');

    for (const scope of [
      'cli',
      'commands',
      'core',
      'skills',
      'assets',
      'scripts',
      'docs',
      'ci',
      'deps',
      'release',
    ]) {
      expect(workflow).toMatch(new RegExp(`\\n\\s+${scope}\\n`));
    }

    for (const outOfScope of ['common', 'api', 'spi', 'plugins', 'mcp', 'tools']) {
      expect(workflow).not.toMatch(new RegExp(`\\n\\s+${outOfScope}\\n`));
    }
  });
});
