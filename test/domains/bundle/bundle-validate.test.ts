import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { loadBundle } from '../../../domains/bundle/load.js';
import { validateBundle } from '../../../domains/bundle/validate.js';

const manifest = `apiVersion: opensuper/v1alpha1
kind: SkillBundle
metadata:
  name: demo-bundle
  version: 1.0.0
  description: Demo workflow
  defaultLocale: zh
  locales: [zh]
skills:
  - id: demo
    path: skills/demo
    visibility: entry
  - id: helper
    path: skills/helper
    visibility: internal
resources:
  rules:
    - id: matched-rule
      path: rules/matched.md
      mode: matched
      match: ["src/**"]
      required: true
  hooks:
    - id: protect-write
      path: hooks/protect-write.yaml
  references: [references/state.md]
  scripts:
    - id: verify-state
      path: scripts/verify-state.mjs
      sideEffect: read
      runtime: node
platforms:
  requires: [skills, hooks]
  optional: [rules, scripts]
engine:
  enabled: false
`;

describe('validateBundle', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-bundle-validate-'));
    await fs.mkdir(path.join(root, 'skills', 'demo'), { recursive: true });
    await fs.mkdir(path.join(root, 'skills', 'helper'), { recursive: true });
    await fs.mkdir(path.join(root, 'rules'), { recursive: true });
    await fs.mkdir(path.join(root, 'hooks'), { recursive: true });
    await fs.mkdir(path.join(root, 'references'), { recursive: true });
    await fs.mkdir(path.join(root, 'scripts'), { recursive: true });
    await fs.writeFile(path.join(root, 'bundle.yaml'), manifest);
    await fs.writeFile(path.join(root, 'skills', 'demo', 'SKILL.md'), '# Demo\n');
    await fs.writeFile(path.join(root, 'skills', 'helper', 'SKILL.md'), '# Helper\n');
    await fs.writeFile(path.join(root, 'rules', 'matched.md'), '# Rule\n');
    await fs.writeFile(
      path.join(root, 'hooks', 'protect-write.yaml'),
      `event: before_write
script: verify-state
failure: block
requiresConfirmation: false
`,
    );
    await fs.writeFile(path.join(root, 'references', 'state.md'), '# State\n');
    await fs.writeFile(path.join(root, 'scripts', 'verify-state.mjs'), 'process.exit(0);\n');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('accepts a valid bundle resource graph', async () => {
    expect(await validateBundle(await loadBundle(root))).toEqual([]);
  });

  it('requires at least one entry skill', async () => {
    await fs.writeFile(
      path.join(root, 'bundle.yaml'),
      manifest.replaceAll('visibility: entry', 'visibility: internal'),
    );

    expect(await validateBundle(await loadBundle(root))).toContain(
      'skills must include at least one entry Skill',
    );
  });

  it.each([
    {
      name: 'duplicate skill ids',
      source: manifest.replace('  - id: helper', '  - id: demo'),
      error: 'skills[1].id duplicates skills[0].id',
    },
    {
      name: 'duplicate skill paths',
      source: manifest.replace('path: skills/helper', 'path: skills/demo'),
      error: 'skills[1].path duplicates skills[0].path',
    },
    {
      name: 'an escaping path',
      source: manifest.replace('path: skills/helper', 'path: ../helper'),
      error: 'skills[1].path escapes the Bundle root',
    },
    {
      name: 'a path containing a parent segment',
      source: manifest.replace('path: skills/helper', 'path: skills/../helper'),
      error: 'skills[1].path escapes the Bundle root',
    },
    {
      name: 'an absolute path',
      source: manifest.replace('path: skills/helper', 'path: C:/helper'),
      error: 'skills[1].path must be relative to the Bundle root',
    },
    {
      name: 'overlapping capabilities',
      source: manifest.replace('optional: [rules, scripts]', 'optional: [rules, hooks, scripts]'),
      error: 'platforms capability hooks cannot be both required and optional',
    },
    {
      name: 'a matched rule without patterns',
      source: manifest.replace('      match: ["src/**"]\n', ''),
      error: 'resources.rules[0].match must contain at least one pattern',
    },
  ])('rejects $name', async ({ source, error }) => {
    await fs.writeFile(path.join(root, 'bundle.yaml'), source);

    expect(await validateBundle(await loadBundle(root))).toContain(error);
  });

  it('requires SKILL.md in every declared Skill directory', async () => {
    await fs.rm(path.join(root, 'skills', 'helper', 'SKILL.md'));

    expect(await validateBundle(await loadBundle(root))).toContain(
      'skills[1].path must contain SKILL.md',
    );
  });

  it('rejects symbolic links anywhere in the Bundle tree', async () => {
    const target = path.join(root, 'linked-target');
    await fs.mkdir(target);
    await fs.symlink(target, path.join(root, 'assets-link'), 'junction');

    expect(await validateBundle(await loadBundle(root))).toContain(
      'assets-link is a symbolic link',
    );
  });

  it('requires hooks to reference a declared script', async () => {
    await fs.writeFile(
      path.join(root, 'hooks', 'protect-write.yaml'),
      `event: before_write
script: missing-script
failure: block
requiresConfirmation: false
`,
    );

    expect(await validateBundle(await loadBundle(root))).toContain(
      'resources.hooks[0].script references undeclared script missing-script',
    );
  });

  it.each(['command', 'shell', 'run'])('rejects inline hook field %s', async (field) => {
    await fs.appendFile(path.join(root, 'hooks', 'protect-write.yaml'), `${field}: echo unsafe\n`);

    expect(await validateBundle(await loadBundle(root))).toContain(
      `resources.hooks[0].${field} is not allowed`,
    );
  });

  it('validates an enabled Engine package with the existing Skill loader', async () => {
    await fs.writeFile(
      path.join(root, 'bundle.yaml'),
      manifest.replace('enabled: false', 'enabled: true'),
    );
    await fs.mkdir(path.join(root, 'engine'), { recursive: true });

    const errors = await validateBundle(await loadBundle(root));

    expect(errors.some((error) => error.startsWith('engine.path is invalid:'))).toBe(true);
  });
});
