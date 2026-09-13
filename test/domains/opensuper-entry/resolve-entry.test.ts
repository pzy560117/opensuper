import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveOpenSuperEntry } from '../../../domains/opensuper-entry/resolve-entry.js';
import { resolveOrActivateOpenSuperEntry } from '../../../domains/opensuper-entry/project-activation.js';
import { writeWorkflowGlobalConfig } from '../../../domains/workflow-contract/global-config.js';
import {
  defaultProjectConfig,
  writeProjectConfig,
} from '../../../domains/opensuper-native/native-config.js';

describe('OpenSuper entry resolution', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-entry-'));
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it('does not guess a Classic workflow when project config is absent', async () => {
    const before = await fs.readdir(projectRoot);

    await expect(resolveOpenSuperEntry(projectRoot)).rejects.toThrow(
      'OpenSuper workflow entry is unavailable',
    );

    expect(await fs.readdir(projectRoot)).toEqual(before);
    await expect(
      fs.access(path.join(projectRoot, '.opensuper', 'config.yaml')),
    ).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('activates an unconfigured project from the global workflow template', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-global-home-'));
    await fs.mkdir(path.join(projectRoot, '.git'));
    const globalConfig = defaultProjectConfig('artifacts', 'zh-CN');
    globalConfig.workflows = ['native'];
    await writeWorkflowGlobalConfig(homeDir, {
      ...globalConfig,
      schema: 'opensuper.global.v1',
    });

    try {
      await expect(resolveOrActivateOpenSuperEntry(projectRoot, { homeDir })).resolves.toEqual({
        workflow: 'native',
        skill: 'opensuper-native',
        source: 'global-config',
      });

      await expect(
        fs.readFile(path.join(projectRoot, '.opensuper', 'config.yaml'), 'utf8'),
      ).resolves.toContain('artifact_root: artifacts');
      await expect(
        fs.access(path.join(projectRoot, 'artifacts', 'opensuper', 'changes')),
      ).resolves.toBeUndefined();
      await expect(
        fs.access(path.join(homeDir, 'artifacts', 'opensuper', 'changes')),
      ).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it('keeps an activated project stable after the global template changes', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-global-home-'));
    await fs.mkdir(path.join(projectRoot, '.git'));
    const initial = defaultProjectConfig('docs');
    await writeWorkflowGlobalConfig(homeDir, { ...initial, schema: 'opensuper.global.v1' });

    try {
      await resolveOrActivateOpenSuperEntry(projectRoot, { homeDir });
      const changed = defaultProjectConfig('other-root');
      changed.default_workflow = 'classic';
      changed.workflows = ['classic'];
      await writeWorkflowGlobalConfig(homeDir, {
        ...changed,
        schema: 'opensuper.global.v1',
      });

      await expect(resolveOrActivateOpenSuperEntry(projectRoot, { homeDir })).resolves.toEqual({
        workflow: 'native',
        skill: 'opensuper-native',
        source: 'project-config',
      });
      await expect(
        fs.readFile(path.join(projectRoot, '.opensuper', 'config.yaml'), 'utf8'),
      ).resolves.toContain('artifact_root: docs');
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it('uses a built-in Native default when no global template exists', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-empty-home-'));
    await fs.mkdir(path.join(projectRoot, '.git'));
    try {
      await expect(resolveOrActivateOpenSuperEntry(projectRoot, { homeDir })).resolves.toEqual({
        workflow: 'native',
        skill: 'opensuper-native',
        source: 'built-in-default',
      });
      await expect(
        fs.access(path.join(projectRoot, 'docs', 'opensuper', 'changes')),
      ).resolves.toBeUndefined();
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it('fails closed on malformed global config without activating the project', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-broken-home-'));
    await fs.mkdir(path.join(homeDir, '.opensuper'), { recursive: true });
    await fs.writeFile(path.join(homeDir, '.opensuper', 'config.yaml'), 'schema: [\n', 'utf8');
    try {
      await expect(resolveOrActivateOpenSuperEntry(projectRoot, { homeDir })).rejects.toThrow(
        'Invalid global OpenSuper config',
      );
      await expect(
        fs.access(path.join(projectRoot, '.opensuper', 'config.yaml')),
      ).rejects.toMatchObject({
        code: 'ENOENT',
      });
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it.each([
    ['native', 'opensuper-native'],
    ['classic', 'opensuper-classic'],
  ] as const)('obeys an explicit %s project default', async (workflow, skill) => {
    const config = defaultProjectConfig('docs');
    config.default_workflow = workflow;
    await writeProjectConfig(projectRoot, config);
    const before = await fs.readFile(path.join(projectRoot, '.opensuper', 'config.yaml'));

    await expect(resolveOpenSuperEntry(projectRoot)).resolves.toEqual({
      workflow,
      skill,
      source: 'project-config',
    });

    await expect(fs.readFile(path.join(projectRoot, '.opensuper', 'config.yaml'))).resolves.toEqual(
      before,
    );
  });

  it('discovers the configured project when resolution starts in a nested directory', async () => {
    const nested = path.join(projectRoot, 'packages', 'app', 'src');
    await fs.mkdir(nested, { recursive: true });
    await fs.mkdir(path.join(projectRoot, '.git'));
    await writeProjectConfig(projectRoot, defaultProjectConfig('docs'));

    await expect(resolveOpenSuperEntry(nested)).resolves.toMatchObject({
      workflow: 'native',
      skill: 'opensuper-native',
      source: 'project-config',
    });
  });

  it('fails closed for malformed YAML instead of using the Classic fallback', async () => {
    await fs.mkdir(path.join(projectRoot, '.opensuper'));
    await fs.writeFile(path.join(projectRoot, '.opensuper', 'config.yaml'), 'schema: [', 'utf8');

    await expect(resolveOpenSuperEntry(projectRoot)).rejects.toThrow();
  });

  it('accepts unknown extension fields without changing workflow ownership', async () => {
    await fs.mkdir(path.join(projectRoot, '.opensuper'));
    await fs.writeFile(
      path.join(projectRoot, '.opensuper', 'config.yaml'),
      [
        'schema: opensuper.project.v1',
        'default_workflow: native',
        'native:',
        '  artifact_root: .',
        '  unexpected: true',
        '',
      ].join('\n'),
      'utf8',
    );

    await expect(resolveOpenSuperEntry(projectRoot)).resolves.toMatchObject({
      workflow: 'native',
      source: 'project-config',
    });
  });
});
