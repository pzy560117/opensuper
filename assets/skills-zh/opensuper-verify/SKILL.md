---
name: opensuper-verify
description: "OpenSuper 阶段 4：验证与收尾。用 /opensuper-verify 调用。验证实现符合设计，处理开发分支。"
---

# OpenSuper 阶段 4：验证与收尾（Verify）

## 产出语言契约

- 产出语言：中文。
- 本 skill 的所有面向用户输出和生成文档默认使用中文，包括 `proposal.md`、`design.md`、`tasks.md`、delta spec、Design Doc、Plan、verification report 和归档说明。
- 命令、路径、frontmatter key、代码标识符、包名和 API 名称保持原文。
- 只有用户明确要求英文时才改用英文正文。

## 前置条件

- 代码已提交（阶段 3 完成）
- tasks.md 全部任务已完成

## 步骤

### 0. 入口状态验证（Entry Check）

执行入口验证：

```bash
OPENSUPER_SEARCH_ROOTS=("." "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.cursor/skills")
OPENSUPER_STATE="${OPENSUPER_STATE:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-state.sh' -type f -print -quit 2>/dev/null)}"
OPENSUPER_GUARD="${OPENSUPER_GUARD:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-guard.sh' -type f -print -quit 2>/dev/null)}"
bash "$OPENSUPER_STATE" check <name> verify
```

验证通过后继续 Step 1。验证失败时脚本会输出具体失败原因。

### 1. 改动规模评估

执行规模评估：

```bash
bash "$OPENSUPER_STATE" scale <name>
```

脚本自动统计任务数、增量规格数、变更文件数，判断使用 light 或 full 验证模式，并设置 verify_mode 字段。

注意：如果 build 阶段每个任务都已提交，脚本基于工作区 diff 的文件数可能低估改动规模。此时必须读取 plan 文件头的 `base-ref` 并用提交区间复核：

```bash
PLAN=$(bash "$OPENSUPER_STATE" get <name> plan)
BASE_REF=$(grep '^base-ref:' "$PLAN" 2>/dev/null | head -1 | sed 's/^base-ref: *//')
git diff --stat "$BASE_REF"...HEAD
```

若提交区间显示改动超过轻量阈值（> 5 个文件、跨模块协调、或 delta spec 超过 1 个 capability），手动设置为完整验证：

```bash
bash "$OPENSUPER_STATE" set <name> verify_mode full
```

### 2a. 轻量验证（小改动）

当规模评估结果为"小"时，跳过 `openspec-verify-change`，直接执行以下检查：

1. tasks.md 全部任务已完成 `[x]`
2. 改动文件与 tasks.md 描述一致（`git diff --stat` 对照 tasks 内容）
3. 编译通过（执行项目对应的构建命令，如 `npm run build`、`mvn compile`、`cargo build` 等）
4. 相关测试通过
5. 无明显安全问题（无硬编码密钥、无新增 unsafe 操作）

**通过标准**：5 项全部 OK，无 CRITICAL 问题。

**不通过时**：报告失败项，记录失败并回退到 build 阶段，然后调用 `/opensuper-build` 修复。

```bash
bash "$OPENSUPER_STATE" transition <name> verify-fail
```

**报告格式**：简表列出 5 项检查结果 + PASS/FAIL。

**跳过项**（不在轻量验证中检查）：
- spec scenario 覆盖率
- design doc 一致性深度比对
- code pattern consistency 建议
- delta spec 与 design doc 漂移检测

### 2b. 完整验证（大改动）

当规模评估结果为"大"时：

**立即执行：** 使用 Skill 工具加载 `openspec-verify-change` 技能，并传入要求：`产出语言：中文`。禁止跳过此步骤。

技能加载后，按其指引验证。检查项：
1. tasks.md 全部任务已完成（`[x]`）
2. 实现符合 design.md 设计决策
3. 实现符合 brainstorming 设计文档
4. 能力规格场景全部通过
5. proposal.md 目标已满足
6. delta spec 与 design doc 无矛盾（若 Build 阶段有增量修改 spec，检查 design doc 是否有对应记录）
7. `docs/superpowers/specs/` 关联的设计文档可定位（文件存在且与当前 change 相关）

验证不通过时：报告缺失项，记录失败并回退到 build 阶段，然后调用 `/opensuper-build` 补充。

```bash
bash "$OPENSUPER_STATE" transition <name> verify-fail
```

**Spec 漂移处理**：
- 若检查项 6 发现矛盾（delta spec 有内容但 design doc 未体现），提示用户：
  - 选项 A：在 design doc 追加 "Implementation Divergence" 节记录偏差原因
  - 选项 B：回退到 Build 阶段，补充 brainstorming 更新 design doc
  - 选项 C：确认偏差可接受，继续验证（归档时 design doc 将标记为 `superseded-by-main-spec`）

### 3. 收尾（Superpowers）

**立即执行：** 使用 Skill 工具加载 `superpowers:finishing-a-development-branch` 技能，并传入要求：`产出语言：中文`。禁止跳过此步骤。

如 `superpowers:finishing-a-development-branch` 不可用，停止流程并提示安装或启用 Superpowers 技能，不要用普通对话替代该步骤。

技能加载后，按其指引收尾。分支处理选项：
1. 本地合并到主分支
2. 推送并创建 PR
3. 保持分支（稍后处理）
4. 丢弃工作

**确认项**：
- 全部测试通过
- 无硬编码密钥或安全问题

### 4. 记录验证证据

验证报告必须落盘，并在 `.opensuper.yaml` 中记录；分支处理完成后也必须写入状态字段。验证报告正文必须使用中文。不要手动设置 `verify_result: pass`，通过 guard 自动流转。

```bash
mkdir -p docs/superpowers/reports
# 将本次验证结论写入报告文件，例如：
# docs/superpowers/reports/YYYY-MM-DD-<change-name>-verify.md

bash "$OPENSUPER_STATE" set <name> verification_report docs/superpowers/reports/YYYY-MM-DD-<change-name>-verify.md
bash "$OPENSUPER_STATE" set <name> branch_status handled
```

## 退出条件

- 验证报告通过
- 分支已处理
- `.opensuper.yaml` 中 `verification_report` 指向已存在的验证报告文件
- `.opensuper.yaml` 中 `branch_status: handled`
- **阶段守卫**：运行 `bash "$OPENSUPER_GUARD" <change-name> verify --apply`，全部 PASS 后通过 `opensuper-state transition verify-pass` 自动流转到 `phase: archive`

验证和分支处理均完成后，运行 guard 自动流转：

```bash
bash "$OPENSUPER_GUARD" <change-name> verify --apply
```

状态文件自动更新为 `phase: archive`、`verify_result: pass`、`verified_at: YYYY-MM-DD`。

## 自动流转

退出条件满足后，**无需等待用户再次输入**，直接执行下一阶段：

> **REQUIRED NEXT SKILL:** 调用 `opensuper-archive` skill 进入归档阶段。
