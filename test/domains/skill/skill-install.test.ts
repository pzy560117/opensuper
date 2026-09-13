import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { installProjectSkill } from '../../../domains/skill/install.js';

async function writeSkill(root: string, version: string): Promise<void> {
  await fs.mkdir(path.join(root, 'opensuper'), { recursive: true });
  await fs.writeFile(path.join(root, 'SKILL.md'), `# Demo ${version}\n`);
  await fs.writeFile(
    path.join(root, 'opensuper', 'skill.yaml'),
    `apiVersion: opensuper/v1alpha1
kind: Skill
metadata:
  name: demo
  version: "${version}"
  description: Demo skill
goal:
  statement: Complete demo
  inputs: []
  outputs: []
  success: [Done]
orchestration:
  mode: deterministic
  entry: finish
  steps:
    - id: finish
      action: { type: checkpoint }
skills: []
agents: []
tools: []
`,
  );
}

describe('Project Skill installation', () => {
  let root: string;
  let projectRoot: string;
  let sourceRoot: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-skill-install-'));
    projectRoot = path.join(root, 'project');
    sourceRoot = path.join(root, 'source');
    await writeSkill(sourceRoot, '1');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('installs a validated Skill into the project pool', async () => {
    const result = await installProjectSkill(sourceRoot, projectRoot);

    expect(result.destination).toBe(path.join(projectRoot, '.opensuper', 'skills', 'demo'));
    expect(result.version).toBe('1');
    await expect(fs.readFile(path.join(result.destination, 'SKILL.md'), 'utf8')).resolves.toBe(
      '# Demo 1\n',
    );
  });

  it('does not overwrite an installed Skill by default', async () => {
    await installProjectSkill(sourceRoot, projectRoot);

    await expect(installProjectSkill(sourceRoot, projectRoot)).rejects.toThrow(
      /already installed.*--overwrite/su,
    );
  });

  it('replaces an installed Skill when overwrite is explicit', async () => {
    await installProjectSkill(sourceRoot, projectRoot);
    await writeSkill(sourceRoot, '2');

    const result = await installProjectSkill(sourceRoot, projectRoot, { overwrite: true });

    expect(result.version).toBe('2');
    await expect(fs.readFile(path.join(result.destination, 'SKILL.md'), 'utf8')).resolves.toBe(
      '# Demo 2\n',
    );
  });

  it('rejects symbolic links in the source package', async () => {
    const outsideDir = path.join(root, 'outside');
    await fs.mkdir(outsideDir);
    await fs.writeFile(path.join(outsideDir, 'outside.txt'), 'outside\n');
    await fs.symlink(
      outsideDir,
      path.join(sourceRoot, 'linked'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    await expect(installProjectSkill(sourceRoot, projectRoot)).rejects.toThrow(
      /symbolic link.*linked/su,
    );
  });
});
