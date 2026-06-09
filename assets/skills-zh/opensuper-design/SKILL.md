---
name: opensuper-design
description: "OpenSuper 阶段 2：深度设计。用 /opensuper-design 调用。通过 brainstorming 产出 Design Doc 和 delta spec。"
---

# OpenSuper 阶段 2：深度设计（Design）

## 产出语言契约

- 产出语言：中文。
- 本 skill 的所有面向用户输出和生成文档默认使用中文，包括 `proposal.md`、`design.md`、`tasks.md`、delta spec、Design Doc、Plan、verification report 和归档说明。
- 命令、路径、frontmatter key、代码标识符、包名和 API 名称保持原文。
- 只有用户明确要求英文时才改用英文正文。

## 前置条件

- 活跃 change 已存在（proposal.md、design.md、tasks.md）
- 无 Design Doc（`docs/superpowers/specs/` 下无对应文件）

## 步骤

### 0. 入口状态验证（Entry Check）

执行入口验证：

```bash
OPENSUPER_SEARCH_ROOTS=("." "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.cursor/skills")
OPENSUPER_STATE="${OPENSUPER_STATE:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-state.sh' -type f -print -quit 2>/dev/null)}"
OPENSUPER_GUARD="${OPENSUPER_GUARD:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-guard.sh' -type f -print -quit 2>/dev/null)}"
bash "$OPENSUPER_STATE" check <name> design
```

验证通过后继续 Step 1。验证失败时脚本会输出具体失败原因。

### 1a. 读取已有上下文

读取活跃 change 下的 `proposal.md` 和 `design.md`，将核心内容整理为摘要：
- **proposal 摘要**：目标、动机、范围
- **design 摘要**：架构决策、高层设计

### 1b. 执行 Brainstorming（带上下文）

**立即执行：** 使用 Skill 工具加载 `superpowers:brainstorming` 技能，ARGUMENTS 包含：

```
Change: <change-name>
产出语言：中文
Proposal 摘要: <proposal 核心内容>
Design 摘要: <design.md 架构决策>
跳过上下文探索，直接进入设计提问。
生成的 Design Doc、delta spec、讨论摘要和后续任务正文必须使用中文；命令、路径、frontmatter key、代码标识符保持原文。
```

禁止跳过此步骤，禁止在未加载该技能的情况下继续。

如 `superpowers:brainstorming` 不可用，停止流程并提示安装或启用 Superpowers 技能，不要用普通对话替代该步骤。

技能加载后，按其指引产出：
- `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` — 设计文档（技术 RFC）
- `openspec/changes/<name>/specs/<capability>/spec.md` — 能力规格（delta）

### 2. 更新 OpenSuper 状态

先记录 design_doc 路径，再运行 guard 自动流转：

```bash
# 记录 design_doc 路径
bash "$OPENSUPER_STATE" set <name> design_doc docs/superpowers/specs/YYYY-MM-DD-topic-design.md

# 自动流转到下一阶段
bash "$OPENSUPER_GUARD" <change-name> design --apply
```

状态文件自动更新，无需手动编辑其他字段。

## 退出条件

- Design Doc 已创建并保存
- 如有新能力则 delta spec 已创建
- `design_doc` 已写入 `.opensuper.yaml`
- **阶段守卫**：运行 `bash "$OPENSUPER_GUARD" <change-name> design --apply`，全部 PASS 后自动流转到 `phase: build`

退出前必须使用 `--apply`：

```bash
bash "$OPENSUPER_GUARD" <change-name> design --apply
```

## 自动流转

退出条件满足后，**无需等待用户再次输入**，直接执行下一阶段：

> **REQUIRED NEXT SKILL:** 调用 `opensuper-build` skill 进入计划与构建阶段。
