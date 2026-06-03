# OpenSuper AGENTS

本文件适用于整个仓库。保持简短，只做启动顺序、目录地图和全局边界；长说明放到 [CLAUDE.md](CLAUDE.md) 与 `docs/`。

## 先读什么

1. [README-zh.md](README-zh.md)：产品定位、工作流、状态机、目录结构。
2. [CLAUDE.md](CLAUDE.md)：项目级可执行规约，包含三层 Guide、人工介入点、校验要求。
3. [CONTRIBUTING.md](CONTRIBUTING.md)：开发命令、提交流程、Windows shell 测试说明。
4. 进入具体子树后再读对应内容：
   - `assets/skills-zh/`：中文技能为事实来源。
   - `assets/skills/`：英文技能与中文版保持语义一致。
   - `src/`：CLI 与安装逻辑。
   - `test/`：TypeScript + shell 测试。

## 仓库地图

- `src/`：CLI 命令、平台探测、OpenSpec/Superpowers/OpenSuper 安装逻辑。
- `assets/skills-zh/`：中文技能与脚本说明，优先维护。
- `assets/skills/`：英文技能镜像。
- `assets/skills/opensuper/scripts/`：状态机、guard、archive、schema 校验脚本。
- `test/ts/`：Vitest 用例。
- `test/shell/`：shell 行为回归。
- `docs/`：长说明、Guide、方法论沉淀。

## 全局边界

- 任何影响工作流语义、状态字段、guard 逻辑的修改，都必须同时更新测试、文档和 `CHANGELOG.md`。
- 任何技能语义调整，先改中文，再同步英文。
- 任何对 shell 脚本或命令调用链的修改，都必须考虑 Windows、Git Bash、macOS、Linux 的可移植性。
- 任何新增长文档，不要塞回根 `AGENTS.md`；放到 `docs/` 并从这里或 `README-zh.md` 建入口。

## 默认校验

- `npm test`
- `npm run test:shell`
- `npm run lint`
- `npm run format:check`
- `git diff --check`
