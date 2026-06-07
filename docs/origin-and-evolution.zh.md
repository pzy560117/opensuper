# OpenSuper 起源与演进（中文）

这份文档专门回答两个问题：

1. `pzy560117/opensuper` 是怎么来的？
2. 到目前为止，它具体做了什么？

如果你想看更完整的作者原始讲述素材，读 [presentation-transcript.zh.md](presentation-transcript.zh.md)。

## 1. 起源

OpenSuper 不是从“我要做一个新工具”开始的，而是从真实 AI Coding 工作流里的几个反复出现的问题开始的：

- OpenSpec 擅长规格和 change 生命周期，但不足以单独覆盖后续设计、计划、实现和收尾。
- Superpowers 擅长 HOW，但与 change 状态、归档和长期恢复之间仍然存在缝隙。
- `CLAUDE.md` / Guide / AGENTS 能约束行为，但如果没有脚本和测试配套，最终仍然容易漂。
- AI 会话中断、任务续跑、分支收尾、规格同步、验证证据记录，这些地方反而是最消耗 token 和最容易失控的。

OpenSuper 的出发点，就是把这些散落能力接成一条完整链。

## 2. 核心设计目标

可以把 OpenSuper 的目标概括成四句话：

1. 把 WHAT 和 HOW 串起来。
2. 把流程做成可恢复状态机。
3. 把关键失败点变成硬约束。
4. 把经验沉淀成可复用的仓库资产。

## 3. 到现在为止，项目做了什么

### 3.1 工作流层

- 定义了五阶段主流程：open / design / build / verify / archive。
- 增加了 hotfix / tweak 预设路径。
- 明确了 OpenSpec 与 Superpowers 的职责分工和交接边界。

### 3.2 状态机层

- 拆出独立 `.opensuper.yaml` 管理工作流状态。
- 增加 `opensuper-state.sh` 作为统一状态接口。
- 增加 `opensuper-guard.sh` 做阶段退出校验与自动迁移。
- 增加 `opensuper-archive.sh` 做归档自动化。
- 增加 `opensuper-yaml-validate.sh` 做 schema 与字段校验。

### 3.3 约束层

- 引入 `isolation` 字段，要求显式选择 `branch` 或 `worktree`。
- 引入 `verification_report` 与 `branch_status`，要求 verify 具备证据。
- 引入 `build_command` / `verify_command`，允许把项目自身 build/verify 链接进来。
- 引入 `direct_override`，限制 full workflow 下直接实现的滥用。

### 3.4 CLI / 产品化层

- 增加 `init / status / doctor / update` CLI 命令。
- 增加 JSON 输出。
- 增加安装范围和语言选择。
- 增加 release 自动化。

### 3.5 工程质量层

- 增加 Vitest 测试与 bats shell 测试。
- 增加 GitHub Actions、PR Title Lint、README 资产守护。
- 补齐跨平台兼容：CRLF、GNU/BSD sed、Git Bash、WSL、Windows shell 行为。

## 4. 最值得讲的演进线

如果面对别人介绍这个仓库，最值得强调的演进线不是“版本号更新了什么”，而是：

1. 从“流程说明”进化到“状态机”；
2. 从“人工收尾”进化到“guard + archive 自动化”；
3. 从“通用建议”进化到“脚本级硬约束”；
4. 从“个人可用”进化到“可发布、可验证、可维护”。

## 5. 为什么这能体现作者方法论

这个仓库最有代表性的地方，是它把作者的工程判断逐步沉到了仓库事实里：

- 重要概念进入 README / Guide；
- 重要规约进入 AGENTS / CLAUDE；
- 容易忘的行为进入 skills；
- 容易错的地方进入脚本；
- 容易漂的承诺进入测试与 release 流程。

所以 OpenSuper 最终讲的不是“我做了个工具”，而是：

> 我把自己对 AI Coding 工程化的理解，逐步固化成了一套可执行、可验证、可复用的系统。
