import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { resolveSkill } from '../../../domains/skill/discovery.js';

async function writeSkill(root: string, name: string, version = '1'): Promise<void> {
  await fs.mkdir(path.join(root, 'opensuper'), { recursive: true });
  await fs.writeFile(path.join(root, 'SKILL.md'), `# ${name}\n`);
  await fs.writeFile(
    path.join(root, 'opensuper', 'skill.yaml'),
    `apiVersion: opensuper/v1alpha1
kind: Skill
metadata:
  name: ${name}
  version: "${version}"
  description: ${name} skill
goal:
  statement: Complete ${name}
  inputs: []
  outputs: []
  success:
    - Done
orchestration:
  mode: deterministic
  entry: finish
  steps:
    - id: finish
      action:
        type: checkpoint
skills: []
agents: []
tools: []
`,
  );
}

describe('Skill discovery', () => {
  let root: string;
  let projectRoot: string;
  let builtinRoot: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-skill-discovery-'));
    projectRoot = path.join(root, 'project');
    builtinRoot = path.join(root, 'builtin');
    await fs.mkdir(projectRoot, { recursive: true });
    await fs.mkdir(builtinRoot, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('resolves an explicit directory before named locations', async () => {
    const explicit = path.join(root, 'explicit');
    await writeSkill(explicit, 'demo', '3');
    await writeSkill(path.join(projectRoot, '.opensuper', 'skills', 'demo'), 'demo', '2');
    await writeSkill(path.join(builtinRoot, 'demo'), 'demo', '1');

    const result = await resolveSkill(explicit, { projectRoot, builtinRoot });

    expect(result).toMatchObject({
      name: 'demo',
      origin: 'explicit',
      root: path.resolve(explicit),
      version: '3',
    });
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('lets a project Skill override a built-in Skill with the same name', async () => {
    await writeSkill(path.join(projectRoot, '.opensuper', 'skills', 'demo'), 'demo', '2');
    await writeSkill(path.join(builtinRoot, 'demo'), 'demo', '1');

    const result = await resolveSkill('demo', { projectRoot, builtinRoot });

    expect(result.origin).toBe('project');
    expect(result.version).toBe('2');
  });

  it('falls back to a built-in Skill when no project override exists', async () => {
    await writeSkill(path.join(builtinRoot, 'demo'), 'demo', '1');

    const result = await resolveSkill('demo', { projectRoot, builtinRoot });

    expect(result.origin).toBe('builtin');
    expect(result.version).toBe('1');
  });

  it('fails closed when a project override exists but is invalid', async () => {
    const projectSkill = path.join(projectRoot, '.opensuper', 'skills', 'demo');
    await writeSkill(projectSkill, 'demo', '2');
    await fs.writeFile(
      path.join(projectSkill, 'opensuper', 'skill.yaml'),
      'apiVersion: opensuper/v1alpha1\nkind: Skill\n',
    );
    await writeSkill(path.join(builtinRoot, 'demo'), 'demo', '1');

    await expect(resolveSkill('demo', { projectRoot, builtinRoot })).rejects.toThrow(
      /project Skill "demo".*skill\.yaml/su,
    );
  });

  it('reports every named search location when a Skill is missing', async () => {
    await expect(resolveSkill('missing', { projectRoot, builtinRoot })).rejects.toThrow(
      new RegExp(
        `${path.join(projectRoot, '.opensuper', 'skills', 'missing').replaceAll('\\', '\\\\')}.*${path
          .join(builtinRoot, 'missing')
          .replaceAll('\\', '\\\\')}`,
        'su',
      ),
    );
  });
});
