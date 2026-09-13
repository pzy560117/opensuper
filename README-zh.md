<p align="center">
  <a href="https://github.com/pzy560117/opensuper/blob/main/img/title-log.png">
    <picture>
      <source srcset="https://github.com/pzy560117/opensuper/blob/main/img/title-log.png">
      <img src="https://github.com/pzy560117/opensuper/blob/main/img/title-log.png" alt="OpenSuper logo">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://github.com/pzy560117/opensuper/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/pzy560117/opensuper/ci.yml?branch=main&style=flat-square&label=CI" /></a>
  <a href="https://app.codecov.io/gh/pzy560117/opensuper/tree/main"><img alt="codecov" src="https://img.shields.io/codecov/c/github/pzy560117/opensuper/main?style=flat-square&label=coverage&color=%23E61A7A" /></a>
  <a href="https://deepwiki.com/pzy560117/opensuper"><img alt="DeepWiki" src="https://img.shields.io/badge/DeepWiki-pzy560117%2Fopensuper-blue?style=flat-square" /></a>
  <a href="https://www.npmjs.com/package/@pzy560117/opensuper"><img alt="npm version" src="https://img.shields.io/npm/v/@pzy560117/opensuper?style=flat-square" /></a>
  <a href="https://www.npmjs.com/package/@pzy560117/opensuper"><img alt="npm total download count" src="https://img.shields.io/npm/dt/@pzy560117/opensuper?style=flat-square&label=Downloads" /></a>
  <a href="https://www.npmjs.com/package/@pzy560117/opensuper"><img alt="npm monthly download count" src="https://img.shields.io/npm/dm/@pzy560117/opensuper?style=flat-square&label=Downloads/mo" /></a>
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" /></a>
</p>

## 什么是 OpenSuper？

