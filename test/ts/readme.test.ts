import { describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';

const readmes = ['README.md', 'README-zh.md'];

describe('README assets', () => {
  it.each(readmes)('uses npm-friendly absolute image URLs from main in %s', async (readmePath) => {
    const content = await fs.readFile(readmePath, 'utf-8');

    expect(content).not.toMatch(/\b(?:src|srcset)=["'](?:\.\/)?img\//);
    expect(content).toContain('https://github.com/pzy560117/opensuper/blob/main/img/');
    expect(content).not.toContain('/blob/master/');
  });

  it.each(readmes)('does not publish dead documentation or community image links in %s', async (readmePath) => {
    const content = await fs.readFile(readmePath, 'utf-8');

    for (const deadPath of [
      'docs/AUTO-TRANSITION.md',
      'docs/CONTEXT-COMPRESSION.md',
      'img/douyin.png',
      'img/wechat.jpg',
      'img/qq.jpg',
      'rpamis',
    ]) {
      expect(content).not.toContain(deadPath);
    }
  });

  it('documents build_pause in README state examples and field descriptions', async () => {
    const en = await fs.readFile('README.md', 'utf-8');
    const zh = await fs.readFile('README-zh.md', 'utf-8');

    expect(en).toContain('build_pause: null');
    expect(en).toContain('`build_pause` records an internal build-phase pause point');
    expect(en).toContain('`plan-ready` means the plan has been generated');

    expect(zh).toContain('build_pause: null');
    expect(zh).toContain('`build_pause` 记录 build 阶段内部暂停点');
    expect(zh).toContain('`plan-ready` 表示 plan 已生成');
  });

  it('documents the independent OpenTest strict quality-gate contract in both languages', async () => {
    const en = await fs.readFile('README.md', 'utf-8');
    const zh = await fs.readFile('README-zh.md', 'utf-8');
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));

    for (const content of [en, zh]) {
      expect(content).toContain('opentest_gate: required');
      expect(content).toContain(
        'opentest_strict_result: docs/opentest/reports/strict-verification.json',
      );
      expect(content).toContain('opensuper-opentest-gate.mjs');
      expect(content).toContain('opensuper-opentest-gate.sh');
      expect(content).toContain('OPENSUPER_OPENTEST_CONSUMER');
      expect(content).toContain('OPENTEST_GATE_JSON');
      expect(content).toContain('pass-contract');
      expect(content).toContain('pass-local');
      expect(content).toContain('not-run');
      expect(content).toContain('deferred');
      expect(content).toContain('ARCHITECTURE/README/CHANGELOG/CONTRIBUTING/LICENSE');
      expect(content).toContain('npm install --save-dev @pzy560117/opentest@^0.1.19');
    }

    expect(en).toContain(`**${packageJson.version} Highlights**`);
    expect(zh).toContain(`**${packageJson.version} 亮点**`);
    expect(en).toContain(`### ${packageJson.version} validated baseline`);
    expect(zh).toContain(`### ${packageJson.version} 验证基线`);
  });
});
