<p align="center">
  <a href="https://github.com/pzy560117/opensuper/blob/main/img/title-log.png">
    <picture>
      <source srcset="https://github.com/pzy560117/opensuper/blob/main/img/title-log.png">
      <img src="https://github.com/pzy560117/opensuper/blob/main/img/title-log.png" alt="OpenSuper logo">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://github.com/pzy560117/opensuper/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/pzy560117/opensuper/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="https://www.npmjs.com/package/@pzy560117/opensuper"><img alt="npm version" src="https://img.shields.io/npm/v/%40pzy560117%2Fopensuper?style=flat-square" /></a>
  <a href="https://www.npmjs.com/package/@pzy560117/opensuper"><img alt="npm download count" src="https://img.shields.io/npm/dm/%40pzy560117%2Fopensuper?style=flat-square&label=Downloads/mo" /></a>
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" /></a>
</p>

# OpenSuper

```
 ██████╗ ██████╗ ███╗   ███╗███████╗████████╗
██╔════╝██╔═══██╗████╗ ████║██╔════╝╚══██╔══╝
██║     ██║   ██║██╔████╔██║█████╗     ██║
██║     ██║   ██║██║╚██╔╝██║██╔══╝     ██║
╚██████╗╚██████╔╝██║ ╚═╝ ██║███████╗   ██║
 ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝   ╚═╝
```