OpenSuper 是 [rpamis/comet](https://github.com/rpamis/comet) 的下游发行版。本版本完整跟进 Comet 0.4.1 开发树，并叠加最新的 Dashboard 与记忆过滤修复，同时把 npm 包、CLI、Skills、配置和运行时状态统一以 OpenSuper 名称发布；原 MIT 版权与许可证保持不变。


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
> [抖音](https://www.douyin.com/search/opensuper?aid=cd8fcc82-498b-4d59-8860-617deb719412&modal_id=7646429015808936293&type=general)

**OpenSuper 是一个面向Coding的可恢复长程任务工作流与 Skill 平台。**

它提供两套彼此独立的需求工作流：面向强模型、只依赖 OpenSuper 原生 runtime 的 Native，以及保留 OpenSpec + Superpowers 完整阶段治理的 Classic；同时覆盖 Skill 创建、评估与发布。

让你可以用一个工具链处理需求到归档、中断后恢复，将任意Skill组合得像OpenSuper一样，基于科学的**Rubric**、**Pass@k**、**Pass^k**评分演进你的Skill

> [!IMPORTANT]
> **OpenSuper 0.4.0 上游开发树同步版** — 本次完整跟进上游 0.4.1 开发树，带来 Native 工作流、多 Agent 协作、记忆与知识管理，以及完整的 Skill 创建、分发与评估工具链。
>
> - **面向强模型的 Native 工作流**：确认需求后，由 Agent 自主选择计划、实现、测试与审查方法，OpenSuper 负责状态检查、验收与可恢复归档。Native 与保留 OpenSpec + Superpowers 五阶段方法的 Classic 独立运行，共用配置、状态、Dashboard 和 Eval 入口。
> - **复杂需求的并行交付**：Supervisor Change 将目标拆成带依赖的子 Change，支持 Codex 多会话或 Claude Code Agent Teams 在独立 worktree 中实现和验证，再按依赖顺序集成，完成父 Change 的最终验收。
> - **可管理的个人记忆与项目知识**：跨任务保留协作偏好与可复用经验，按当前任务渐进式提供相关上下文。你可以查看、纠正、遗忘或暂停使用；新经验先试用，再依据实际采纳和验证结果积累可信度。
> - **Skill 创建、分发与评估**：通过 `/opensuper-any` 组合任意 Skill 并打包分发，用 `opensuper eval` 结合 Rubric、Pass@k、Pass^k 和 LangSmith 评估效果，让 Skill 的迭代有可比较的依据。
> - **统一的三栏 Dashboard**：在浏览器中查看 Native 与 Classic 进度、Git worktree、验收结果和归档记录，并管理个人记忆、项目知识与插件设置。
> - **跨平台运行与中断恢复**：纯 Node.js Runtime 支持 Windows、macOS 和 Linux，不再依赖 Bash/WSL；任务状态保存在项目中，换会话或中断后可以继续，CLI 明确提示下一步和需要用户决定的事项。
>
> 上游 Comet 的 Native 与 0.4.0 Classic 对齐实验（16 个任务，每种模式各运行 48 次）中，双方均通过的 41 组配对样本显示：Native **总 Token 减少 76.8%**、**Agent 轮次减少 57.4%**、**耗时减少 47.4%**。完整样本中，Native **pass^3 为 87.5%（提高 12.5 个百分点）**，两种模式的 **pass@3 均为 100%**。这些是上游结果，不是 OpenSuper 独立复验；原始报告保留在 `assets/eval-reports/comet-native-vs-beta16-beta17-20260810/`，完整变化见本仓 [Changelog](CHANGELOG.md)。

> Native 与 Classic 不是轻重档位，也不会互相升级。Native 服务于能够自主规划和验证的强模型；Classic 服务于需要完整阶段方法与强约束的场景。

## 为什么需要 OpenSuper

- **面向强模型的 Native 工作流** — `/opensuper-native` 用详细 brief、完整目标规格、状态检查和可恢复归档约束结果，同时把计划、实现、测试与审查方法交给模型自主判断；用户可读产物默认位于 `docs/opensuper/`，并与 Classic 完全分离。
- **单向可恢复的 Native 归档** — Archive 会先给出唯一的 dry-run 续接命令，隔离工作区的完成选项和阻塞路径会明确展示；用户继续流程即可由 Runtime 接管归档提交，无需重复查询状态或手工提交运行时文件。
- **复杂需求的 Supervisor Change** — Native 可以按真实交付边界拆分子 Change，用 DAG 管理依赖与就绪顺序，让多个 Agent 在 Runtime 创建的独立 worktree 中实现和验证，再统一集成并对父 Change 做最终验收。
- **长程任务稳定的核心**— OpenSuper 的 Classic Spec 模式结合 OpenSpec 和 Superpowers，用状态机、阶段检查与脚本串联五阶段流程，适合需要明确方法和强约束的任务；永久入口是 `/opensuper-classic`。
- **配置驱动的统一入口** — `/opensuper` 只读取项目的 `.opensuper/config.yaml`，确定性转发到 `/opensuper-native` 或 `/opensuper-classic`。它不按任务大小猜工作流，也不混用两边的 change、状态和目录。`opensuper resume-probe` 使用同一配置恢复正确的永久入口。
- **Skill 平台** — OpenSuper能够编写可复用 Skill 包，并通过 `/opensuper-any` 把它们整理成可分发 Bundle，你制作的Skill可以像如opensuper init一样一键分发到所有Coding平台。
- **Eval 平台**— OpenSuper基于科学的Rubric、Pass@k、Pass^k评分评估你的Skill，让Skill演进是基于科学依据，而不是依靠感觉，支持接入LangSmith评估，让评估真实走进企业级生产环境。基于双Agent架构自动化在你的生产环境完成评估工作

## Supervisor Change：让多个 Agent 协同交付复杂目标

当一个需求包含多个可以独立实现和验证的交付项时，Supervisor Change 会先确认子 Change 与依赖关系，再让 Codex 独立会话或 Claude Code Agent Teams 并行推进。Runtime 始终负责 worktree、任务身份、验证、有序集成和父 Change 的最终 Verify。

`复杂目标 → 子 Change DAG → 独立 worktree → 分别实现与验证 → 按依赖集成 → 父 Change 最终 Verify`

**Codex 多会话执行**

https://github.com/user-attachments/assets/96114cb0-f542-4f58-aa27-256f32adc46e

**Claude Code Agent Teams 执行**

https://github.com/user-attachments/assets/41428669-a49a-46e3-a0ae-0775e4f4bb6f

## 极低的记忆门槛

使用OpenSuper你只需要记忆2个Skill和1条命令，用极低的使用门槛覆盖Coding、创建与评估

- **用 `/opensuper` 进入项目配置的 Native 或 Classic 工作流**
- **用`/opensuper-any`组合任意Skill**
- **用opensuper eval评估任意Skill**

## OpenSuper 0.4.0 基线对比

以下图表来自 16 个 OpenSuper workflow 任务，每个 treatment 5 次样本，对比无 OpenSuper、OpenSuper 0.3.9 与 OpenSuper 0.4.0。

核心观察了Pass@5、Pass^5以及Rubric评分的差异，无 OpenSuper Skill的基线只验证业务行为

<p align="center">
  <img src="https://github.com/pzy560117/opensuper/blob/main/img/opensuper-eval-pass5.png" alt="OpenSuper pass@5 与 pass^5 基线对比" width="920">
</p>

<p align="center">
  <img src="https://github.com/pzy560117/opensuper/blob/main/img/opensuper-eval-rubric-core.png" alt="OpenSuper 核心 rubric 与 LLM-as-judge 基线对比" width="920">
</p>

## 从业界前沿技术出发

OpenSuper的许多能力都能够在海内外大厂实践中找到相似之处，想进一步了解OpenSuper与业界实践的对照

> 相关工程依据和调研记录保留在本仓 [`docs/`](docs/) 目录。

## 你能学到什么

- **如何稳定触发嵌套 Skill** — 不是让 Agent 依靠文档描述做了“看起来像触发了 Skill”的操作（比如根据 Skill 描述写了文件），而是真正触发 Skill（核心特征：Claude Code CLI 上有 Skill 触发的打印）。OpenSuper 中会触发大量来自 OpenSpec 和 Superpowers 的能力，稳定触发的 Prompt 经过大规模实践打磨
- **如何让组合 Skill 多阶段自动流转** — 不是靠人工介入。OpenSuper 的 5 阶段流程，除必要的用户选择项外，核心流程能够自动进行 Skill 触发，同时状态机机制也能保障状态扭转的可靠性。
- **如何把 Spec 生命周期做成可恢复流程** — OpenSuper 会把 OpenSpec 的 change/spec 制品与 Superpowers 的设计、计划文档关联起来，并通过每个 change 的 `.opensuper.yaml` 记录阶段、执行模式、验证结果和归档状态，让 Agent 中断后能够继续，而不是重新翻文档猜进度。
- **如何把文档同步从“用户提醒”变成自动化** — OpenSuper 将 handoff、状态更新、校验和归档同步放进脚本化流程，减少“记得更新 design doc”“记得同步 spec”“记得归档 change”这类反复提示。
- **如何设计 Agent 可执行的守护条件** — OpenSuper 的阶段退出不是简单相信 Agent 说“完成了”，而是通过 `opensuper-guard.mjs`、`opensuper-yaml-validate.mjs`、`opensuper-state.mjs` 等脚本检查任务、状态字段、验证证据和归档条件，满足条件后才允许推进。
- **如何做跨平台 Skill 分发和安装** — OpenSuper 支持多种 AI 编码平台、项目级/全局安装、中文/英文 Skill 选择，以及平台差异化目录（例如 Antigravity 的项目级和全局路径不同），可以作为 CLI 安装器和 Skill 打包结构的参考。
- **如何把脚本写成 Agent 工作流基础设施** — OpenSuper 的脚本处理 hash、YAML 字段、状态机和归档流程。它展示了如何把原本容易写散在 Prompt 里的流程控制，沉淀成可测试、可复用的工具。
- **如何基于科学的评估驱动演进Skill**— OpenSuper Eval支持Rubric结构化评分，并支持Pass@k、Pass^k指标，用最科学的方式演进Skill，而不是靠人工感觉和评估，支持Local和Langsmith评估，让Eval真正走进企业生产环境
- **如何智能的创建OpenSuper一样的Skill**— /opensuper-any支持组合任意Skill，你只需要告诉Agent你的Skill偏好，其余所有稳定性相关的hook，rule，脚本，Skill引用文件全程都由Agent搞定，帮助你创建出OpenSuper一样好用的Skill

## 安装

前置要求：

- Node.js 22.16+（22.x），或 24+
- npm/npx
- Git

```bash
npm install -g @pzy560117/opensuper
```

## 快速开始

在要使用 OpenSuper 的项目内初始化：

```bash
cd your-project
opensuper init
# 在宿主中调用 /opensuper
```

交互式初始化会介绍并提供 Native、Classic、两者三种选择。Native 面向能够自主实现和验证的强模型；Classic 面向需要完整 Spec/TDD 阶段约束的任务；两者模式会安装两套独立入口，并保持 `/opensuper` 默认使用 Native。非交互的新项目默认 Native，项目配置统一写入 `.opensuper/config.yaml`：

```bash
opensuper init --workflow classic
opensuper init --workflow both
```

### 项目配置

`opensuper init` 会按所选语言生成带逐字段注释的 `.opensuper/config.yaml`；`opensuper update` 补齐新增默认值，同时保留用户取值和未知扩展。

<details>
<summary>查看同时启用 Native 与 Classic 时的精简配置骨架</summary>

```yaml
schema: opensuper.project.v1
default_workflow: native
workflows: [native, classic]
ambient_resume: true

memory:
  learning: true
  retrieval: true
knowledge:
  provider: local
hook:
  allow_paths: []

native:
  artifact_root: docs
  language: zh-CN
  clarification_mode: batch
  archive_confirmation: automatic
  max_verify_failures: 5

classic:
  artifact_layout: docs
  language: zh-CN
  context_compression: off
  review_mode: standard
  auto_transition: true
```

- `default_workflow` 决定 `/opensuper` 默认入口，且必须出现在 `workflows` 中；`ambient_resume`、`memory`、`knowledge` 和 `hook` 由两套工作流共享。
- `memory.learning` / `retrieval` 控制个人记忆学习与注入；`knowledge.local.include` 可追加项目相对 Markdown glob。`hook.allow_paths` 默认为空，仅在受保护阶段确需写入共享目录时添加项目相对路径，不能绕过 `.opensuper` 或工作流产物保护。
- Native 用户可读产物默认位于 `docs/opensuper/`，机器 Runtime 固定在 `.opensuper/runtime/native/`；可用 `opensuper init --workflow native --root artifacts` 改为 `artifacts/opensuper/`。Classic 专属默认值放在 `classic:`，旧顶层字段会由 `opensuper init` / `opensuper update` 迁移。

云端知识、私有化 PR 仍属于高级配置。Native v4 不再把旧 `snapshot` 预算持久化到用户配置中。

</details>

## 对OpenClaw和Hermes、或其他AI平台的支持

对于直接使用通用 `skills` CLI 的平台，可以用下面的方式安装 OpenSuper skill 包：

```bash
npx skills add pzy560117/opensuper
```

## 运行截图

### 经典Spec Skill

<p align="center">
  <img src="https://github.com/pzy560117/opensuper/blob/main/img/runner.png" alt="runner">
</p>
<p align="center">自动安装 OpenSpec、Superpowers，一键配置开发环境</p>
<p align="center">多阶段 Skill 入口，自动识别当前 Spec 阶段，核心流程自动触发，关键节点人工审核</p>

### 与LangSmith/LangFuse的集成

OpenSuper Eval的自动化双Agent架构能够在线上与LangSmith/LangFuse环境集成，让实验可追溯、Skill可演进

<p align="center">
  <img src="https://github.com/pzy560117/opensuper/blob/main/img/langsmith-dataset.png" alt="runner">
</p>
<p align="center">在LangSmith中管理你的Skill基线，查看详细的评估指标，延迟及Token消耗</p>

<p align="center">
  <img src="https://github.com/pzy560117/opensuper/blob/main/img/langsmith-trace.png" alt="runner">
</p>
<p align="center">在LangSmith中追踪你的Claude Code全链路</p>

<p align="center">
  <img src="https://github.com/pzy560117/opensuper/blob/main/img/langsmith-baseline-detail.png" alt="runner">
</p>
<p align="center">在LangSmith通过Pytest跟踪自定义Rubric指标</p>

## 支持平台

`opensuper init` 支持 37 个 AI 编码平台：

<details>
<summary>查看完整平台列表</summary>

| 平台               | 技能目录      | 平台          | 技能目录     |
| ------------------ | ------------- | ------------- | ------------ |
| Claude Code        | `.claude/`    | Cursor        | `.cursor/`   |
| Codex              | `.codex/`     | OpenCode      | `.opencode/` |
| Devin Desktop（原 Windsurf） | `.devin/`     | Cline         | `.cline/`    |
| RooCode            | `.roo/`       | Continue      | `.continue/` |
| GitHub Copilot     | `.github/`    | Gemini CLI    | `.gemini/`   |
| Amazon Q Developer | `.amazonq/`   | Qwen Code     | `.qwen/`     |
| Kilo Code          | `.kilocode/`  | Auggie        | `.augment/`  |
| Kimi Code          | `.kimi-code/` | Kiro          | `.kiro/`     |
| Lingma             | `.lingma/`    | Junie         | `.junie/`    |
| CodeBuddy          | `.codebuddy/` | WorkBuddy     | `.workbuddy/` |
| Crush              | `.crush/`     | Factory Droid | `.factory/`  |
| iFlow              | `.iflow/`     | Pi            | `.pi/`       |
| Qoder              | `.qoder/`     | Antigravity   | `.agents/`   |
| Antigravity 2.0    | `.agents/`    | Bob Shell     | `.bob/`      |
| ForgeCode          | `.forge/`     | Trae          | `.trae/`     |
| Trae CN            | `.trae-cn/`   | ZCode         | `.zcode/`    |
| MimoCode           | `.mimocode/`  | CoStrict      | `.cospec/`   |
| Grok               | `.grok/`      |               |              |

</details>

## 开发

贡献流程、提交规范、PR 流程、分支工作流，以及新增平台、Skill、脚本或 changelog
的说明见 [CONTRIBUTING-zh.md](CONTRIBUTING-zh.md) | [English](CONTRIBUTING.md)。

详见 [CHANGELOG.md](CHANGELOG.md) 了解版本历史与更新。

## 路线图

开发进展与后续功能统一通过本仓库的 [Issues](https://github.com/pzy560117/opensuper/issues) 跟踪。

## Star历史

[![Star History Chart](https://api.star-history.com/svg?repos=pzy560117/opensuper&type=Date)](https://www.star-history.com/#pzy560117/opensuper&Date)

## Contributors

<a href="https://github.com/pzy560117/opensuper/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=pzy560117/opensuper&max=999&columns=12&anon=1" />
</a>

## License

[MIT](LICENSE)

## 社区交流

<table align="center">
  <tr>
    <td align="center" width="180">
      <img src="https://github.com/pzy560117/opensuper/blob/main/img/douyin.png" width="120" height="120"><br>
      <b>抖音群（推荐）</b>
    </td>
    <td align="center" width="180">
      <img src="https://github.com/pzy560117/opensuper/blob/main/img/wechat.png" width="120" height="120"><br>
      <b>微信群</b>
    </td>
    <td align="center" width="180">
      <img src="https://github.com/pzy560117/opensuper/blob/main/img/qq.jpg" width="120" height="120"><br>
      <b>QQ群</b>
    </td>
  </tr>
</table>

## 友情链接

[LINUX DO - 新的理想型社区](https://linux.do/)
