import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  getAssetsDir,
  readManifest,
  getManifestSkills,
  createWorkingDirs,
  copyopensuperSkillsForPlatform,
  installopensuperHooksForPlatform,
} from '../../src/core/skills.js';
import type { Platform } from '../../src/core/platforms.js';

describe('skills', () => {
  let tmpDir: string;
  const zhSkillNames = [
    'opensuper',
    'opensuper-open',
    'opensuper-design',
    'opensuper-build',
    'opensuper-verify',
    'opensuper-archive',
    'opensuper-hotfix',
    'opensuper-tweak',
  ];
  const enSkillNames = zhSkillNames;

  beforeEach(async () => {
    tmpDir = path.join(
      os.tmpdir(),
      `opensuper-skills-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('getAssetsDir', () => {
    it('returns a path ending with assets', () => {
      const assetsDir = getAssetsDir();
      expect(path.basename(assetsDir)).toBe('assets');
    });
  });

  describe('readManifest', () => {
    it('reads and parses the manifest.json', async () => {
      const manifest = await readManifest();
      expect(manifest).toHaveProperty('version');
      expect(manifest).toHaveProperty('skills');
      expect(Array.isArray(manifest.skills)).toBe(true);
      expect(manifest.skills.length).toBeGreaterThan(0);
    });
  });

  describe('getManifestSkills', () => {
    it('returns the skills array from manifest', async () => {
      const skills = await getManifestSkills();
      expect(Array.isArray(skills)).toBe(true);
      expect(skills.length).toBeGreaterThan(0);
      expect(skills.some((s) => s.includes('opensuper/SKILL.md'))).toBe(true);
    });
  });

  describe('createWorkingDirs', () => {
    it('creates superpowers spec and plan directories', async () => {
      await createWorkingDirs(tmpDir);

      const specsDir = path.join(tmpDir, 'docs', 'superpowers', 'specs');
      const plansDir = path.join(tmpDir, 'docs', 'superpowers', 'plans');

      await expect(fs.stat(specsDir)).resolves.toBeDefined();
      await expect(fs.stat(plansDir)).resolves.toBeDefined();
    });

    it('does not throw when directories already exist', async () => {
      await createWorkingDirs(tmpDir);
      await expect(createWorkingDirs(tmpDir)).resolves.not.toThrow();
    });
  });

  describe('copyopensuperSkillsForPlatform', () => {
    const mockPlatform: Platform = {
      id: 'claude',
      name: 'Claude Code',
      skillsDir: '.claude',
      openspecToolId: 'claude',
    };

    it('copies skill files from assets to platform skills directory', async () => {
      const result = await copyopensuperSkillsForPlatform(tmpDir, mockPlatform, false);
      expect(result.copied).toBeGreaterThan(0);
      expect(result.skipped).toBe(0);

      // Verify a key file was copied
      const opensuperSkillPath = path.join(tmpDir, '.claude', 'skills', 'opensuper', 'SKILL.md');
      expect(await fileExists(opensuperSkillPath)).toBe(true);
    });

    it('skips existing files when overwrite is false', async () => {
      // First copy
      await copyopensuperSkillsForPlatform(tmpDir, mockPlatform, false);
      // Second copy should skip all
      const result = await copyopensuperSkillsForPlatform(tmpDir, mockPlatform, false);
      expect(result.copied).toBe(0);
      expect(result.skipped).toBeGreaterThan(0);
    });

    it('overwrites existing files when overwrite is true', async () => {
      await copyopensuperSkillsForPlatform(tmpDir, mockPlatform, false);
      const result = await copyopensuperSkillsForPlatform(tmpDir, mockPlatform, true);
      expect(result.copied).toBeGreaterThan(0);
    });

    it('copies to Chinese skills directory when language is zh', async () => {
      const result = await copyopensuperSkillsForPlatform(tmpDir, mockPlatform, false, 'skills-zh');
      expect(result.copied).toBeGreaterThan(0);

      const manifest = await readManifest();
      for (const skillRelPath of manifest.skills) {
        const copiedPath = path.join(tmpDir, '.claude', 'skills', skillRelPath);
        expect(await fileExists(copiedPath), `zh install should include ${skillRelPath}`).toBe(
          true,
        );
      }
    });

    it('creates OpenCode slash commands for copied opensuper skills', async () => {
      const opencodePlatform: Platform = {
        id: 'opencode',
        name: 'OpenCode',
        skillsDir: '.opencode',
        globalSkillsDir: '.config/opencode',
        openspecToolId: 'opencode',
      };

      const result = await copyopensuperSkillsForPlatform(tmpDir, opencodePlatform, false);

      expect(result.copied).toBeGreaterThan(0);
      const commandPath = path.join(tmpDir, '.opencode', 'commands', 'opensuper-open.md');
      const command = await fs.readFile(commandPath, 'utf-8');

      expect(command).toContain('description: Run the opensuper-open opensuper workflow');
      expect(command).toContain('Equivalent opensuper skill: `opensuper-open`');
      expect(command).toContain(
        'Use the invocation arguments below as the user input for this workflow:',
      );
      expect(command).toContain('$ARGUMENTS');
      expect(command).toContain('# opensuper Phase 1: Open');
      expect(command).toContain('## Steps');
      expect(command).toContain('"$opensuper_BASH" "$opensuper_STATE" init <name> full');
      expect(command).not.toContain(
        'Immediately load the `opensuper-open` skill with the skill tool',
      );
      expect(path.basename(commandPath)).toBe('opensuper-open.md');
    });

    it('creates OpenCode slash commands from the selected language skill content', async () => {
      const opencodePlatform: Platform = {
        id: 'opencode',
        name: 'OpenCode',
        skillsDir: '.opencode',
        globalSkillsDir: '.config/opencode',
        openspecToolId: 'opencode',
      };

      await copyopensuperSkillsForPlatform(tmpDir, opencodePlatform, false, 'skills-zh');

      const commandPath = path.join(tmpDir, '.opencode', 'commands', 'opensuper-open.md');
      const command = await fs.readFile(commandPath, 'utf-8');

      expect(command).toContain('description: Run the opensuper-open opensuper workflow');
      expect(command).toContain('Equivalent opensuper skill: `opensuper-open`');
      expect(command).toContain('# opensuper 阶段 1：开启（Open）');
      expect(command).toContain('## 步骤');
      expect(command).not.toContain('# opensuper Phase 1: Open');
      expect(path.basename(commandPath)).toBe('opensuper-open.md');
    });

    it('creates OpenCode slash commands in the global OpenCode config directory', async () => {
      const opencodePlatform: Platform = {
        id: 'opencode',
        name: 'OpenCode',
        skillsDir: '.opencode',
        globalSkillsDir: '.config/opencode',
        openspecToolId: 'opencode',
      };

      await copyopensuperSkillsForPlatform(tmpDir, opencodePlatform, false, 'skills', 'global');

      await expect(
        fs.access(path.join(tmpDir, '.config', 'opencode', 'commands', 'opensuper.md')),
      ).resolves.toBeUndefined();
      await expect(
        fs.access(path.join(tmpDir, '.opencode', 'commands', 'opensuper.md')),
      ).rejects.toThrow();
    });
  });

  describe('installopensuperHooksForPlatform', () => {
    const staleopensuperCommand = 'bash .legacy/skills/opensuper/scripts/opensuper-hook-guard.sh';
    const currentopensuperScript = 'opensuper/scripts/opensuper-hook-guard.sh';

    it('merges Claude-style hooks into an existing matcher group without replacing user hooks', async () => {
      const platform: Platform = {
        id: 'claude',
        name: 'Claude Code',
        skillsDir: '.claude',
        openspecToolId: 'claude',
        supportsHooks: true,
        hookFormat: 'claude-code',
      };
      const settingsPath = path.join(tmpDir, '.claude', 'settings.local.json');
      const initialSettings = {
        model: 'sonnet',
        hooks: {
          PostToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'echo post' }] }],
          PreToolUse: [
            {
              matcher: 'Write|Edit',
              hooks: [
                { type: 'command', command: 'echo user-write-check' },
                { type: 'command', command: staleopensuperCommand },
              ],
            },
            {
              matcher: 'Bash',
              hooks: [{ type: 'command', command: 'echo user-bash-check' }],
            },
          ],
        },
      };
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(initialSettings), 'utf-8');

      await installopensuperHooksForPlatform(tmpDir, platform);
      const firstInstall = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
      const writeGroup = firstInstall.hooks.PreToolUse.find(
        (entry: { matcher: string }) => entry.matcher === 'Write|Edit',
      );

      expect(firstInstall.model).toBe('sonnet');
      expect(firstInstall.hooks.PostToolUse).toEqual(initialSettings.hooks.PostToolUse);
      expect(firstInstall.hooks.PreToolUse).toHaveLength(2);
      expect(writeGroup.hooks).toEqual([
        { type: 'command', command: 'echo user-write-check' },
        {
          type: 'command',
          command: `bash .claude/skills/${currentopensuperScript}`,
        },
      ]);

      await installopensuperHooksForPlatform(tmpDir, platform);
      const secondInstall = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
      expect(secondInstall).toEqual(firstInstall);
    });

    it('does not throw when an existing hook group is malformed (non-array)', async () => {
      // Hand-edited settings may store a hook group as an object/scalar rather
      // than an array; install must coerce it instead of throwing.
      const platform: Platform = {
        id: 'claude',
        name: 'Claude Code',
        skillsDir: '.claude',
        openspecToolId: 'claude',
        supportsHooks: true,
        hookFormat: 'claude-code',
      };
      const settingsPath = path.join(tmpDir, '.claude', 'settings.local.json');
      const malformedSettings = {
        hooks: {
          PreToolUse: { matcher: 'Write|Edit', hooks: [{ type: 'command', command: 'echo x' }] },
        },
      };
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(malformedSettings), 'utf-8');

      await expect(installopensuperHooksForPlatform(tmpDir, platform)).resolves.toEqual({
        installed: true,
      });

      const updated = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
      expect(updated.hooks.PreToolUse).toHaveLength(1);
      expect(updated.hooks.PreToolUse[0].matcher).toBe('Write|Edit');
    });

    it.each([
      { id: 'qwen', skillsDir: '.qwen', hookFormat: 'qwen' as const },
      { id: 'qoder', skillsDir: '.qoder', hookFormat: 'qoder' as const },
    ])(
      'merges $id hooks into the existing matcher group idempotently',
      async ({ id, skillsDir, hookFormat }) => {
        const platform: Platform = {
          id,
          name: id,
          skillsDir,
          openspecToolId: id,
          supportsHooks: true,
          hookFormat,
        };
        const settingsPath = path.join(tmpDir, skillsDir, 'settings.json');
        const initialSettings = {
          theme: 'dark',
          hooks: {
            AfterTool: [{ matcher: '*', hooks: [{ type: 'command', command: 'echo after' }] }],
            PreToolUse: [
              {
                matcher: 'Write|Edit',
                hooks: [
                  {
                    type: 'command',
                    command: 'echo user-write-check',
                    description: 'User write check',
                  },
                  {
                    type: 'command',
                    command: staleopensuperCommand,
                    description: 'Old opensuper hook',
                  },
                ],
              },
            ],
          },
        };
        await fs.mkdir(path.dirname(settingsPath), { recursive: true });
        await fs.writeFile(settingsPath, JSON.stringify(initialSettings), 'utf-8');

        await installopensuperHooksForPlatform(tmpDir, platform);
        const firstInstall = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));

        expect(firstInstall.theme).toBe('dark');
        expect(firstInstall.hooks.AfterTool).toEqual(initialSettings.hooks.AfterTool);
        expect(firstInstall.hooks.PreToolUse).toHaveLength(1);
        expect(firstInstall.hooks.PreToolUse[0].hooks).toEqual([
          {
            type: 'command',
            command: 'echo user-write-check',
            description: 'User write check',
          },
          {
            type: 'command',
            command: `bash ${skillsDir}/skills/${currentopensuperScript}`,
            description: 'Block code writes in wrong opensuper phase (open/design/archive)',
          },
        ]);

        await installopensuperHooksForPlatform(tmpDir, platform);
        const secondInstall = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
        expect(secondInstall).toEqual(firstInstall);
      },
    );

    it('merges Gemini hooks into the existing matcher group idempotently', async () => {
      const platform: Platform = {
        id: 'gemini',
        name: 'Gemini CLI',
        skillsDir: '.gemini',
        openspecToolId: 'gemini',
        supportsHooks: true,
        hookFormat: 'gemini',
      };
      const settingsPath = path.join(tmpDir, '.gemini', 'settings.json');
      const initialSettings = {
        selectedAuthType: 'oauth',
        hooks: {
          AfterTool: [{ matcher: '*', hooks: [{ type: 'command', command: 'echo after' }] }],
          BeforeTool: [
            {
              matcher: 'write_file|edit_file',
              hooks: [
                {
                  type: 'command',
                  command: 'echo user-write-check',
                  name: 'User write check',
                },
                {
                  type: 'command',
                  command: staleopensuperCommand,
                  name: 'Old opensuper hook',
                },
              ],
            },
          ],
        },
      };
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(initialSettings), 'utf-8');

      await installopensuperHooksForPlatform(tmpDir, platform);
      const firstInstall = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));

      expect(firstInstall.selectedAuthType).toBe('oauth');
      expect(firstInstall.hooks.AfterTool).toEqual(initialSettings.hooks.AfterTool);
      expect(firstInstall.hooks.BeforeTool).toHaveLength(1);
      expect(firstInstall.hooks.BeforeTool[0].hooks).toEqual([
        {
          type: 'command',
          command: 'echo user-write-check',
          name: 'User write check',
        },
        {
          type: 'command',
          command: `bash .gemini/skills/${currentopensuperScript}`,
          name: 'Block code writes in wrong opensuper phase (open/design/archive)',
        },
      ]);

      await installopensuperHooksForPlatform(tmpDir, platform);
      const secondInstall = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
      expect(secondInstall).toEqual(firstInstall);
    });

    it('replaces only managed Windsurf hooks and preserves user hooks idempotently', async () => {
      const platform: Platform = {
        id: 'windsurf',
        name: 'Windsurf',
        skillsDir: '.windsurf',
        openspecToolId: 'windsurf',
        supportsHooks: true,
        hookFormat: 'windsurf',
      };
      const hooksPath = path.join(tmpDir, '.windsurf', 'hooks.json');
      const initialHooks = {
        enabled: true,
        hooks: {
          post_write_code: [{ command: 'echo post', show_output: false }],
          pre_write_code: [
            { command: 'echo user-write-check', show_output: false },
            { command: staleopensuperCommand, show_output: true },
          ],
        },
      };
      await fs.mkdir(path.dirname(hooksPath), { recursive: true });
      await fs.writeFile(hooksPath, JSON.stringify(initialHooks), 'utf-8');

      await installopensuperHooksForPlatform(tmpDir, platform);
      const firstInstall = JSON.parse(await fs.readFile(hooksPath, 'utf-8'));

      expect(firstInstall.enabled).toBe(true);
      expect(firstInstall.hooks.post_write_code).toEqual(initialHooks.hooks.post_write_code);
      expect(firstInstall.hooks.pre_write_code).toEqual([
        { command: 'echo user-write-check', show_output: false },
        {
          command: `bash .windsurf/skills/${currentopensuperScript}`,
          show_output: true,
        },
      ]);

      await installopensuperHooksForPlatform(tmpDir, platform);
      const secondInstall = JSON.parse(await fs.readFile(hooksPath, 'utf-8'));
      expect(secondInstall).toEqual(firstInstall);
    });
  });

  describe('Chinese opensuper workflow safeguards', () => {
    it('requires OpenSpec instructions for each standard open artifact', async () => {
      const zhOpen = await fs.readFile(
        path.resolve('assets', 'skills-zh', 'opensuper-open', 'SKILL.md'),
        'utf-8',
      );

      expect(zhOpen).toContain('openspec instructions proposal --change "<name>" --json');
      expect(zhOpen).toContain('openspec instructions design --change "<name>" --json');
      expect(zhOpen).toContain('openspec instructions tasks --change "<name>" --json');
      for (const field of [
        '`context`',
        '`rules`',
        '`template`',
        '`instruction`',
        '`resolvedOutputPath`',
        '`dependencies`',
      ]) {
        expect(zhOpen).toContain(field);
      }
      expect(zhOpen).toContain('不得复制到 artifact 内容中');
      expect(zhOpen).toContain('每创建一个 artifact 后');
      expect(zhOpen).toContain('openspec status --change "<name>" --json');
      expect(zhOpen).toContain('必须立即停止 artifact 创建');
      expect(zhOpen).toContain('不得回退为硬编码文档结构');
    });

    it('requires OpenSpec instructions for each standard open artifact (English)', async () => {
      const enOpen = await fs.readFile(
        path.resolve('assets', 'skills', 'opensuper-open', 'SKILL.md'),
        'utf-8',
      );

      expect(enOpen).toContain('openspec instructions proposal --change "<name>" --json');
      expect(enOpen).toContain('openspec instructions design --change "<name>" --json');
      expect(enOpen).toContain('openspec instructions tasks --change "<name>" --json');
      for (const field of [
        '`context`',
        '`rules`',
        '`template`',
        '`instruction`',
        '`resolvedOutputPath`',
        '`dependencies`',
      ]) {
        expect(enOpen).toContain(field);
      }
      expect(enOpen).toContain('must not copy them into the artifact content');
      expect(enOpen).toContain('After creating each artifact');
      expect(enOpen).toContain('openspec status --change "<name>" --json');
      expect(enOpen).toContain('must immediately stop artifact creation');
      expect(enOpen).toContain('Must not fall back to hard-coded artifact prose');
    });

    it('requires explicit user confirmation at full-workflow decision points', async () => {
      const zhopensuper = await fs.readFile(
        path.resolve('assets', 'skills-zh', 'opensuper', 'SKILL.md'),
        'utf-8',
      );
      const zhOpen = await fs.readFile(
        path.resolve('assets', 'skills-zh', 'opensuper-open', 'SKILL.md'),
        'utf-8',
      );
      const zhDesign = await fs.readFile(
        path.resolve('assets', 'skills-zh', 'opensuper-design', 'SKILL.md'),
        'utf-8',
      );
      const zhBuild = await fs.readFile(
        path.resolve('assets', 'skills-zh', 'opensuper-build', 'SKILL.md'),
        'utf-8',
      );
      const zhVerify = await fs.readFile(
        path.resolve('assets', 'skills-zh', 'opensuper-verify', 'SKILL.md'),
        'utf-8',
      );
      const zhArchive = await fs.readFile(
        path.resolve('assets', 'skills-zh', 'opensuper-archive', 'SKILL.md'),
        'utf-8',
      );
      const zhHotfix = await fs.readFile(
        path.resolve('assets', 'skills-zh', 'opensuper-hotfix', 'SKILL.md'),
        'utf-8',
      );
      const zhTweak = await fs.readFile(
        path.resolve('assets', 'skills-zh', 'opensuper-tweak', 'SKILL.md'),
        'utf-8',
      );
      const zhopensuperRule = await fs.readFile(
        path.resolve('assets', 'skills', 'opensuper', 'rules', 'opensuper-phase-guard.md'),
        'utf-8',
      );
      const zhDecisionPoint = await fs.readFile(
        path.resolve('assets', 'skills-zh', 'opensuper', 'reference', 'decision-point.md'),
        'utf-8',
      );
      const zhDebugGate = await fs.readFile(
        path.resolve('assets', 'skills-zh', 'opensuper', 'reference', 'debug-gate.md'),
        'utf-8',
      );

      expect(zhopensuper).toContain('决策点是阻塞点');
      expect(zhopensuper).toContain('`opensuper/reference/decision-point.md`');
      expect(zhDecisionPoint).toContain(
        '若当前平台没有结构化提问工具，则必须在对话中提出明确选项并停止流程',
      );
      expect(zhDecisionPoint).toContain('不得用推荐规则、默认值、历史偏好');
      expect(zhOpen).toContain('### 1b. 需求澄清完成确认（阻塞点）');
      expect(zhOpen).toContain(
        '不得在用户确认需求澄清完成前创建 proposal.md、design.md 或 tasks.md',
      );
      expect(zhOpen).toContain('`opensuper/reference/decision-point.md`');
      expect(zhOpen).toContain(
        '完整 `/opensuper` 流程默认不得使用 Skill 工具加载 `openspec-propose` 技能',
      );
      expect(zhOpen).toContain(
        '技能加载后，按其指引创建 change 骨架，但当 Step 1b 的已确认澄清摘要已存在于对话上下文时',
      );
      expect(zhOpen).not.toContain('OpenSpec artifact 指令');
      expect(zhOpen).not.toContain('fast-forward');
      expect(zhOpen).toContain(
        '澄清摘要必须包含：目标、非目标、范围边界、关键未知项、验收场景草案',
      );
      expect(zhDesign).toContain(
        '**立即执行：** 使用 Skill 工具加载 Superpowers `brainstorming` 技能。禁止跳过此步骤。',
      );
      expect(zhDesign).toContain('技能加载后，按其指引使用以下上下文');
      expect(zhDesign).not.toContain('ARGUMENTS 包含');
      expect(zhDesign).toContain(
        '必须按 `opensuper/reference/decision-point.md` 的协议暂停并等待用户明确确认设计方案',
      );
      expect(zhDesign).toContain(
        '不得用“跳过重复上下文探索”削弱 Superpowers `brainstorming` 的澄清流程',
      );
      expect(zhDesign).not.toContain('跳过重复上下文探索，直接进入设计提问');
      expect(zhBuild).toContain('不得根据推荐规则自行选择 `branch` 或 `worktree`');
      expect(zhBuild).toContain('不得根据推荐规则自行选择执行方式');
      expect(zhBuild).toContain('`opensuper/reference/decision-point.md`');
      expect(zhVerify).toContain(
        '验证不通过时**必须按 `opensuper/reference/decision-point.md` 的协议暂停并等待用户决定修复或接受偏差',
      );
      expect(zhVerify).toContain(
        '必须按 `opensuper/reference/decision-point.md` 的协议暂停并等待用户选择分支处理方式',
      );
      expect(zhVerify).toContain(
        '只有在用户完成选择且对应操作完成后，才允许写入 `branch_status: handled`',
      );
      expect(zhArchive).toContain('### 1. 归档前最终确认（阻塞点）');
      expect(zhArchive).toContain(
        '不得在用户确认前运行 `"$opensuper_BASH" "$opensuper_ARCHIVE" "<change-name>"`',
      );
      expect(zhArchive).toContain('`opensuper/reference/decision-point.md`');
      expect(zhArchive).toContain('「确认归档」');
      expect(zhArchive).toContain('「需要调整或重新验证」');
      expect(zhArchive).toContain('「暂不归档」');
      expect(zhArchive).toContain(
        '`"$opensuper_BASH" "$opensuper_STATE" transition <change-name> archive-reopen`',
      );
      expect(zhVerify).toContain('不得因为验证已通过就自动归档');
      expect(zhHotfix).toContain(
        '满足升级条件时**必须按 `opensuper/reference/decision-point.md` 的协议暂停并等待用户明确确认**升级为完整 `/opensuper` 流程',
      );
      expect(zhHotfix).toContain('不得直接进入 `/opensuper-design`');
      expect(zhTweak).toContain(
        '满足升级条件时**必须按 `opensuper/reference/decision-point.md` 的协议暂停并等待用户明确确认**升级为完整 `/opensuper` 流程',
      );
      expect(zhTweak).toContain('不得直接进入 `/opensuper-design`');
      expect(zhopensuper).toContain('`verify_result: fail` → 进入验证失败决策阻塞点');
      expect(zhopensuper).not.toContain(
        '`verify_result: fail` → `"$opensuper_BASH" "$opensuper_STATE" transition <name> verify-fail` 后 `/opensuper-build`',
      );
      expect(zhHotfix).toContain('按升级条件阻塞确认处理');
      expect(zhHotfix).not.toContain('停止 hotfix，升级为 `/opensuper`');
      expect(zhTweak).toContain('按升级条件阻塞确认处理');

      // HIGH: hotfix/tweak IMPORTANT blocks must acknowledge verify decision points
      expect(zhHotfix).toContain('验证阶段（opensuper-verify）的验证失败决策和分支处理决策');
      expect(zhTweak).toContain('验证阶段（opensuper-verify）的验证失败决策和分支处理决策');
      expect(zhHotfix).toContain('归档前最终确认');
      expect(zhTweak).toContain('归档前最终确认');

      // MEDIUM: opensuper-design brainstorming does not write Design Doc before confirmation
      expect(zhDesign).toContain('brainstorming 阶段不写入 Design Doc 文件');
      expect(zhDesign).toContain('增量更新 `brainstorm-summary.md`');
      expect(zhDesign).toContain('### 1e. 主动上下文压缩门');

      // MEDIUM: opensuper-verify Spec drift requires user choice
      expect(zhVerify).toContain(
        '必须使用当前平台可用的用户输入/确认机制以单选题形式暂停并等待用户选择处理方式',
      );

      // MEDIUM: opensuper/SKILL.md build phase resume recognizes plan-ready pause before build decisions
      expect(zhopensuper).toContain('先检查 `build_pause`、`plan`、`build_mode` 和 `isolation`');
      expect(zhopensuper).toContain('`build_pause: plan-ready` 且 plan 文件存在');
      expect(zhopensuper).toContain('`build_pause` 不是执行方式，不得写入 `build_mode`');
      expect(zhopensuper).toContain(
        '若 `build_pause: plan-ready` 但 `isolation` 和 `build_mode` 已经设置，则视为 stale pause',
      );
      expect(zhBuild).toContain('提供 plan-ready 暂停点');
      expect(zhBuild).toContain('不得自动继续，也不得把暂停写入 `build_mode`');
      expect(zhBuild).toContain('`build_mode` 为 `executing-plans`');
      expect(zhBuild).toContain(
        '必须使用 Skill 工具加载 Superpowers `requesting-code-review` 技能',
      );
      expect(zhBuild).toContain('至少请求一次代码审查');
      expect(zhBuild).toContain('build → verify');
      expect(zhBuild).toContain(
        'CRITICAL review 发现（安全漏洞、数据丢失风险、构建/测试失败）必须先修复',
      );

      // MEDIUM: opensuper-verify Step 1b treats CRITICAL/IMPORTANT as blocking
      expect(zhVerify).toContain('CRITICAL 或 IMPORTANT 失败项必须修复');
      expect(zhVerify).toContain('不允许跳过修复直接全部接受');
      expect(zhVerify).toContain('简化代码审查');
      expect(zhVerify).toContain(
        '必须使用 Skill 工具加载 Superpowers `requesting-code-review` 技能',
      );
      expect(zhVerify).toContain('只检查正确性、安全、边界条件');
      expect(zhVerify).toContain('无 CRITICAL 或 IMPORTANT 问题');
      expect(zhVerify).toContain('不影响正确性、安全、边界条件的 code pattern consistency 建议');
      expect(zhVerify).toContain('不执行 spec 覆盖率、Design Doc 一致性或漂移检查');
      expect(zhHotfix).toContain('6 项快速检查，包含简化代码审查');

      // MEDIUM: hotfix IMPORTANT covers >3-tasks opensuper-build decision points
      expect(zhHotfix).toContain(
        '任务超过 3 个转入 `/opensuper-build` 时的工作区隔离和执行方式选择',
      );

      // LOW: opensuper-build "中" level requires user confirmation before brainstorming
      expect(zhBuild).toContain(
        '使用当前平台可用的用户输入/确认机制暂停并等待用户确认后**，必须使用 Skill 工具加载 Superpowers `brainstorming`',
      );

      // LOW: opensuper-build 50% threshold is a hard decision point
      expect(zhBuild).toContain(
        '必须按 `opensuper/reference/decision-point.md` 的协议暂停并等待用户决定是否拆分为新 change',
      );

      // LOW: opensuper-verify Step 2b disambiguates design.md vs Design Doc
      expect(zhVerify).toContain('实现符合 `openspec/changes/<name>/design.md` 高层设计决策');
      expect(zhTweak).not.toContain('停止 tweak，升级为完整 `/opensuper`');

      // CRITICAL: build scope split must not bypass opensuper state initialization
      expect(zhBuild).toContain('通过 `/opensuper-open` 创建独立 change');
      expect(zhBuild).not.toContain('`/opsx:new` 创建独立 change');

      // CRITICAL: open phase PRD split must happen before OpenSpec artifacts are created
      expect(zhOpen).toContain('### 1a. PRD 拆分预检（阻塞点）');
      expect(zhOpen).toContain('创建多个 OpenSpec changes');
      expect(zhOpen).toContain('保持为一个 change');
      expect(zhOpen).toContain('调整拆分方案后继续');
      expect(zhOpen).toContain('每个被接受的拆分项都必须通过 `/opensuper-open` 创建独立 change');
      expect(zhOpen).not.toContain('每个被接受的拆分项都必须通过 `/opsx:new` 创建独立 change');
      expect(zhOpen).toContain('已确认拆分项');
      expect(zhOpen).toContain('跳过 PRD 拆分预检');
      expect(zhOpen).toContain(
        '批量拆分模式下，单个拆分项完成 open 阶段后不得自动流转到 `/opensuper-design`',
      );
      expect(zhOpen).toContain('拆分完毕后必须暂停询问用户开始哪一个 change');
      expect(zhOpen).toContain('恢复时先检查已创建的 active changes');

      // IMPORTANT: main entry and build subskill agree scope expansion is blocking
      expect(zhopensuper).toContain('build 阶段范围扩张需重新设计或拆分新 change');
      expect(zhopensuper).toContain('archive 阶段执行归档脚本前的最终确认');
      expect(zhopensuper).toContain('open 阶段大型 PRD 需确认拆分为多个 change');

      // IMPORTANT: accepted Spec drift edits must not loop back through dirty-worktree handling
      expect(zhVerify).toContain('选项 A 属于 verify 阶段允许产物');

      // Dependency triggers must be explicit skill invocations, not ambiguous prose.
      expect(zhBuild).toContain('必须使用 Skill 工具加载 Superpowers `using-git-worktrees`');
      expect(zhBuild).not.toContain('或使用原生 `EnterWorktree` 工具');
      expect(zhBuild).toContain('必须使用 Skill 工具加载 Superpowers `brainstorming`');
      expect(zhopensuper).toContain(
        '若 `build_mode: subagent-driven-development`，不得在主窗口直接执行任务',
      );
      expect(zhBuild).toContain('主会话只负责协调，禁止直接编写实现代码');
      expect(zhBuild).toContain('如果当前平台没有真实后台 agent 调度能力');
      expect(zhBuild).toContain(
        '先确认当前平台存在可调用的真实后台 subagent / Task / multi-agent 调度能力',
      );
      expect(zhBuild).toContain(
        '`"$opensuper_BASH" "$opensuper_STATE" set <name> subagent_dispatch confirmed`',
      );
      expect(zhBuild).toContain(
        '用户选择改用主窗口执行后，必须先运行 `"$opensuper_BASH" "$opensuper_STATE" set <name> build_mode executing-plans`',
      );
      expect(zhBuild).not.toContain('使用 Skill 工具加载对应技能');
      expect(zhBuild).toContain('tdd_mode');
      expect(zhBuild).toContain(
        '`"$opensuper_BASH" "$opensuper_STATE" set <name> tdd_mode <tdd|direct>`',
      );
      expect(zhBuild).toContain('若 `tdd_mode: tdd`');
      expect(zhBuild).toContain(
        'TDD 约束和证据门槛已在 `opensuper/reference/subagent-dispatch.md` 中定义',
      );
      expect(zhopensuper).toContain('`tdd_mode`');
      expect(zhopensuper).toContain('full workflow 离开 build 阶段前 `tdd_mode` 必须已选择');
      expect(zhHotfix).toContain('立即使用 Skill 工具加载 `opensuper-design` skill');
      expect(zhTweak).toContain('立即使用 Skill 工具加载 `opensuper-design` skill');
      expect(zhVerify).toContain(
        '用户选择 B 后，运行 `"$opensuper_BASH" "$opensuper_STATE" transition <change-name> verify-fail`，然后调用 `/opensuper-build`',
      );

      // CRITICAL: implementation-time crashes must enter systematic debugging and keep tests in the current change.
      expect(zhBuild).toContain('必须使用 Skill 工具加载 Superpowers `systematic-debugging` 技能');
      expect(zhBuild).toContain('`opensuper/reference/debug-gate.md`');
      expect(zhBuild).toContain(
        '运行程序、测试、构建或手动验证时出现崩溃、异常行为、测试失败或构建失败',
      );
      expect(zhHotfix).toContain('必须使用 Skill 工具加载 Superpowers `systematic-debugging` 技能');
      expect(zhHotfix).toContain('`opensuper/reference/debug-gate.md`');
      expect(zhTweak).toContain('`opensuper/reference/debug-gate.md`');
      expect(zhDebugGate).toContain('先补充能复现该崩溃/异常的最小失败测试');
      expect(zhDebugGate).toContain(
        '不得通过另起一个“写测试用例”的 change 来替代当前 change 的验证闭环',
      );

      // CRITICAL: user-confirmation gates must not hardcode a platform-specific tool name.
      expect(
        [zhopensuper, zhDesign, zhBuild, zhVerify, zhArchive, zhHotfix, zhTweak].join('\n'),
      ).not.toContain('AskUserQuestion');
      expect(zhopensuper).toContain('`auto_transition`');
      expect(zhopensuper).toContain('不影响 phase 推进');
      expect(zhopensuperRule).toContain(
        'brainstorming in progress: incrementally update brainstorm-summary.md',
      );
      expect(zhopensuperRule).toContain('active compaction gate');
      expect(zhopensuperRule).toContain(
        '使用 Skill 工具重新加载 Superpowers `subagent-driven-development` 技能',
      );
      expect(zhopensuperRule).toContain(
        '读取 `opensuper/reference/subagent-dispatch.md` 获取 opensuper 专属扩展',
      );
      expect(zhopensuperRule).toContain('禁止在主会话中直接执行 task');
      for (const [content] of [
        [zhOpen, '/opensuper-design'],
        [zhDesign, '/opensuper-build'],
        [zhBuild, '/opensuper-verify'],
        [zhVerify, '/opensuper-archive'],
      ] as const) {
        expect(content).toContain('自动衔接下一阶段');
        expect(content).toContain('"$opensuper_BASH" "$opensuper_STATE" next <change-name>');
        expect(content).toContain('`NEXT: auto`');
        expect(content).toContain('`NEXT: manual`');
        expect(content).toContain('按 `HINT`');
      }
      expect(zhHotfix).toContain('自动衔接下一阶段');
      expect(zhHotfix).toContain('"$opensuper_BASH" "$opensuper_STATE" next <name>');
      expect(zhHotfix).toContain('`NEXT: auto`');
      expect(zhHotfix).toContain(
        '`phase: build` 返回 `opensuper-hotfix`，`verify` 返回 `opensuper-verify`，`archive` 返回 `opensuper-archive`',
      );
      expect(zhTweak).toContain('自动衔接下一阶段');
      expect(zhTweak).toContain('"$opensuper_BASH" "$opensuper_STATE" next <name>');
      expect(zhTweak).toContain('`NEXT: auto`');
      expect(zhTweak).toContain(
        '`phase: build` 返回 `opensuper-tweak`，`verify` 返回 `opensuper-verify`，`archive` 返回 `opensuper-archive`',
      );
    });
  });

  describe('English opensuper workflow safeguards', () => {
    it('matches the Chinese workflow decision-point requirements', async () => {
      const enopensuper = await fs.readFile(
        path.resolve('assets', 'skills', 'opensuper', 'SKILL.md'),
        'utf-8',
      );
      const enOpen = await fs.readFile(
        path.resolve('assets', 'skills', 'opensuper-open', 'SKILL.md'),
        'utf-8',
      );
      const enDesign = await fs.readFile(
        path.resolve('assets', 'skills', 'opensuper-design', 'SKILL.md'),
        'utf-8',
      );
      const enBuild = await fs.readFile(
        path.resolve('assets', 'skills', 'opensuper-build', 'SKILL.md'),
        'utf-8',
      );
      const enVerify = await fs.readFile(
        path.resolve('assets', 'skills', 'opensuper-verify', 'SKILL.md'),
        'utf-8',
      );
      const enArchive = await fs.readFile(
        path.resolve('assets', 'skills', 'opensuper-archive', 'SKILL.md'),
        'utf-8',
      );
      const enHotfix = await fs.readFile(
        path.resolve('assets', 'skills', 'opensuper-hotfix', 'SKILL.md'),
        'utf-8',
      );
      const enTweak = await fs.readFile(
        path.resolve('assets', 'skills', 'opensuper-tweak', 'SKILL.md'),
        'utf-8',
      );
      const enopensuperRule = await fs.readFile(
        path.resolve('assets', 'skills', 'opensuper', 'rules', 'opensuper-phase-guard.md'),
        'utf-8',
      );
      const enDecisionPoint = await fs.readFile(
        path.resolve('assets', 'skills', 'opensuper', 'reference', 'decision-point.md'),
        'utf-8',
      );
      const enDebugGate = await fs.readFile(
        path.resolve('assets', 'skills', 'opensuper', 'reference', 'debug-gate.md'),
        'utf-8',
      );

      expect(enopensuper).toContain('Decision points are blocking points');
      expect(enDecisionPoint).toContain(
        'If the current platform has no structured question tool, ask clear options in the conversation and stop until the user replies',
      );
      expect(enDecisionPoint).toContain(
        'Never substitute recommendation rules, defaults, historical preferences',
      );
      expect(enOpen).toContain(
        '### 1b. Requirements Clarification Completion Confirmation (Blocking Point)',
      );
      expect(enOpen).toContain(
        'Must not create proposal.md, design.md, or tasks.md before the user confirms requirements clarification is complete',
      );
      expect(enOpen).toContain(
        'Full `/opensuper` workflow must not use the Skill tool to load the `openspec-propose` skill',
      );
      expect(enOpen).toContain('`opensuper/reference/decision-point.md`');
      expect(enOpen).toContain(
        'After the skill loads, follow its guidance to create the change skeleton, but override its "STOP and wait for user direction" behavior when a confirmed clarification summary from Step 1b is already available in the conversation context',
      );
      expect(enOpen).toContain(
        'The clarification summary must include: goals, non-goals, scope boundaries, key unknowns, and draft acceptance scenarios',
      );
      expect(enDesign).toContain(
        '**Immediately execute:** Use the Skill tool to load the Superpowers `brainstorming` skill. Skipping this step is prohibited.',
      );
      expect(enDesign).toContain(
        'After the skill loads, follow its guidance and use the following context',
      );
      expect(enDesign).not.toContain('ARGUMENTS containing');
      expect(enDesign).toContain(
        'must follow the `opensuper/reference/decision-point.md` protocol to pause and wait for the user to explicitly confirm',
      );
      expect(enDesign).toContain(
        'must not weaken the Superpowers `brainstorming` clarification flow by "skipping redundant context exploration"',
      );
      expect(enDesign).not.toContain('Skip redundant context exploration');
      expect(enBuild).toContain(
        'Must not choose `branch` or `worktree` based on recommendation rules',
      );
      expect(enBuild).toContain(
        'must not choose the execution method or TDD mode based on recommendation rules',
      );
      expect(enBuild).toContain('`opensuper/reference/decision-point.md`');
      expect(enVerify).toContain(
        'must follow the `opensuper/reference/decision-point.md` protocol to pause and wait for the user to decide whether to fix or accept the deviation',
      );
      expect(enVerify).toContain(
        'Must follow the `opensuper/reference/decision-point.md` protocol to pause and wait for the user to choose branch handling method',
      );
      expect(enVerify).toContain(
        'Only after the user completes selection and the corresponding operation finishes, may `branch_status: handled` be written',
      );
      expect(enArchive).toContain('### 1. Final Archive Confirmation (Blocking Point)');
      expect(enArchive).toContain(
        'Must not run `"$opensuper_BASH" "$opensuper_ARCHIVE" "<change-name>"` before user confirmation',
      );
      expect(enArchive).toContain('`opensuper/reference/decision-point.md`');
      expect(enArchive).toContain('Confirm archive');
      expect(enArchive).toContain('Needs adjustment or re-verification');
      expect(enArchive).toContain('Do not archive yet');
      expect(enArchive).toContain(
        '`"$opensuper_BASH" "$opensuper_STATE" transition <change-name> archive-reopen`',
      );
      expect(enVerify).toContain('Must not automatically archive just because verification passed');
      expect(enHotfix).toContain(
        'must follow the `opensuper/reference/decision-point.md` protocol to pause and wait for the user to explicitly confirm',
      );
      expect(enHotfix).toContain('Do not directly enter `/opensuper-design`');
      expect(enTweak).toContain(
        'must follow the `opensuper/reference/decision-point.md` protocol to pause and wait for the user to explicitly confirm',
      );
      expect(enTweak).toContain('Do not directly enter `/opensuper-design`');
      expect(enTweak).toContain('`opensuper/reference/debug-gate.md`');
      expect(enopensuper).toContain(
        '`verify_result: fail` → Enter verification failure decision blocking point',
      );
      expect(enopensuper).not.toContain(
        '`verify_result: fail` → `"$opensuper_BASH" "$opensuper_STATE" transition <name> verify-fail` then `/opensuper-build`',
      );

      expect(enHotfix).toContain('handle per "Upgrade Conditions" section');
      expect(enTweak).toContain('handle per upgrade conditions blocking confirmation');
      expect(enHotfix).toContain(
        'verify phase (opensuper-verify) verification-failure and branch-handling decisions',
      );
      expect(enTweak).toContain(
        'verify phase (opensuper-verify) verification-failure and branch-handling decisions',
      );
      expect(enHotfix).toContain('Final archive confirmation');
      expect(enTweak).toContain('Final archive confirmation');
      expect(enDesign).toContain('The brainstorming phase does not write to the Design Doc file');
      expect(enVerify).toContain(
        "must use the current platform's available user input/confirmation mechanism as a single-select question to pause and wait for the user to choose the handling method",
      );
      expect(enopensuper).toContain(
        'first check `build_pause`, `plan`, `build_mode`, and `isolation`',
      );
      expect(enopensuper).toContain('`build_pause: plan-ready` and the plan file exists');
      expect(enopensuper).toContain(
        '`build_pause` is not an execution method and must not be written to `build_mode`',
      );
      expect(enBuild).toContain('Provide Plan-Ready Pause Point');
      expect(enBuild).toContain(
        'Must not auto-continue and must not write the pause into `build_mode`',
      );
      expect(enBuild).toContain('`build_mode` is `executing-plans`');
      expect(enBuild).toContain(
        'use the Skill tool to load the Superpowers `requesting-code-review` skill',
      );
      expect(enBuild).toContain('request code review at least once');
      expect(enBuild).toContain('build → verify');
      expect(enBuild).toContain(
        'CRITICAL review findings (security vulnerabilities, data loss risk, build/test failures) must be fixed',
      );
      expect(enVerify).toContain('CRITICAL or IMPORTANT failures must be fixed');
      expect(enVerify).toContain('skipping fix to accept all is not allowed');
      expect(enVerify).toContain('Lightweight code review');
      expect(enVerify).toContain(
        'use the Skill tool to load the Superpowers `requesting-code-review` skill',
      );
      expect(enVerify).toContain('checks only correctness, security, and edge cases');
      expect(enVerify).toContain('no CRITICAL or IMPORTANT issues');
      expect(enVerify).toContain(
        'does not perform spec coverage, Design Doc consistency, or drift checks',
      );
      expect(enHotfix).toContain('6 quick checks, including lightweight code review');
      expect(enHotfix).toContain(
        'workspace isolation and execution-method selection when tasks exceed 3 and transfer to `/opensuper-build`',
      );
      expect(enBuild).toContain(
        'Must follow the `opensuper/reference/decision-point.md` protocol to pause and wait for the user to explicitly choose',
      );
      expect(enBuild).toContain(
        'must follow the `opensuper/reference/decision-point.md` protocol to pause and wait for the user to decide whether to split into a new change',
      );
      expect(enVerify).toContain(
        'Implementation matches `openspec/changes/<name>/design.md` high-level design decisions',
      );
      expect(enBuild).toContain('create independent change through `/opensuper-open`');
      expect(enBuild).not.toContain('create independent change through `/opsx:new`');
      expect(enOpen).toContain('### 1a. PRD Split Preflight (Blocking Point)');
      expect(enOpen).toContain('Create multiple OpenSpec changes');
      expect(enOpen).toContain('Keep everything as one change');
      expect(enOpen).toContain('Adjust the split plan before continuing');
      expect(enOpen).toContain(
        'Every accepted split item must be created as an independent change through `/opensuper-open`',
      );
      expect(enOpen).not.toContain(
        'Every accepted split item must be created as an independent change through `/opsx:new`',
      );
      expect(enOpen).toContain('confirmed split item');
      expect(enOpen).toContain('skip the PRD split preflight');
      expect(enOpen).toContain(
        'In batch split mode, a single split item must not auto-advance to `/opensuper-design` after completing the open phase',
      );
      expect(enOpen).toContain(
        'After splitting is complete, must pause and ask the user which change to start',
      );
      expect(enOpen).toContain('On resume, first check already-created active changes');
      expect(enopensuper).toContain(
        'Build phase scope expansion requiring redesign or new change split',
      );
      expect(enopensuper).toContain(
        'Archive phase final confirmation before running the archive script',
      );
      expect(enopensuper).toContain(
        'Open phase large PRD requiring confirmation to split into multiple changes',
      );
      expect(enVerify).toContain('Option A is a verify phase allowed artifact');
      expect(enBuild).toContain(
        'Must use the Skill tool to load the Superpowers `using-git-worktrees`',
      );
      expect(enBuild).not.toContain('native `EnterWorktree` tool');
      expect(enBuild).toContain(
        'must use Skill tool to load the Superpowers `brainstorming` skill',
      );
      expect(enDesign).toContain(
        'The script reads the change `.opensuper.yaml` `context_compression` snapshot',
      );
      expect(enDesign).toContain('Default `context_compression: off` generates');
      expect(enDesign).toContain('If context_compression is beta, use:');
      expect(enDesign).toContain('openspec/changes/<name>/.opensuper/handoff/spec-context.md');
      expect(enDesign).toContain('In beta mode, `spec-context.json` must be structurally valid');
      expect(enDesign).toContain('incrementally update `brainstorm-summary.md`');
      expect(enDesign).toContain('### 1e. Active Context Compaction Gate');
      expect(enHotfix).toContain(
        'Immediately use the Skill tool to load the `opensuper-design` skill',
      );
      expect(enTweak).toContain(
        'Immediately use the Skill tool to load the `opensuper-design` skill',
      );
      expect(enVerify).toContain(
        'After user selects B, run `"$opensuper_BASH" "$opensuper_STATE" transition <change-name> verify-fail`, then invoke `/opensuper-build`',
      );

      expect(enBuild).toContain(
        'must use the Skill tool to load the Superpowers `systematic-debugging` skill',
      );
      expect(enBuild).toContain('`opensuper/reference/debug-gate.md`');
      expect(enBuild).toContain(
        'a crash, unexpected behavior, test failure, or build failure appears while running the program, tests, build, or manual verification',
      );
      expect(enDebugGate).toContain(
        'first add a minimal failing test that reproduces the crash or unexpected behavior',
      );
      expect(enHotfix).toContain(
        'must use the Skill tool to load the Superpowers `systematic-debugging` skill',
      );
      expect(enHotfix).toContain('`opensuper/reference/debug-gate.md`');
      expect(enDebugGate).toContain(
        'do not replace the current change verification loop by starting a separate “write test cases” change',
      );

      expect(
        [enopensuper, enOpen, enDesign, enBuild, enVerify, enArchive, enHotfix, enTweak].join('\n'),
      ).not.toContain('AskUserQuestion');
      expect(enopensuper).toContain('`opensuper/reference/decision-point.md`');
      expect(enopensuper).toContain('`auto_transition`');
      expect(enopensuper).toContain('does not block phase updates');
      expect(enopensuperRule).toContain(
        'brainstorming in progress: incrementally update brainstorm-summary.md',
      );
      expect(enopensuperRule).toContain('active compaction gate');
      expect(enopensuperRule).toContain(
        'Use the Skill tool to reload the Superpowers `subagent-driven-development` skill',
      );
      expect(enopensuperRule).toContain(
        're-read `opensuper/reference/subagent-dispatch.md` for opensuper-specific extensions',
      );
      expect(enopensuperRule).toContain(
        'Do not execute the pending task directly in the main window',
      );
      for (const [content] of [
        [enOpen, '/opensuper-design'],
        [enDesign, '/opensuper-build'],
        [enBuild, '/opensuper-verify'],
        [enVerify, '/opensuper-archive'],
      ] as const) {
        expect(content).toContain('Automatic Handoff to Next Phase');
        expect(content).toContain('"$opensuper_BASH" "$opensuper_STATE" next <change-name>');
        expect(content).toContain('`NEXT: auto`');
        expect(content).toContain('`NEXT: manual`');
        expect(content).toContain('run `/<SKILL>` manually');
      }
      expect(enHotfix).toContain('Automatic Handoff to Next Phase');
      expect(enHotfix).toContain('"$opensuper_BASH" "$opensuper_STATE" next <name>');
      expect(enHotfix).toContain('`NEXT: auto`');
      expect(enHotfix).toContain(
        '`phase: build` returns `opensuper-hotfix`, `verify` returns `opensuper-verify`, `archive` returns `opensuper-archive`',
      );
      expect(enTweak).toContain('Automatic Handoff to Next Phase');
      expect(enTweak).toContain('"$opensuper_BASH" "$opensuper_STATE" next <name>');
      expect(enTweak).toContain('`NEXT: auto`');
      expect(enTweak).toContain(
        '`phase: build` returns `opensuper-tweak`, `verify` returns `opensuper-verify`, `archive` returns `opensuper-archive`',
      );
    });
  });

  describe('opensuper output language safeguards', () => {
    it('requires OpenSpec and Superpowers outputs to follow the user request language', async () => {
      const skillNames = [
        'opensuper',
        'opensuper-open',
        'opensuper-design',
        'opensuper-build',
        'opensuper-verify',
        'opensuper-archive',
        'opensuper-hotfix',
        'opensuper-tweak',
      ] as const;

      const readSkills = async (languageDir: 'skills' | 'skills-zh') =>
        Object.fromEntries(
          await Promise.all(
            skillNames.map(async (skillName) => [
              skillName,
              await fs.readFile(
                path.resolve('assets', languageDir, skillName, 'SKILL.md'),
                'utf-8',
              ),
            ]),
          ),
        ) as Record<(typeof skillNames)[number], string>;

      const zhSkills = await readSkills('skills-zh');
      const enSkills = await readSkills('skills');

      expect(zhSkills.opensuper).toContain('输出语言规则');
      expect(zhSkills.opensuper).toContain('以触发本次工作流的用户请求语言作为默认输出语言');
      expect(zhSkills['opensuper-open']).toContain(
        '传递给 OpenSpec 的所有提问和产物要求都必须包含输出语言约束',
      );
      expect(zhSkills['opensuper-design']).toContain(
        'Language: 使用触发本次工作流的用户请求语言输出',
      );
      expect(zhSkills['opensuper-build']).toContain(
        '计划文件和执行反馈必须使用触发本次工作流的用户请求语言',
      );
      expect(zhSkills['opensuper-build']).toContain(
        'ARGUMENTS 必须包含与 Step 1 相同的 Language 约束',
      );
      expect(zhSkills['opensuper-verify']).toContain(
        '验证报告和分支处理说明必须使用触发本次工作流的用户请求语言',
      );
      expect(zhSkills['opensuper-archive']).toContain(
        '归档摘要和生命周期闭环说明必须使用触发本次工作流的用户请求语言',
      );
      expect(zhSkills['opensuper-hotfix']).toContain(
        '精简版 OpenSpec 产物必须使用触发本次工作流的用户请求语言',
      );
      expect(zhSkills['opensuper-tweak']).toContain(
        '精简版 OpenSpec 产物必须使用触发本次工作流的用户请求语言',
      );

      expect(enSkills.opensuper).toContain('Output Language Rule');
      expect(enSkills.opensuper).toContain(
        'Use the language of the user request that triggered this workflow as the default output language',
      );
      expect(enSkills['opensuper-open']).toContain(
        'Every prompt and artifact request passed to OpenSpec must include the output-language constraint',
      );
      expect(enSkills['opensuper-design']).toContain(
        'Language: Use the language of the user request that triggered this workflow',
      );
      expect(enSkills['opensuper-build']).toContain(
        'Plan files and execution feedback must use the language of the user request that triggered this workflow',
      );
      expect(enSkills['opensuper-build']).toContain(
        'ARGUMENTS must include the same Language constraint as Step 1',
      );
      expect(enSkills['opensuper-verify']).toContain(
        'Verification reports and branch-handling notes must use the language of the user request that triggered this workflow',
      );
      expect(enSkills['opensuper-archive']).toContain(
        'Archive summaries and lifecycle closure notes must use the language of the user request that triggered this workflow',
      );
      expect(enSkills['opensuper-hotfix']).toContain(
        'Streamlined OpenSpec artifacts must use the language of the user request that triggered this workflow',
      );
      expect(enSkills['opensuper-tweak']).toContain(
        'Streamlined OpenSpec artifacts must use the language of the user request that triggered this workflow',
      );
    });
  });

  describe('OpenTest quality-gate bilingual contract', () => {
    it('keeps router, build, verify, archive, and state references behaviorally aligned', async () => {
      const relativePaths = [
        'opensuper/SKILL.md',
        'opensuper-build/SKILL.md',
        'opensuper-verify/SKILL.md',
        'opensuper-archive/SKILL.md',
        'opensuper/reference/opensuper-yaml-fields.md',
      ];
      const readLanguage = async (languageDir: 'skills' | 'skills-zh') =>
        Promise.all(
          relativePaths.map((relativePath) =>
            fs.readFile(path.resolve('assets', languageDir, relativePath), 'utf-8'),
          ),
        );
      const [english, chinese] = await Promise.all([
        readLanguage('skills'),
        readLanguage('skills-zh'),
      ]);

      for (const language of [english, chinese]) {
        const combined = language.join('\n');
        for (const literal of [
          'opentest_gate',
          'opentest_strict_result',
          'required',
          'not-applicable',
          'OPENSUPER_OPENTEST_CONSUMER',
          'node_modules/@pzy560117/opentest',
          'OPENTEST_GATE_JSON',
          '"schema_version":"1.0"',
          '"scope":"docs-only"',
          'pass-contract',
          'pass-local',
          'not-run',
          'deferred',
          'ARCHITECTURE/README/CHANGELOG/CONTRIBUTING/LICENSE',
          'verify-pass',
          'opensuper-archive.sh',
        ]) {
          expect(combined).toContain(literal);
        }
        expect(combined).toMatch(
          /critical.*security.*data-integrity.*money\/payment.*irreversible/is,
        );
        expect(language[1]).toContain('opentest verify --strict --json --output');
        expect(language[2]).toContain('strict_finding_id');
        expect(language[2]).toContain('expires_at');
        expect(language[3]).toContain('archive preflight');
      }
    });
  });

  describe('opensuper build subagent dispatch safeguards', () => {
    it('composes the Superpowers loop with the Chinese opensuper dispatch contract', async () => {
      const zhBuild = await fs.readFile(
        path.resolve('assets', 'skills-zh', 'opensuper-build', 'SKILL.md'),
        'utf-8',
      );
      const zhDispatch = await fs.readFile(
        path.resolve('assets', 'skills-zh', 'opensuper', 'reference', 'subagent-dispatch.md'),
        'utf-8',
      );
      const zhRecovery = await fs.readFile(
        path.resolve('assets', 'skills-zh', 'opensuper', 'reference', 'context-recovery.md'),
        'utf-8',
      );
      const zhGuard = await fs.readFile(
        path.resolve('assets', 'skills', 'opensuper', 'rules', 'opensuper-phase-guard.md'),
        'utf-8',
      );

      expect(zhBuild).toContain(
        '使用 Skill 工具加载 Superpowers `subagent-driven-development` 技能',
      );
      expect(zhBuild).toContain(
        '读取 `opensuper/reference/subagent-dispatch.md` 获取 opensuper 专属扩展',
      );
      expect(zhBuild).not.toContain('#### Subagent 调度协议');
      expect(zhDispatch).toContain('发生冲突时，以本文档中更具体的 opensuper 约束为准');
      expect(zhDispatch).toContain('不得把多个 task 打包给同一个 agent');
      expect(zhDispatch).toContain('每个 task 派发一个全新的后台 implementer agent');
      expect(zhDispatch).toContain('修复 agent 和 final reviewer');
      expect(zhDispatch).toContain('Language: 使用触发本次工作流的用户请求语言输出');
      expect(zhDispatch).toContain('允许修改的文件范围');
      expect(zhDispatch).toContain('必须执行的测试命令');
      expect(zhDispatch).toContain('提交哈希');
      expect(zhDispatch).toContain('确认提交和文件在当前工作树可见');
      expect(zhDispatch).toContain('实现提交或差异以及 RED/GREEN 证据');
      expect(zhDispatch).toContain('implementer 不得勾选 plan 或 OpenSpec task');
      expect(zhDispatch).toContain('协调者唯一允许的文件修改');
      expect(zhDispatch).toContain('plan、OpenSpec task 和 subagent 进度检查点');
      expect(zhDispatch).toContain('openspec/changes/<name>/.opensuper/subagent-progress.md');
      expect(zhDispatch).toContain('final-review | final-fix');
      expect(zhDispatch).toContain('当前审查-修复轮次');
      expect(zhDispatch).toContain('已通过的审查阶段');
      expect(zhDispatch).toContain('所有 task 已勾选且检查点处于 `final-review` 或 `final-fix`');
      expect(zhDispatch).toContain(
        '使用 Skill 工具加载 Superpowers `test-driven-development` 技能',
      );
      expect(zhDispatch).toContain('两个审查都通过后');
      expect(zhDispatch).toContain(
        '"$opensuper_BASH" "$opensuper_STATE" task-checkoff "$PLAN_FILE" "$PLAN_TASK_TEXT"',
      );
      expect(zhDispatch).not.toContain('PLAN_MATCHES="$(grep -cF');
      expect(zhDispatch).toContain('RED 失败命令与失败摘要');
      expect(zhDispatch).toContain('GREEN 通过命令与通过摘要');
      expect(zhDispatch).not.toContain("grep -n '\\- \\[ \\]' openspec/changes/<name>/tasks.md");
      expect(zhDispatch).toContain('禁止总结、禁止询问用户是否继续、禁止在任务之间等待用户输入');
      expect(zhDispatch).toContain('存在无法从仓库、计划或既有上下文消除的真实歧义');
      expect(zhDispatch).toContain('平台没有真实后台 agent 调度能力');
      expect(zhDispatch).toContain('不得加载 `finishing-a-development-branch`');
      expect(zhDispatch).toContain(
        '返回 `opensuper-build` 继续执行退出条件、阶段守卫和后续阶段衔接',
      );
      expect(zhRecovery).toContain('重新加载 Superpowers `subagent-driven-development` 技能');
      expect(zhRecovery).toContain('重新阅读 `opensuper/reference/subagent-dispatch.md`');
      expect(zhRecovery).toContain(
        '读取 `openspec/changes/<name>/.opensuper/subagent-progress.md`',
      );
      expect(zhGuard).toContain('重新加载 Superpowers `subagent-driven-development` 技能');
      expect(zhGuard).toContain(
        '读取 `opensuper/reference/subagent-dispatch.md` 获取 opensuper 专属扩展',
      );
      expect(zhGuard).toContain('读取 `openspec/changes/<name>/.opensuper/subagent-progress.md`');
    });

    it('keeps the English dispatch contract behaviorally aligned', async () => {
      const enBuild = await fs.readFile(
        path.resolve('assets', 'skills', 'opensuper-build', 'SKILL.md'),
        'utf-8',
      );
      const enDispatch = await fs.readFile(
        path.resolve('assets', 'skills', 'opensuper', 'reference', 'subagent-dispatch.md'),
        'utf-8',
      );
      const enRecovery = await fs.readFile(
        path.resolve('assets', 'skills', 'opensuper', 'reference', 'context-recovery.md'),
        'utf-8',
      );
      const enGuard = await fs.readFile(
        path.resolve('assets', 'skills', 'opensuper', 'rules', 'opensuper-phase-guard.en.md'),
        'utf-8',
      );

      expect(enBuild).toContain(
        'Use the Skill tool to load the Superpowers `subagent-driven-development` skill',
      );
      expect(enBuild).toContain(
        'read `opensuper/reference/subagent-dispatch.md` for opensuper-specific extensions',
      );
      expect(enBuild).toContain(
        'TDD constraints and evidence thresholds are defined in `opensuper/reference/subagent-dispatch.md`',
      );
      expect(enDispatch).toContain(
        'If the Superpowers skill conflicts with this document, the more specific opensuper constraints here take precedence',
      );
      expect(enDispatch).toContain('Never bundle multiple tasks into one agent');
      expect(enDispatch).toContain('fresh background implementer agent for every task');
      expect(enDispatch).toContain('fix agents, and the final reviewer');
      expect(enDispatch).toContain(
        'Language: Use the language of the user request that triggered this workflow',
      );
      expect(enDispatch).toContain('allowed file scope');
      expect(enDispatch).toContain('required test commands');
      expect(enDispatch).toContain('commit hash');
      expect(enDispatch).toContain('verify that the commit and changed files are visible');
      expect(enDispatch).toContain('implementation commit or diff and the RED/GREEN evidence');
      expect(enDispatch).toContain('The coordinator may modify only');
      expect(enDispatch).toContain('plan, OpenSpec task, and subagent progress checkpoint');
      expect(enDispatch).toContain('openspec/changes/<name>/.opensuper/subagent-progress.md');
      expect(enDispatch).toContain('final-review | final-fix');
      expect(enDispatch).toContain('current review-fix round');
      expect(enDispatch).toContain('review stages already passed');
      expect(enDispatch).toContain(
        'all tasks are checked and the checkpoint stage is `final-review` or `final-fix`',
      );
      expect(enDispatch).toContain(
        'use the Skill tool to load the Superpowers `test-driven-development` skill',
      );
      expect(enDispatch).toContain('Do NOT summarize');
      expect(enDispatch).toContain('irreducible ambiguity');
      expect(enDispatch).toContain('real background agent dispatch capability');
      expect(enDispatch).toContain('must not load `finishing-a-development-branch`');
      expect(enDispatch).toContain(
        'return control to `opensuper-build` for exit checks, the phase guard, and phase handoff',
      );
      expect(enRecovery).toContain('reload the Superpowers `subagent-driven-development` skill');
      expect(enRecovery).toContain('Re-read `opensuper/reference/subagent-dispatch.md`');
      expect(enRecovery).toContain(
        'Read `openspec/changes/<name>/.opensuper/subagent-progress.md`',
      );
      expect(enGuard).toContain('reload the Superpowers `subagent-driven-development` skill');
      expect(enGuard).toContain(
        'Re-read `opensuper/reference/subagent-dispatch.md` for opensuper-specific extensions',
      );
      expect(enGuard).toContain('Read `openspec/changes/<name>/.opensuper/subagent-progress.md`');
    });

    it('does not install a Stop hook for task continuity', async () => {
      const manifest = await readManifest();
      const hooks = Object.values(manifest.hooks ?? {});

      expect(hooks.length).toBeGreaterThan(0);
      expect(hooks.every((hook) => hook.matcher === 'Write|Edit')).toBe(true);
      expect(hooks.some((hook) => /stop/i.test(hook.matcher))).toBe(false);
    });
  });

  describe('Repository authoring guidance', () => {
    it('documents consistent skill invocation wording in CLAUDE.md', async () => {
      const claude = await fs.readFile(path.resolve('CLAUDE.md'), 'utf-8');

      expect(claude).toContain('## Skill 触发表述规范');
      expect(claude).toContain(
        '中文统一使用：`**立即执行：** 使用 Skill 工具加载 <skill-name> 技能。禁止跳过此步骤。`',
      );
      expect(claude).toContain(
        '英文统一使用：`**Immediately execute:** Use the Skill tool to load the <skill-name> skill. Skipping this step is prohibited.`',
      );
      expect(claude).toContain(
        '后续输入、上下文或执行要求写在“技能加载后 / After the skill loads”段落',
      );
    });
  });

  describe('opensuper script discovery helper', () => {
    it('ships a shared script locator helper', async () => {
      const manifest = await readManifest();
      expect(manifest.skills).toContain('opensuper/scripts/opensuper-env.sh');
    });

    it('ships the OpenTest gate adapter and shell wrapper', async () => {
      const manifest = await readManifest();

      expect(manifest.skills).toContain('opensuper/scripts/opensuper-opentest-gate.mjs');
      expect(manifest.skills).toContain('opensuper/scripts/opensuper-opentest-gate.sh');
    });

    it('keeps platform search roots out of English and Chinese skill prose', async () => {
      const manifest = await readManifest();
      const skillPaths = manifest.skills.filter(
        (skillPath) =>
          skillPath.endsWith('SKILL.md') &&
          (skillPath === 'opensuper/SKILL.md' || skillPath.startsWith('opensuper-')),
      );

      for (const languageDir of ['skills', 'skills-zh']) {
        for (const skillPath of skillPaths) {
          const content = await fs.readFile(
            path.resolve('assets', languageDir, skillPath),
            'utf-8',
          );
          if (!content.includes('opensuper_STATE') && !content.includes('opensuper_GUARD'))
            continue;

          expect(content, `${languageDir}/${skillPath} should use opensuper-env.sh`).toContain(
            'opensuper-env.sh',
          );
          expect(content, `${languageDir}/${skillPath} should source opensuper_ENV`).toContain(
            '. "$opensuper_ENV"',
          );
          expect(
            content,
            `${languageDir}/${skillPath} should allow HOME skill glob expansion`,
          ).toContain('"$HOME"/.*/skills');
          expect(
            content,
            `${languageDir}/${skillPath} should not quote the HOME skill glob`,
          ).not.toContain('"$HOME/.*/skills"');
          expect(content, `${languageDir}/${skillPath} should not inline roots`).not.toContain(
            'opensuper_SEARCH_ROOTS=',
          );
        }
      }
    });

    it('uses opensuper_BASH in shipped opensuper command examples', async () => {
      const manifest = await readManifest();
      const skillPaths = manifest.skills.filter(
        (skillPath) =>
          skillPath.endsWith('SKILL.md') &&
          (skillPath === 'opensuper/SKILL.md' || skillPath.startsWith('opensuper-')),
      );

      for (const languageDir of ['skills', 'skills-zh']) {
        for (const skillPath of skillPaths) {
          const content = await fs.readFile(
            path.resolve('assets', languageDir, skillPath),
            'utf-8',
          );

          expect(
            content,
            `${languageDir}/${skillPath} should avoid raw bash for opensuper scripts`,
          ).not.toMatch(/(^|[` \t])bash[ \t]+"?\$opensuper_/m);
        }
      }
    });

    it('keeps the opensuper_ENV locator block identical across shipped skills', async () => {
      const manifest = await readManifest();
      const skillPaths = manifest.skills.filter(
        (skillPath) =>
          skillPath.endsWith('SKILL.md') &&
          (skillPath === 'opensuper/SKILL.md' || skillPath.startsWith('opensuper-')),
      );

      const extractLocatorBlock = (content: string) => {
        const start = content.indexOf('opensuper_ENV="${opensuper_ENV:-$(find .');
        const end = content.indexOf('. "$opensuper_ENV"');

        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeGreaterThan(start);

        return content.slice(start, end + '. "$opensuper_ENV"'.length);
      };

      for (const languageDir of ['skills', 'skills-zh']) {
        let baseline: string | null = null;

        for (const skillPath of skillPaths) {
          const content = await fs.readFile(
            path.resolve('assets', languageDir, skillPath),
            'utf-8',
          );
          if (!content.includes('opensuper_ENV="${opensuper_ENV:-$(find .')) continue;

          const locatorBlock = extractLocatorBlock(content);
          if (baseline === null) {
            baseline = locatorBlock;
            continue;
          }

          expect(
            locatorBlock,
            `${languageDir}/${skillPath} should reuse the shared locator block`,
          ).toBe(baseline);
        }
      }
    });

    it('ships every opensuper reference doc that skill prose points to', async () => {
      const manifest = await readManifest();
      const manifestSkills = new Set(manifest.skills);
      const skillPaths = manifest.skills.filter(
        (skillPath) =>
          skillPath.endsWith('SKILL.md') &&
          (skillPath === 'opensuper/SKILL.md' || skillPath.startsWith('opensuper-')),
      );

      for (const languageDir of ['skills', 'skills-zh']) {
        for (const skillPath of skillPaths) {
          const content = await fs.readFile(
            path.resolve('assets', languageDir, skillPath),
            'utf-8',
          );
          const references = content.match(/opensuper\/reference\/[a-z-]+\.md/g) ?? [];

          for (const referencePath of new Set(references)) {
            expect(
              manifestSkills.has(referencePath),
              `${languageDir}/${skillPath} references ${referencePath} but manifest.json does not ship it`,
            ).toBe(true);
          }
        }
      }
    });
  });

  describe('Superpowers skill invocation names', () => {
    it('uses installed bare Superpowers skill names instead of plugin-prefixed aliases', async () => {
      const manifest = await readManifest();
      const skillPaths = manifest.skills.filter(
        (skillPath) =>
          skillPath.endsWith('SKILL.md') &&
          (skillPath === 'opensuper/SKILL.md' || skillPath.startsWith('opensuper-')),
      );

      for (const languageDir of ['skills', 'skills-zh']) {
        for (const skillPath of skillPaths) {
          const content = await fs.readFile(
            path.resolve('assets', languageDir, skillPath),
            'utf-8',
          );
          expect(content, `${languageDir}/${skillPath} should use bare skill names`).not.toContain(
            'superpowers:',
          );
        }
      }
    });
  });

  describe('output language contracts', () => {
    it.each(zhSkillNames)(
      'declares Chinese as the default output language in %s',
      async (skillName) => {
        const skillPath = path.join('assets', 'skills-zh', skillName, 'SKILL.md');
        const content = await fs.readFile(skillPath, 'utf-8');

        expect(content).toContain('## 产出语言契约');
        expect(content).toContain('默认使用中文');
      },
    );

    it.each(enSkillNames)(
      'declares English as the default output language in %s',
      async (skillName) => {
        const skillPath = path.join('assets', 'skills', skillName, 'SKILL.md');
        const content = await fs.readFile(skillPath, 'utf-8');

        expect(content).toContain('## Output Language Contract');
        expect(content).toContain('English by default');
      },
    );

    it('passes Chinese output requirements to external skills', async () => {
      const skillPaths = [
        path.join('assets', 'skills-zh', 'opensuper-open', 'SKILL.md'),
        path.join('assets', 'skills-zh', 'opensuper-design', 'SKILL.md'),
        path.join('assets', 'skills-zh', 'opensuper-build', 'SKILL.md'),
        path.join('assets', 'skills-zh', 'opensuper-verify', 'SKILL.md'),
        path.join('assets', 'skills-zh', 'opensuper-hotfix', 'SKILL.md'),
        path.join('assets', 'skills-zh', 'opensuper-tweak', 'SKILL.md'),
      ];

      for (const skillPath of skillPaths) {
        const content = await fs.readFile(skillPath, 'utf-8');
        expect(content).toContain('产出语言：中文');
      }
    });

    it('passes English output requirements to external skills', async () => {
      const skillPaths = [
        path.join('assets', 'skills', 'opensuper-open', 'SKILL.md'),
        path.join('assets', 'skills', 'opensuper-design', 'SKILL.md'),
        path.join('assets', 'skills', 'opensuper-build', 'SKILL.md'),
        path.join('assets', 'skills', 'opensuper-verify', 'SKILL.md'),
        path.join('assets', 'skills', 'opensuper-hotfix', 'SKILL.md'),
        path.join('assets', 'skills', 'opensuper-tweak', 'SKILL.md'),
      ];

      for (const skillPath of skillPaths) {
        const content = await fs.readFile(skillPath, 'utf-8');
        expect(content).toContain('Output language: English');
      }
    });
  });
});

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