> English version: [README.md](README.md)
> [Bilibili video](https://www.bilibili.com/video/BV1y4Gi6CEo1/?spm_id_from=333.1387.homepage.video_card.click&vd_source=d22726fe6b108647dbebf1c5d8817377)

**OpenSpec + Superpowers 双星开发工作流** — 从创意到归档，一条命令。

- GitHub: [pzy560117/opensuper](https://github.com/pzy560117/opensuper)
- npm: [@pzy560117/opensuper](https://www.npmjs.com/package/@pzy560117/opensuper)
- 最新版本: [v0.2.6](https://github.com/pzy560117/opensuper/releases/tag/v0.2.6)

OpenSpec 处理 **WHAT**（大纲、提案、spec 生命周期、归档）。Superpowers 处理 **HOW**（技术设计、规划、执行、收尾）。OpenSuper 将二者串联为五阶段自动化流水线。

## 为什么需要 OpenSuper

OpenSpec 擅长管理需求、做提案、管理 Spec 生命周期和归档，但使用过程中 OpenSpec 的提案和 Task 没有像 Superpowers 头脑风暴那样细致。

Superpowers 在头脑风暴后会产出 Spec 文档，但这个文档通常没有进行状态化设计——做完需求之后 Spec 仅在文档上对 Task 打勾，甚至 Agent 还会忘记打勾，造成下一次断点开始时，Agent 需要重新查看文档和项目代码来核验，产生较多 Token 浪费。

**OpenSuper 合并了两者的强项**，将核心流程整合为 5 个阶段

主入口 `/opensuper` 支持当前 Spec 状态检测，适用于长任务——中途完成后关闭 CC，回来只需 `/opensuper 继续`，OpenSuper 会自动读取活跃的 Spec（多个则列出选择），动态识别当前执行到哪个阶段，继续往下执行。

## 安装

```bash
npm install -g @pzy560117/opensuper
```

## 发布

OpenSuper 已接入 GitHub Actions 自动发布：

- 手动触发 `release-opensuper` 并传入 `version`，或推送 `v*` tag
- workflow 会自动执行构建、测试、打包预检、npm 发布和 GitHub Release 发布
- 当前发布包名：`@pzy560117/opensuper`

## 快速开始

```bash
cd your-project
opensuper init
```

`opensuper init` 会：

1. 提示你选择 AI 平台（自动检测已有配置）
2. 选择安装范围：项目级（当前目录）或全局（用户主目录）
3. 选择 OpenSuper 技能语言：English 或 中文
4. 安装 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 技能
5. 安装 [Superpowers](https://github.com/obra/superpowers) 技能
6. 将 OpenSuper 技能（你选择的语言）部署到所选平台
7. 创建 `docs/superpowers/specs/` 和 `docs/superpowers/plans/` 工作目录

> [!TIP]
> 更新版本号
>
> 执行 `opensuper update` 或者 `npm install -g @pzy560117/opensuper@latest` 即可更新到最新版本。

## 运行截图

<p align="center">
  <img src="https://github.com/pzy560117/opensuper/blob/main/img/runner.png" alt="runner">
</p>
<p align="center">自动安装 OpenSpec、Superpowers，一键配置开发环境</p>
<p align="center">多阶段 Skill 入口，自动识别当前 Spec 阶段，核心流程自动触发，关键节点人工审核</p>

## CLI命令

| 命令 | 描述 |
|---------|-------------|
| `opensuper init [path]` | 初始化 OpenSuper 工作流 |
| `opensuper status [path]` | 显示活跃更改、任务进度和下一步工作流命令 |
| `opensuper doctor [path]` | 诊断项目级/全局 OpenSuper 安装健康状态 |
| `opensuper update [path]` | 更新 npm 包和已安装的 OpenSuper 技能 |
| `opensuper --help` | 显示帮助 |
| `opensuper --version` | 显示版本 |

### init 选项

| 选项 | 描述 |
|--------|-------------|
| `--yes` | 非交互模式，自动选择已检测平台 |
| `--skip-existing` | 跳过已安装的组件 |
| `--overwrite` | 覆盖已安装的组件 |
| `--json` | 输出结构化 JSON |

当同一平台检测到多个已安装组件时，交互式 init 会先提供一次批量选择：全部覆盖、全部跳过，或逐项选择。

### status 选项

| 选项 | 描述 |
|--------|-------------|
| `--json` | 输出活跃更改，并包含 `nextCommand` |

### doctor 选项

| 选项 | 描述 |
|--------|-------------|
| `--json` | 输出结构化诊断结果 |
| `--scope <scope>` | 诊断 `auto`、`project` 或 `global` 范围（默认：`auto`） |

### update 选项

| 选项 | 描述 |
|--------|-------------|
| `--json` | 以 JSON 输出 npm 和 skill 更新结果 |
| `--language <lang>` | 覆盖自动检测到的 skill 语言 (`en`, `zh`) |
| `--scope <scope>` | 仅更新 `global` 或 `project` 范围 |

## 支持平台

`opensuper init` 支持 28 个 AI 编码平台：

| 平台 | 技能目录 | 平台 | 技能目录 |
|----------|-----------|----------|-----------|
| Claude Code | `.claude/` | Cursor | `.cursor/` |
| Codex | `.codex/` | OpenCode | `.opencode/` |
| Windsurf | `.windsurf/` | Cline | `.cline/` |
| RooCode | `.roo/` | Continue | `.continue/` |
| GitHub Copilot | `.github/` | Gemini CLI | `.gemini/` |
| Amazon Q Developer | `.amazonq/` | Qwen Code | `.qwen/` |
| Kilo Code | `.kilocode/` | Auggie | `.augment/` |
| Kiro | `.kiro/` | Lingma | `.lingma/` |
| Junie | `.junie/` | CodeBuddy | `.codebuddy/` |
| CoStrict | `.cospec/` | Crush | `.crush/` |
| Factory Droid | `.factory/` | iFlow | `.iflow/` |
| Pi | `.pi/` | Qoder | `.qoder/` |
| Antigravity | `.agent/` | Bob Shell | `.bob/` |
| ForgeCode | `.forge/` | Trae | `.trae/` |

## 技能

`opensuper init` 完成后，三组技能将被安装到所选平台的 `skills/` 目录：

### OpenSuper 技能

| 技能 | 描述 |
|-------|-------------|
| `/opensuper` | 主入口 — 自动检测阶段并分派到子命令 |
| `/opensuper-open` | 阶段 1：打开变更（提案、设计、任务分解） |
| `/opensuper-design` | 阶段 2：深度设计（头脑风暴、设计文档） |
| `/opensuper-build` | 阶段 3：规划与构建（实现计划、代码提交） |
| `/opensuper-verify` | 阶段 4：验证与完成（测试、验证报告） |
| `/opensuper-archive` | 阶段 5：归档（delta spec 同步、状态标注） |
| `/opensuper-hotfix` | 快捷路径：快速 bug 修复（跳过头脑风暴，不需要能力设计） |
| `/opensuper-tweak` | 快捷路径：小改动（文案调整、配置调整、文档或 Prompt 优化） |

### 守护与自动化脚本

| 脚本 | 用途 |
|--------|---------|
| `opensuper-guard.sh` | 阶段转换守护 — 验证退出条件，`--apply` 自动更新 `.opensuper.yaml` |
| `opensuper-archive.sh` | 一键归档 — 验证状态、同步 specs、移至归档、更新状态 |
| `opensuper-yaml-validate.sh` | 模式校验器 — 校验 `.opensuper.yaml` 结构和字段值 |
| `opensuper-state.sh` | 统一状态管理 — init/set/get/check/scale，agent 的专属 YAML 接口 |

### OpenSpec 技能

Spec 生命周期管理：propose、explore、sync、verify、archive 等。

### Superpowers 技能

开发方法论：brainstorming、TDD、subagent-driven development、code review、plan writing 等。

## 工作流

```
/opensuper
  ↓ auto-detect
/opensuper-open  -->  /opensuper-design  -->  /opensuper-build  -->  /opensuper-verify  -->  /opensuper-archive
(OpenSpec)         (Superpowers)       (Superpowers)       (Both)           (OpenSpec)

/opensuper-hotfix（快捷路径，跳过头脑风暴）
  open  -->  build  -->  verify  -->  archive

/opensuper-tweak（快捷路径，跳过头脑风暴和完整计划）
  open  -->  轻量构建  -->  轻量验证  -->  archive
```

### 五个阶段

| 阶段 | 命令 | 归属 | 产出物 |
|-------|---------|-------|-----------|
| 1. Open | `/opensuper-open` | OpenSpec | proposal.md、design.md、tasks.md |
| 2. Deep Design | `/opensuper-design` | Superpowers | Design Doc、delta spec |
| 3. Plan & Build | `/opensuper-build` | Superpowers | 实现计划、代码提交 |
| 4. Verify & Finish | `/opensuper-verify` | Both | 验证报告、分支处理 |
| 5. Archive | `/opensuper-archive` | OpenSpec | delta→main spec 同步、归档 |

### 核心原则

- **头脑风暴不可跳过** — 每个变更必须经过深度设计（hotfix/tweak 除外）
- **Delta spec 是活文档** — 在阶段 3 中可自由编辑，归档时同步
- **保持 tasks.md 同步** — 每完成一个任务就勾选
- **频繁提交** — 每个任务一个 commit，message 体现设计意图
- **先验证再归档** — `/opensuper-verify` 必须通过才能执行 `/opensuper-archive`

### 状态管理

OpenSuper 使用解耦状态架构，YAML 文件独立管理：

| 文件 | 归属 | 用途 |
|------|-------|---------|
| `.openspec.yaml` | OpenSpec | Spec 生命周期、变更元数据 |
| `.opensuper.yaml` | OpenSuper | 工作流阶段、执行模式、验证状态 |

**`.opensuper.yaml` 关键字段：**

```yaml
workflow: full
phase: build
design_doc: docs/superpowers/specs/YYYY-MM-DD-topic-design.md
plan: docs/superpowers/plans/YYYY-MM-DD-feature.md
build_mode: subagent-driven-development
isolation: branch
verify_mode: light
verify_result: pending
verification_report: docs/superpowers/reports/YYYY-MM-DD-change-verify.md
branch_status: pending
verified_at: null
archived: false
```

full workflow 初始化时 `build_mode` 和 `isolation` 可以暂时为 `null`，但进入 `build → verify` 前必须完成用户决策并写入合法值。`direct` 默认只允许 hotfix/tweak；full workflow 使用 `direct` 时必须额外记录 `direct_override: true`。项目可在 change 或仓库根配置中设置 `build_command` / `verify_command`，guard 会优先运行并打印失败输出。

其中所有的状态和运行阶段都采用脚本更新，且**能够检验每个阶段是否真实完成任务，达到条件之后才会退出当前阶段，执行更新状态动作**。相比于将复杂的状态管理机制记录在 Skill 中，脚本的方式强保障了核心状态扭转的可靠性、YAML 文件的正确性，以及断点恢复的便捷——Agent 只需要通过 OpenSuper 内置命令进行状态读取就能知道当前 Spec 所处的情况。

### 可靠性特性

OpenSuper 通过自动化状态转换确保 agent 执行可靠性：

1. **入口验证** — 每个阶段在执行前验证前置条件
   - 检查文件存在、状态一致性、阶段转换
   - 验证失败时输出 `[HARD STOP]` 及可操作建议

2. **自动化状态转换** — `opensuper-guard.sh --apply` 自动更新 `.opensuper.yaml`
   - 所有阶段转换（design → build → verify → archive）使用 `guard --apply`
   - 无需手动状态编辑 — 消除写入验证错误
   - `opensuper-state.sh` 是 agent 对状态操作的专属接口
   - Guard 和 archive 脚本内部使用 `opensuper-state.sh` 进行状态管理

3. **模式校验** — `opensuper-yaml-validate.sh` 确保数据完整性
   - 校验必填字段和可选字段
   - 校验枚举值（包括 `direct_override`）
   - 校验引用文件路径存在
   - 检测未知/拼写错误字段

4. **Build 决策强制** — Guard 和状态转换同时拦截跳过关键选择
   - `isolation` 必须是 `branch` 或 `worktree`
   - `build_mode` 必须已选择
   - full workflow 的 `build_mode: direct` 必须有 `direct_override: true`

5. **验证证据强制** — Guard 在阶段流转前强制要求验证凭证
   - `verify-pass` 转换要求 `verification_report` 指向已存在的验证报告文件
   - `branch_status` 必须为 `handled` 才能通过验证
   - Guard 检查 `verification_report exists` 和 `branch_status=handled` 作为硬性前提
   - 防止验证或分支处理被跳过时产生虚假的阶段推进

6. **归档自动化** — `opensuper-archive.sh` 一键处理完整归档流程
   - 验证入口状态、同步 delta specs 到 main specs
   - 标注设计文档和计划文档的 frontmatter
   - 将变更移至归档目录并更新 `archived: true`
   - 支持 `--dry-run` 预览

**安全**：所有变更名称输入均受路径遍历保护

## 项目结构

```
your-project/
├── .claude/skills/              # 平台技能目录（OpenSuper + OpenSpec + Superpowers）
│   ├── opensuper/SKILL.md
│   │   └── scripts/
│   │       ├── opensuper-guard.sh       # 阶段转换守护（--apply 自动更新状态）
│   │       ├── opensuper-archive.sh     # 一键归档自动化
│   │       ├── opensuper-yaml-validate.sh # 模式校验器
│   │       └── opensuper-state.sh       # 统一状态管理（init/set/get/check/scale）
│   ├── opensuper-*/SKILL.md
│   ├── openspec-*/SKILL.md
│   └── brainstorming/SKILL.md
├── openspec/                    # OpenSpec — WHAT
│   ├── config.yaml
│   └── changes/
│       └── <name>/
│           ├── .openspec.yaml       # OpenSpec 状态
│           ├── .opensuper.yaml          # OpenSuper 工作流状态（解耦）
│           ├── proposal.md
│           ├── design.md
│           ├── specs/<capability>/spec.md
│           └── tasks.md
└── docs/superpowers/            # Superpowers — HOW
    ├── specs/                   # 设计文档
    └── plans/                   # 实现计划
```

## 你能学到什么

现有的 Skill 市场中有很多优秀的 Skill 项目，但普遍存在偏好性问题——用户可能只喜欢部分功能。比如同时使用 OpenSpec 和 Superpowers 时，可能只用 OpenSpec 的 Spec 管理能力，而编码上更喜欢 Superpowers 的 TDD 驱动。

长期使用 Skill 的人都知道，这些能力是可以自由组合的，但具体怎么做依然需要真正的实践。OpenSuper 项目可以作为参考：

- **如何稳定触发嵌套 Skill** — 不是让 Agent 依靠文档描述做了"看起来像触发了 Skill"的操作（比如根据 Skill 描述写了文件），而是真正触发 Skill（核心特征：CC 上有 Skill 触发的打印）。OpenSuper 中会触发大量来自 OpenSpec 和 Superpowers 的能力，这段 Prompt 是怎么写的？

- **如何让组合 Skill 多阶段自动流转** — 不是靠人工介入。OpenSuper 的 5 阶段流程，除必要的用户选择项外，核心流程能够自动进行 Skill 触发，同时**状态机机制**也能保障状态扭转的可靠性。

## 开发

贡献流程、提交规范、PR 流程，以及新增平台或 Skill 的说明见 [CONTRIBUTING.md](CONTRIBUTING.md)。

```bash
# 克隆
git clone https://github.com/pzy560117/opensuper
cd opensuper

# 安装依赖
pnpm install

# 开发模式（监听）
pnpm dev

# 构建
pnpm build

# 测试（单元 + 覆盖率）
pnpm test
pnpm test:coverage
pnpm test:shell         # bats shell 测试

# Lint & format
pnpm lint
pnpm format
```

详见 [CHANGELOG.md](CHANGELOG.md) 了解版本历史与更新。

## 安全

- 发布前扫描 API keys、secrets、tokens、private keys
- `.npmignore` 阻止源码和配置文件进入 npm 包
- `.gitignore` 覆盖 secrets、credentials、IDE configs 等

## License

[MIT](LICENSE.md)

## 友情链接
[LINUX DO - 新的理想型社区](https://linux.do/)
