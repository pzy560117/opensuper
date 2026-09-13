import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveInitWorkflow } from '../../../domains/opensuper-entry/init-workflow.js';
import {
  defaultProjectConfig,
  writeProjectConfig,
} from '../../../domains/opensuper-native/native-config.js';

describe('OpenSuper init workflow policy', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-init-workflow-'));
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it('defaults a project with no OpenSuper history to Native without writing during resolution', async () => {
    const before = await fs.readdir(projectRoot);

    await expect(resolveInitWorkflow(projectRoot)).resolves.toEqual({
      workflow: 'native',
      source: 'new-project-default',
      artifactRoot: 'docs',
      classicArtifactLayout: 'docs',
      writeProjectConfig: true,
      legacyEvidence: [],
    });

    expect(await fs.readdir(projectRoot)).toEqual(before);
  });

  it.each([
    '.opensuper/config.yaml',
    'openspec/changes/active-change/.opensuper.yaml',
    'openspec/changes/archive/old-change/.opensuper.yaml',
  ])('preserves the Classic fallback when legacy evidence exists at %s', async (legacyPath) => {
    const file = path.join(projectRoot, ...legacyPath.split('/'));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, 'workflow: full\n', 'utf8');

    await expect(resolveInitWorkflow(projectRoot)).resolves.toMatchObject({
      workflow: 'classic',
      source: 'legacy-project',
      writeProjectConfig: false,
      legacyEvidence: [legacyPath],
    });
  });

  it.each(['openspec', 'docs/superpowers'])(
    'does not mistake standalone %s usage for an existing OpenSuper Classic project',
    async (standalonePath) => {
      await fs.mkdir(path.join(projectRoot, ...standalonePath.split('/')), { recursive: true });

      await expect(resolveInitWorkflow(projectRoot)).resolves.toMatchObject({
        workflow: 'native',
        source: 'new-project-default',
        writeProjectConfig: true,
        legacyEvidence: [],
      });
    },
  );

  it('treats a managed Ambient Resume block as legacy OpenSuper evidence', async () => {
    await fs.writeFile(
      path.join(projectRoot, 'AGENTS.md'),
      '<opensuper-ambient-resume>\nold guidance\n</opensuper-ambient-resume>\n',
      'utf8',
    );

    await expect(resolveInitWorkflow(projectRoot)).resolves.toMatchObject({
      workflow: 'classic',
      source: 'legacy-project',
      legacyEvidence: ['AGENTS.md#opensuper-ambient-resume'],
    });
  });

  it('does not mistake the workflow-neutral v2 resume block for Classic state', async () => {
    await fs.writeFile(
      path.join(projectRoot, 'AGENTS.md'),
      [
        '<opensuper-ambient-resume>',
        '<!-- Contract: opensuper.resume_probe.v2 -->',
        '</opensuper-ambient-resume>',
        '',
      ].join('\n'),
      'utf8',
    );

    await expect(resolveInitWorkflow(projectRoot)).resolves.toMatchObject({
      workflow: 'native',
      source: 'new-project-default',
      legacyEvidence: [],
    });
  });

  it('does not scan legacy change evidence through a junction', async () => {
    const outsideRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'opensuper-init-workflow-outside-'),
    );
    try {
      await fs.mkdir(path.join(projectRoot, 'openspec'), { recursive: true });
      await fs.mkdir(path.join(outsideRoot, 'external-change'), { recursive: true });
      await fs.writeFile(
        path.join(outsideRoot, 'external-change', '.opensuper.yaml'),
        'workflow: full\n',
        'utf8',
      );
      try {
        await fs.symlink(
          outsideRoot,
          path.join(projectRoot, 'openspec', 'changes'),
          process.platform === 'win32' ? 'junction' : 'dir',
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EPERM') return;
        throw error;
      }

      await expect(resolveInitWorkflow(projectRoot)).rejects.toThrow(/symbolic link or junction/iu);
    } finally {
      await fs.rm(outsideRoot, { recursive: true, force: true });
    }
  });

  it('does not read Ambient Resume evidence through a linked file', async () => {
    const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-init-resume-outside-'));
    const outsideFile = path.join(outsideRoot, 'AGENTS.md');
    try {
      await fs.writeFile(
        outsideFile,
        '<opensuper-ambient-resume>\nold guidance\n</opensuper-ambient-resume>\n',
        'utf8',
      );
      try {
        await fs.symlink(outsideFile, path.join(projectRoot, 'AGENTS.md'), 'file');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EPERM') return;
        throw error;
      }

      await expect(resolveInitWorkflow(projectRoot)).rejects.toThrow(
        /symbolic link or junction|alias must point/iu,
      );
    } finally {
      await fs.rm(outsideRoot, { recursive: true, force: true });
    }
  });

  it('accepts an AGENTS.md alias that points to the in-project CLAUDE.md file', async () => {
    await fs.writeFile(path.join(projectRoot, 'CLAUDE.md'), '# Project instructions\n', 'utf8');
    try {
      await fs.symlink('CLAUDE.md', path.join(projectRoot, 'AGENTS.md'), 'file');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM') return;
      throw error;
    }

    await expect(resolveInitWorkflow(projectRoot)).resolves.toMatchObject({
      workflow: 'native',
      source: 'new-project-default',
      legacyEvidence: [],
    });
  });

  it('lets an explicit Native choice override legacy fallback and select a custom root', async () => {
    const state = path.join(projectRoot, 'openspec', 'changes', 'legacy', '.opensuper.yaml');
    await fs.mkdir(path.dirname(state), { recursive: true });
    await fs.writeFile(state, 'workflow: full\n', 'utf8');

    await expect(
      resolveInitWorkflow(projectRoot, { workflow: 'native', artifactRoot: 'docs' }),
    ).resolves.toMatchObject({
      workflow: 'native',
      source: 'explicit-option',
      artifactRoot: 'docs',
      classicArtifactLayout: 'legacy',
      writeProjectConfig: true,
      legacyEvidence: ['openspec/changes/legacy/.opensuper.yaml'],
    });
  });

  it('treats an explicit Native root as an explicit Native choice', async () => {
    await fs.mkdir(path.join(projectRoot, '.opensuper'));
    await fs.writeFile(
      path.join(projectRoot, '.opensuper', 'config.yaml'),
      'language: en\n',
      'utf8',
    );

    await expect(resolveInitWorkflow(projectRoot, { artifactRoot: 'docs' })).resolves.toMatchObject(
      {
        workflow: 'native',
        source: 'explicit-option',
        artifactRoot: 'docs',
        classicArtifactLayout: 'docs',
        writeProjectConfig: true,
      },
    );
  });

  it('persists an explicit Classic choice for a new project', async () => {
    await expect(resolveInitWorkflow(projectRoot, { workflow: 'classic' })).resolves.toEqual({
      workflow: 'classic',
      source: 'explicit-option',
      artifactRoot: 'docs',
      classicArtifactLayout: 'docs',
      writeProjectConfig: true,
      legacyEvidence: [],
    });
  });

  it.each(['native', 'classic'] as const)(
    'keeps an existing %s project config authoritative',
    async (workflow) => {
      const config = defaultProjectConfig('docs');
      config.default_workflow = workflow;
      await writeProjectConfig(projectRoot, config);

      await expect(resolveInitWorkflow(projectRoot)).resolves.toEqual({
        workflow,
        source: 'project-config',
        artifactRoot: 'docs',
        classicArtifactLayout: 'docs',
        writeProjectConfig: false,
        legacyEvidence: [],
      });
    },
  );

  it('chooses docs when a Native-only project enables Classic for the first time', async () => {
    await writeProjectConfig(projectRoot, defaultProjectConfig('docs'));

    await expect(resolveInitWorkflow(projectRoot, { workflow: 'classic' })).resolves.toMatchObject({
      workflow: 'classic',
      source: 'explicit-option',
      artifactRoot: 'docs',
      classicArtifactLayout: 'docs',
      writeProjectConfig: true,
    });
  });

  it('lets an explicit workflow change only the configured default entry', async () => {
    await writeProjectConfig(projectRoot, defaultProjectConfig('.'));

    await expect(resolveInitWorkflow(projectRoot, { workflow: 'classic' })).resolves.toEqual({
      workflow: 'classic',
      source: 'explicit-option',
      artifactRoot: '.',
      classicArtifactLayout: 'docs',
      writeProjectConfig: true,
      legacyEvidence: [],
    });
  });

  it('preserves an explicit dormant Classic layout when a Native-only project enables Classic', async () => {
    const config = defaultProjectConfig('docs');
    config.classic = { artifact_layout: 'legacy' };
    await writeProjectConfig(projectRoot, config);

    await expect(resolveInitWorkflow(projectRoot, { workflow: 'classic' })).resolves.toMatchObject({
      workflow: 'classic',
      classicArtifactLayout: 'legacy',
      writeProjectConfig: true,
    });
  });

  it('fails closed when an explicit root conflicts with project config', async () => {
    await writeProjectConfig(projectRoot, defaultProjectConfig('docs'));

    await expect(resolveInitWorkflow(projectRoot, { artifactRoot: 'artifacts' })).rejects.toThrow(
      /configured Native artifact root is docs/u,
    );
  });

  it('rejects a Native artifact root for an explicitly Classic initialization', async () => {
    await expect(
      resolveInitWorkflow(projectRoot, { workflow: 'classic', artifactRoot: 'docs' }),
    ).rejects.toThrow(/--root is only valid with the Native workflow/u);
  });
});
