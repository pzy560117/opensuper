# OpenSuper 项目规则

## 作用域与优先级

- 本文件管辖整个仓库；如果后续出现子目录 `AGENTS.md`，子目录规则只覆盖对应子树。
- 默认使用中文回复、中文规则说明和中文文档正文；技术名词、命令、路径、包名和 API 名称保持原文。
- 优先服从仓库内已存在的项目事实：`README-zh.md`、`CLAUDE.md`、`CONTRIBUTING.md`、`package.json`、测试文件和源码实现。
- 不要把本地机器路径、个人 token、临时调试结论或外部全局假设写进共享项目文件。
- 本文件保持为启动入口和全局边界；长说明放到 `CLAUDE.md`、`CONTRIBUTING.md` 或 `docs/`。

## 仓库目标

OpenSuper 是一个 Node.js/TypeScript CLI 包，用于安装和编排 OpenSpec + Superpowers 的双星开发工作流。当前包名是 `@pzy560117/opensuper`，入口命令是 `opensuper`。

## 先读顺序

1. 改 CLI 行为前，先读 `src/cli/index.ts`、对应 `src/commands/*.ts`、相关 `src/core/*.ts` 和现有测试。
2. 改技能内容前，先读对应的中文与英文 `SKILL.md`、`assets/manifest.json`、`CONTRIBUTING.md` 的 Skill Design 部分。
3. 改发布、安装或包内容前，先读 `package.json`、`build.js`、`scripts/prepublish-check.js` 和 `.github/workflows/` 中相关 workflow。
4. 改 README 或用户文档前，同时检查 `README-zh.md` 与 `README.md` 是否需要同步。

## 仓库地图

- `src/cli/`：Commander CLI 注册与入口装配。
- `src/commands/`：`init`、`status`、`doctor`、`update` 等命令编排。
- `src/core/`：平台检测、技能安装、OpenSpec/Superpowers 集成等核心逻辑。
- `src/utils/`：文件系统等通用工具。
- `assets/skills-zh/`：中文 OpenSuper skills，优先维护。
- `assets/skills/`：英文 OpenSuper skills，与中文版本保持语义一致。
- `assets/skills/opensuper/scripts/`：状态机、guard、archive、schema 校验脚本。
- `assets/manifest.json`：发布包内技能清单。
- `bin/`：CLI 可执行入口。
- `scripts/`：postinstall、发布预检、shell 测试包装脚本。
- `test/ts/`：Vitest 测试。
- `test/shell/`：Bats shell 测试。
- `.github/workflows/`：CI、PR 标题检查和发布流程。
- `docs/`：长说明、Guide、方法论沉淀。
- `dist/`：构建产物；不要手改，使用 `pnpm run build` 生成。

## 技术栈落位

- 本仓库目前是单栈 TypeScript/Node.js 工程，使用 ESM、`pnpm@10.18.3`、Node.js `>=20`、Vitest、ESLint 和 Prettier。
- 规则暂时放在根 `AGENTS.md` 即可；当前没有必要新增子目录 `AGENTS.md`。
- 如未来 `assets/`、`scripts/`、`test/` 或发布流程形成不同编辑纪律，再为对应目录新增局部规则。

## Skill 优化规则

- 优化或新增 skill 时，先写中文版本，用户确认之后再修改英文版本。
- 中文 skill 位于 `assets/skills-zh/<skill-name>/SKILL.md`，英文 skill 位于 `assets/skills/<skill-name>/SKILL.md`。
- 新增 skill 时同步更新 `assets/manifest.json`，并确认发布包 `files` 配置会包含相关文件。
- 修改中英文对应 skill 时，保持阶段判断、命令、脚本路径和失败处理语义一致；不要只同步标题或摘要。

## 开发工作流

- 依赖管理默认使用 `pnpm`，不要混用 `npm install` 或 `yarn` 改写锁文件。
- 代码改动优先走最小完整改动：先定位现有模式，再改实现，再补或更新测试。
- `dist/` 是构建输出；源代码、测试、assets 和脚本才是主要编辑对象。
- 发现 CodeGraph 未初始化时，可以提示运行 `codegraph init -i`；在未初始化前使用仓库文件和命令建立上下文。
- 任何影响工作流语义、状态字段、guard 逻辑的修改，都必须同时更新测试、文档和 `CHANGELOG.md`。
- 任何对 shell 脚本或命令调用链的修改，都必须考虑 Windows、Git Bash、macOS、Linux 的可移植性。
- 任何新增长文档，不要塞回根 `AGENTS.md`；放到 `docs/` 并从这里或 `README-zh.md` 建入口。

## 工程基线

### 安全

- 不提交密钥、token、个人路径或机器专属配置。
- 涉及文件写入、路径拼接、安装位置和覆盖逻辑时，必须校验目标路径和覆盖策略，避免误写用户目录或项目外路径。
- CLI 错误信息要足够可诊断，但不要泄露敏感路径之外的私密内容。

### 编码风格

- 保持 TypeScript `strict` 约束，不用 `any` 逃避类型问题，除非已有边界无法表达且有清楚理由。
- 优先沿用现有函数、命名、模块边界和错误处理风格。
- CLI 编排放在 `src/commands/`，平台和安装逻辑放在 `src/core/`，通用文件操作放在 `src/utils/`。
- 面向用户的输出要简洁、可操作，并兼顾中英文文档中已承诺的行为。

### 测试

- 代码行为变更默认补 Vitest；CLI、安装、状态检测、更新和文件操作相关变更应优先覆盖对应 `test/ts/*.test.ts`。
- shell 脚本或命令行端到端行为变更，评估是否需要更新 `test/shell/*.bats`。
- 仓库约定覆盖率目标为 `80%+`；若变更影响核心流程，优先运行覆盖率或相关测试。

### Git 与交付

- 提交信息遵循约定式提交：`feat`、`fix`、`refactor`、`docs`、`test`、`chore`、`perf`、`ci`。
- PR 或交付说明需要包含变更摘要、影响范围和验证命令。
- 不回滚用户已有改动；遇到脏工作区时先区分本次改动与既有改动。

### 构建与性能

- 默认验证入口：`pnpm run build`、`pnpm run lint`、`pnpm run format:check`、`pnpm run test`。
- 发布相关改动还要关注 `pnpm run prepublishOnly`；shell 测试需要本机具备 Bats 环境后再运行 `pnpm run test:shell`。
- 构建失败时先定位最近变更和类型错误，不要手改 `dist/` 掩盖源代码问题。

## 默认校验

- `pnpm run build`
- `pnpm run lint`
- `pnpm run format:check`
- `pnpm run test`
- `pnpm run test:shell`
- `git diff --check`

## 成功标准

- 行为满足 README、CONTRIBUTING 和现有测试表达的项目契约。
- 必要测试通过，或明确说明未运行的命令和原因。
- 规则、源码、文档和发布包清单之间没有明显漂移。
- 新增或修改的 skill 在中文与英文版本之间保持可追踪的一致性。
