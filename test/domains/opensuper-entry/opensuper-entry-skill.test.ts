import { promises as fs } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const chineseRoot = path.resolve('assets', 'skills-zh');
const englishRoot = path.resolve('assets', 'skills');

async function readSkill(root: string, name: string): Promise<string> {
  return fs.readFile(path.join(root, name, 'SKILL.md'), 'utf8');
}

describe('Chinese OpenSuper entry Skills', () => {
  it('keeps /opensuper as a short configuration-only alias', async () => {
    const source = await readSkill(chineseRoot, 'opensuper');

    expect(source).toContain('name: opensuper');
    expect(source.match(/^description:\s*['"](.+)['"]$/mu)?.[1]).toBe(
      'OpenSuper 工作流入口。当用户明确调用 /opensuper，或明确要求使用 OpenSuper 但未指定 Native/Classic 时使用；按项目配置加载 Native 或 Classic。',
    );
    expect(source).not.toContain('存在需要恢复的 active OpenSuper change');
    expect(source).toContain('opensuper workflow resolve . --activate --json');
    expect(source).not.toContain('--json --task');
    expect(source).not.toContain('opensuper-entry-runtime.mjs . --json');
    expect(source).toContain('不得搜索 Skill 文件、扫描平台配置目录或直接调用内部 bundle');
    expect(source).toContain('command not found');
    expect(source).toContain('停止并说明');
    expect(source).toContain('CLI 已启动但返回非零');
    expect(source).toContain('opensuper.workflow-resolution.v1');
    expect(source).toContain('只接受');
    expect(source).toContain('/opensuper-native');
    expect(source).toContain('/opensuper-classic');
    expect(source).toContain('不根据任务');
    expect(source.length).toBeLessThan(2_000);
    expect(source).not.toMatch(/OpenSpec|Superpowers|brainstorming|TDD|\/opensuper-open/iu);
  });

  it('routes Classic through a bounded entry while retaining its workflow identity', async () => {
    const source = await readSkill(chineseRoot, 'opensuper-classic');

    expect(source).toContain('name: opensuper-classic');
    expect(source).toContain('OpenSpec');
    expect(source).toContain('Superpowers');
    expect(source).toContain('opensuper state select <change-name>');
    expect(source).toContain('/opensuper-open');
    expect(source).toContain('/opensuper-build');
    expect(source).toContain('opensuper-classic/reference/scripts.md');
    // Measure the loaded text, including long paragraphs, rather than formatted lines.
    expect(source.length).toBeLessThanOrEqual(8_000);
    expect(source).not.toMatch(/\/opensuper(?![-/])/u);
  });

  it('keeps shared Classic references on the explicit Classic entry', async () => {
    const referenceRoot = path.join(chineseRoot, 'opensuper-classic', 'reference');
    const files = (await fs.readdir(referenceRoot)).filter((name) => name.endsWith('.md'));
    const source = (
      await Promise.all(files.map((name) => fs.readFile(path.join(referenceRoot, name), 'utf8')))
    ).join('\n');

    expect(source).toContain('/opensuper-classic');
    expect(source).not.toMatch(/\/opensuper(?![-/])/u);
  });

  it('keeps Classic child Skills inside the explicit Classic entry', async () => {
    const classicChildren = [
      'opensuper-open',
      'opensuper-design',
      'opensuper-build',
      'opensuper-verify',
      'opensuper-archive',
      'opensuper-hotfix',
      'opensuper-tweak',
    ];
    const sources = await Promise.all(classicChildren.map((name) => readSkill(chineseRoot, name)));

    for (const source of sources) {
      expect(source).not.toMatch(/\/opensuper(?![-/])/u);
      expect(source).not.toContain('/opensuper-native');
    }
  });

  it('publishes the bilingual Classic entry through the shared manifest', async () => {
    const manifest = JSON.parse(await fs.readFile(path.resolve('assets', 'manifest.json'), 'utf8'));

    expect(manifest.skills).toContain('opensuper-classic/SKILL.md');
  });
});

describe('English OpenSuper entry Skills', () => {
  it('keeps /opensuper as a short configuration-only alias', async () => {
    const source = await readSkill(englishRoot, 'opensuper');

    expect(source).toContain('name: opensuper');
    expect(source.match(/^description:\s*['"](.+)['"]$/mu)?.[1]).toBe(
      'OpenSuper workflow entry. Use when the user invokes /opensuper or asks to use OpenSuper without choosing Native or Classic; load Native or Classic from project configuration.',
    );
    expect(source).not.toContain('an active OpenSuper change needs to be resumed');
    expect(source).toContain('opensuper workflow resolve . --activate --json');
    expect(source).not.toContain('--json --task');
    expect(source).not.toContain('opensuper-entry-runtime.mjs . --json');
    expect(source).toContain(
      'Do not search for Skill files, scan platform configuration directories, or invoke an internal bundle directly',
    );
    expect(source).toContain('command not found');
    expect(source).toContain('stop and report');
    expect(source).toContain('If the CLI starts but exits nonzero');
    expect(source).toContain('opensuper.workflow-resolution.v1');
    expect(source).toContain('Only accept');
    expect(source).toContain('/opensuper-native');
    expect(source).toContain('/opensuper-classic');
    expect(source).toContain('Do not switch');
    expect(source.length).toBeLessThan(3_000);
    expect(source).not.toMatch(/OpenSpec|Superpowers|brainstorming|TDD|\/opensuper-open/iu);
  });

  it('routes Classic through a bounded English entry while retaining its workflow identity', async () => {
    const source = await readSkill(englishRoot, 'opensuper-classic');

    expect(source).toContain('name: opensuper-classic');
    expect(source).toContain('OpenSpec');
    expect(source).toContain('Superpowers');
    expect(source).toContain('opensuper state select <change-name>');
    expect(source).toContain('/opensuper-open');
    expect(source).toContain('/opensuper-build');
    expect(source).toContain('opensuper-classic/reference/scripts.md');
    expect(source.length).toBeLessThanOrEqual(14_000);
    expect(source).not.toMatch(/\/opensuper(?![-/])/u);
  });

  it('keeps shared Classic references on the explicit Classic entry', async () => {
    const referenceRoot = path.join(englishRoot, 'opensuper-classic', 'reference');
    const files = (await fs.readdir(referenceRoot)).filter((name) => name.endsWith('.md'));
    const source = (
      await Promise.all(files.map((name) => fs.readFile(path.join(referenceRoot, name), 'utf8')))
    ).join('\n');

    expect(source).toContain('/opensuper-classic');
    expect(source).not.toMatch(/\/opensuper(?![-/])/u);
  });

  it('keeps Classic child Skills inside the explicit Classic entry', async () => {
    const classicChildren = [
      'opensuper-open',
      'opensuper-design',
      'opensuper-build',
      'opensuper-verify',
      'opensuper-archive',
      'opensuper-hotfix',
      'opensuper-tweak',
    ];
    const sources = await Promise.all(classicChildren.map((name) => readSkill(englishRoot, name)));

    for (const source of sources) {
      expect(source).not.toMatch(/\/opensuper(?![-/])/u);
      expect(source).not.toContain('/opensuper-native');
    }
  });
});
