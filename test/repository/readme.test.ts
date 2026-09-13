import { describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';

const readmes = ['README.md', 'README-zh.md'];

describe('README assets', () => {
  it.each(readmes)('uses npm-friendly absolute image URLs in %s', async (readmePath) => {
    const content = await fs.readFile(readmePath, 'utf-8');

    expect(content).not.toMatch(/\b(?:src|srcset)=["'](?:\.\/)?img\//);
    expect(content).toContain('https://github.com/pzy560117/opensuper/blob/main/img/');
  });

  it('keeps the README focused and starts Quick Start with project initialization', async () => {
    const readmeEn = await fs.readFile('README.md', 'utf-8');
    const readmeZh = await fs.readFile('README-zh.md', 'utf-8');

    for (const heading of ['## Commands', '## Skills', '## Workflow', '## Project Structure']) {
      expect(readmeEn).not.toContain(heading);
    }
    for (const heading of ['## CLI命令', '## 技能', '## 工作流', '## 项目结构']) {
      expect(readmeZh).not.toContain(heading);
    }

    const quickStartEn =
      readmeEn.split('## Quick Start')[1]?.split('### Project configuration')[0] ?? '';
    const quickStartZh = readmeZh.split('## 快速开始')[1]?.split('### 项目配置')[0] ?? '';
    expect(quickStartEn).toContain('cd your-project');
    expect(quickStartEn).toContain('opensuper init');
    expect(quickStartEn).not.toContain('opensuper init --scope global');
    expect(quickStartZh).toContain('cd your-project');
    expect(quickStartZh).toContain('opensuper init');
    expect(quickStartZh).not.toContain('opensuper init --scope global');
    expect(readmeEn).toContain('`opensuper init` supports 37 AI coding platforms:');
    expect(readmeZh).toContain('`opensuper init` 支持 37 个 AI 编码平台：');
  });

  it('keeps English and Chinese README feature summaries aligned', async () => {
    const readmeEn = await fs.readFile('README.md', 'utf-8');
    const readmeZh = await fs.readFile('README-zh.md', 'utf-8');

    expect(readmeZh).toContain('Skill 平台');
    expect(readmeEn).toContain('Skill platform');
  });

  it('keeps the documented Node.js requirement aligned with package engines', async () => {
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8')) as {
      engines: { node: string };
    };
    const match = packageJson.engines.node.match(/^\^(\d+)\.(\d+)\.0 \|\| >=(\d+)\.0\.0$/);
    expect(match).not.toBeNull();
    const minimumMajor = match![1];
    const minimumMinor = match![2];
    const nextMajor = match![3];
    const [readmeEn, readmeZh, contributingEn, contributingZh] = await Promise.all([
      fs.readFile('README.md', 'utf-8'),
      fs.readFile('README-zh.md', 'utf-8'),
      fs.readFile('CONTRIBUTING.md', 'utf-8'),
      fs.readFile('CONTRIBUTING-zh.md', 'utf-8'),
    ]);

    expect(readmeEn).toContain(
      `Node.js ${minimumMajor}.${minimumMinor}+ (${minimumMajor}.x), or ${nextMajor}+`,
    );
    expect(readmeZh).toContain(
      `Node.js ${minimumMajor}.${minimumMinor}+（${minimumMajor}.x），或 ${nextMajor}+`,
    );
    const lockfile = JSON.parse(await fs.readFile('package-lock.json', 'utf-8'));
    const developmentRange = lockfile.packages['node_modules/jsdom'].engines.node;
    expect(contributingEn).toContain(`Node.js \`${developmentRange}\``);
    expect(contributingZh).toContain(`Node.js \`${developmentRange}\``);
  });

  it('highlights the current development sync without stale prerelease announcements', async () => {
    const readmeEn = await fs.readFile('README.md', 'utf-8');
    const readmeZh = await fs.readFile('README-zh.md', 'utf-8');

    expect(readmeEn).toContain('**OpenSuper 0.4.0 upstream development sync**');
    expect(readmeZh).toContain('**OpenSuper 0.4.0 上游开发树同步版**');
    for (const version of ['0.4.0-rc.1', '0.4.0-beta.7', '0.4.0-beta.1', '0.3.9']) {
      expect(readmeEn).not.toContain(`**${version}**`);
      expect(readmeZh).not.toContain(`**${version}**`);
    }
    expect(readmeEn).toContain('[Changelog](CHANGELOG.md)');
    expect(readmeZh).toContain('[Changelog](CHANGELOG.md)');
    expect(readmeEn).not.toMatch(/github\.com\/pzy560117\/opensuper\/(?:en|zh)\//u);
    expect(readmeZh).not.toMatch(/github\.com\/pzy560117\/opensuper\/(?:en|zh)\//u);
  });

  it('documents the compact current project configuration in both languages', async () => {
    const readmeEn = await fs.readFile('README.md', 'utf-8');
    const readmeZh = await fs.readFile('README-zh.md', 'utf-8');
    const configEn = readmeEn.split('### Project configuration')[1]?.split('## Support')[0] ?? '';
    const configZh = readmeZh.split('### 项目配置')[1]?.split('## 对OpenClaw')[0] ?? '';
    const managedFields = [
      'schema: opensuper.project.v1',
      'default_workflow: native',
      'workflows: [native, classic]',
      'ambient_resume: true',
      'memory:',
      'learning: true',
      'retrieval: true',
      'knowledge:',
      'provider: local',
      'hook:',
      'allow_paths: []',
      'native:',
      'artifact_root: docs',
      'clarification_mode: batch',
      'archive_confirmation: automatic',
      'max_verify_failures: 5',
      'classic:',
      'artifact_layout: docs',
      'context_compression: off',
      'review_mode: standard',
      'auto_transition: true',
    ];

    for (const field of managedFields) {
      expect(configEn).toContain(field);
      expect(configZh).toContain(field);
    }
    expect(configEn).toContain('language: en');
    expect(configZh).toContain('language: zh-CN');
    expect(configEn).toContain('Cloud Knowledge and self-hosted PR');
    expect(configZh).toContain('云端知识、私有化 PR');
    expect(configEn).toContain('<summary>View the compact config shape');
    expect(configZh).toContain('<summary>查看同时启用 Native 与 Classic 时的精简配置骨架');
    expect(configEn).not.toContain('snapshot:');
    expect(configZh).not.toContain('snapshot:');
    expect(configZh).not.toContain('远端知识');
    expect(configZh).not.toContain('仓库自有 PR');
  });

  it('keeps the bilingual Supervisor showcase backed by repository assets', async () => {
    const readmeEn = await fs.readFile('README.md', 'utf8');
    const readmeZh = await fs.readFile('README-zh.md', 'utf-8');
    const { README_VIDEOS } = await import('../../scripts/release/npm-readme.mjs');

    for (const video of README_VIDEOS) {
      const url = `https://github.com/user-attachments/assets/${video.attachmentId}`;
      expect(readmeEn).toContain(url);
      expect(readmeZh).toContain(url);
      await expect(fs.stat(`img/${video.name}.mp4`)).resolves.toBeDefined();
      // Preview images are not referenced by the GitHub READMEs: the
      // npm-readme transform swaps them in when packing for npmjs.com, where
      // user-attachment videos cannot render as players.
      await expect(fs.stat(`img/${video.name}-preview.png`)).resolves.toBeDefined();
    }
    for (const readme of [readmeEn, readmeZh]) {
      expect(readme).not.toMatch(/!\[[^\]]*\]\(img\/[a-z0-9-]+\.mp4\)/u);
      expect(readme).not.toContain('-preview.png');
    }
  });

  it('keeps Skill Creator backend commands in advanced operation docs', async () => {
    const guideEn = await fs.readFile('docs/operations/SKILL-CREATION.md', 'utf-8');
    const guideZh = await fs.readFile('docs/operations/SKILL-CREATION-ZH.md', 'utf-8');
    const ordinaryEn = guideEn.split('## Advanced backend reference')[0];
    const ordinaryZh = guideZh.split('## 高级后端参考')[0];

    expect(guideEn).toContain('## Advanced backend reference');
    expect(guideZh).toContain('## 高级后端参考');
    expect(guideEn).toContain('opensuper creator next <name>');
    expect(guideZh).toContain('opensuper creator next <name>');
    expect(ordinaryEn).not.toContain('opensuper bundle factory-guide');
    expect(ordinaryEn).not.toContain('opensuper bundle factory-propose');
    expect(ordinaryEn).not.toContain('opensuper bundle factory-init');
    expect(ordinaryEn).not.toContain('opensuper bundle list');
    expect(ordinaryEn).not.toContain('opensuper bundle status');
    expect(ordinaryZh).not.toContain('opensuper bundle factory-guide');
    expect(ordinaryZh).not.toContain('opensuper bundle factory-propose');
    expect(ordinaryZh).not.toContain('opensuper bundle factory-init');
    expect(ordinaryZh).not.toContain('opensuper bundle list');
    expect(ordinaryZh).not.toContain('opensuper bundle status');
  });
});
