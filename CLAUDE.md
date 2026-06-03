# OpenSuper 项目规约

本文件是 OpenSuper 的项目层 Guide，面向 Claude Code、Codex 和其他支持仓库级规则文件的 AI Coding Agent。

## 1. 三层 Guide 结构

### 全局层

- 遵守平台默认安全边界，不跳过验证，不伪造完成。
- 先读仓库事实来源，再决定改动。
- 复杂改动遵循“澄清 → 设计 → 计划 → 实现 → 验证”。

### 团队层

- AI 不是孤立工具，而是完整工程流程的一部分。
- Guides 负责告诉模型“该怎么做”；Sensors 负责证明“做得对不对”。
- 人类主要负责定义边界、选择隔离方式、审查结果和校准方向，而不是替模型完成每一步执行。

### 项目层

- OpenSuper 的核心目标：把 OpenSpec 与 Superpowers 放进同一条可恢复、可校验、可归档的工程链路。
- 中文文档和中文技能优先维护，英文内容随后同步。
- 行为变更不能只改 Prompt 或 README，必须落到脚本、测试、文档三者之一的可验证组合里。

## 2. 推荐工作方式

### 启动顺序

1. 阅读 [README-zh.md](README-zh.md) 相关章节。
2. 阅读 [AGENTS.md](AGENTS.md) 了解目录地图和校验要求。
3. 如果改动命令行为，阅读 `src/commands/`、`src/core/` 和相关测试。
4. 如果改动工作流语义，阅读 `assets/skills-zh/opensuper*/` 与 `assets/skills/opensuper*/`。
5. 如果改动状态机或归档逻辑，优先阅读 `assets/skills/opensuper/scripts/` 与对应测试。

### 隔离策略

- 小改动、单条修复：可以使用分支。
- 高风险修改、并行实现、需要反复试验时：优先使用 worktree。
- 单个会话只处理一个清晰目标，不把多条互不相关的工作混到同一会话。

### Agentic 与人工介入点

- Agent 可以自动推进澄清、设计、计划、实现、验证。
- 以下节点必须显式留给人判断或确认：
  - 选择 `branch` 还是 `worktree`
  - 选择 `build_mode`
  - 接受设计偏差或规格漂移
  - 处理分支收尾与归档前的最终判断

## 3. Harness Engineering 在本仓库中的落点

### Agent = Model + Harness

- Model：负责理解需求、编写代码、组织文档。
- Harness：负责把仓库规约、状态脚本、测试与发布链路接到模型外面，限制错误自由度。

### Guides

- [README-zh.md](README-zh.md)：工作流与架构总览。
- [AGENTS.md](AGENTS.md)：仓库启动顺序与全局边界。
- 本文件：项目级执行规约。
- `assets/skills-zh/` / `assets/skills/`：技能指令本体。
- [CONTRIBUTING.md](CONTRIBUTING.md)：开发与发布流程。

### Sensors

- `npm test`：CLI、安装、README 资产与工作流行为测试。
- `npm run test:shell`：状态脚本、guard、archive 脚本回归。
- `npm run lint`：源码静态检查。
- `npm run format:check`：源码格式约束。
- GitHub Actions：CI、PR 标题校验、release 流程。

## 4. OpenSuper 的项目级硬约束

- 修改 `.opensuper.yaml` 字段、状态迁移条件、guard 逻辑时，必须补测试。
- 修改用户可见工作流、命令行为或文档承诺时，必须同步 README / CHANGELOG / CONTRIBUTING 中至少一处相关入口。
- 修改中文技能时，英文技能必须保持语义一致，不允许长期漂移。
- shell 相关改动要默认考虑 Windows 上 `bash` 可能来自 WSL launcher 或 Git Bash。
- 不要把知识沉淀只留在聊天里：可复用的项目经验应写入 `docs/` 或相关规则文件。

## 5. 知识沉淀

- 项目个性化知识：写入 `docs/` 或本文件。
- 可执行规约：写入 `AGENTS.md`、`CLAUDE.md`、技能文件、脚本或测试。
- 团队共性经验：先在本仓库沉淀，再考虑提炼到模板或上游技能。

“知识库”负责解释背景；“可执行规约”负责约束下一次改动。两者不要混写成一团。
