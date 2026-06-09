---
name: opensuper-open
description: "OpenSuper 阶段 1：开启。用 /opensuper-open 调用。通过 OpenSpec 探索想法、创建 change 结构（proposal + design + tasks）。"
---

# OpenSuper 阶段 1：开启（Open）

## 产出语言契约

- 产出语言：中文。
- 本 skill 的所有面向用户输出和生成文档默认使用中文，包括 `proposal.md`、`design.md`、`tasks.md`、delta spec、Design Doc、Plan、verification report 和归档说明。
- 命令、路径、frontmatter key、代码标识符、包名和 API 名称保持原文。
- 只有用户明确要求英文时才改用英文正文。

## 前置条件

- 无活跃 change，或用户希望创建新 change

## 步骤

### 1. 探索想法

**立即执行：** 使用 Skill 工具加载 `openspec-explore` 技能，并传入要求：`产出语言：中文`。禁止跳过此步骤。

技能加载后，按其指引自由探索问题空间。探索结论、问题拆解和候选方案正文必须使用中文。

### 2. 创建 Change 结构 + 初始化状态

**立即执行：** 使用 Skill 工具加载 `openspec-new-change` 技能，并传入要求：`产出语言：中文`。若用户意图未明确、需要先形成建议，改为加载 `openspec-propose`，同样传入中文产出要求。禁止跳过此步骤。

创建的 `proposal.md`、`design.md`、`tasks.md` 正文必须使用中文；命令、路径、字段名、代码标识符保持原文。

确认以下产物已创建：

```
openspec/changes/<name>/
├── .openspec.yaml
├── .opensuper.yaml
├── proposal.md       # Why + What：问题、目标、范围
├── design.md         # How（高层）：架构决策、方案选型
└── tasks.md          # 任务清单（勾选框）
```

创建 `.opensuper.yaml` 状态文件：

```bash
OPENSUPER_SEARCH_ROOTS=("." "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.cursor/skills")
OPENSUPER_STATE="${OPENSUPER_STATE:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-state.sh' -type f -print -quit 2>/dev/null)}"
OPENSUPER_GUARD="${OPENSUPER_GUARD:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-guard.sh' -type f -print -quit 2>/dev/null)}"

if [ -z "$OPENSUPER_STATE" ] || [ -z "$OPENSUPER_GUARD" ]; then
  echo "ERROR: OpenSuper scripts not found. Ensure the opensuper skill is installed." >&2
  return 1
fi

bash "$OPENSUPER_STATE" init <name> full
```

### 3. 入口状态验证

验证状态机已正确初始化：

```bash
bash "$OPENSUPER_STATE" check <name> open
```

验证通过后继续 Step 4。验证失败时脚本会输出具体失败原因。

### 4. 内容完整性检查

确认三个文档内容完整：
- **proposal.md**：问题背景、目标、范围、非目标
- **design.md**：高层架构决策、方案选型、数据流
- **tasks.md**：任务列表，每个任务有明确描述

## 退出条件

- proposal.md、design.md、tasks.md 均已创建且内容完整
- **阶段守卫**：运行 `bash "$OPENSUPER_GUARD" <change-name> open --apply`，全部 PASS 后自动流转到下一阶段

退出前必须使用 `--apply`，否则 `.opensuper.yaml` 仍停留在 `phase: open`，下一阶段入口检查会失败。

```bash
bash "$OPENSUPER_GUARD" <change-name> open --apply
```

完整流程会自动更新为 `phase: design`；hotfix/tweak preset 会自动更新为 `phase: build`。

## 自动流转

退出条件满足后，**无需等待用户再次输入**，直接执行下一阶段：

> **REQUIRED NEXT SKILL:** 调用 `opensuper-design` skill 进入深度设计阶段。
