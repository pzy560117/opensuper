---
name: opensuper-archive
description: "OpenSuper 阶段 5：归档。用 /opensuper-archive 调用。同步 delta spec 到主 spec，归档 change。"
---

# OpenSuper 阶段 5：归档（Archive）

## 产出语言契约

- 产出语言：中文。
- 本 skill 的所有面向用户输出和生成文档默认使用中文，包括 `proposal.md`、`design.md`、`tasks.md`、delta spec、Design Doc、Plan、verification report 和归档说明。
- 命令、路径、frontmatter key、代码标识符、包名和 API 名称保持原文。
- 只有用户明确要求英文时才改用英文正文。

## 前置条件

- 验证已通过（阶段 4 完成）
- 分支已处理
- `openspec/changes/<name>/.opensuper.yaml` 中 `verify_result: pass`

## 步骤

### 0. 入口状态验证（Entry Check）

执行入口验证：

```bash
OPENSUPER_SEARCH_ROOTS=("." "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.cursor/skills")
OPENSUPER_STATE="${OPENSUPER_STATE:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-state.sh' -type f -print -quit 2>/dev/null)}"
bash "$OPENSUPER_STATE" check <name> archive
```

验证通过后继续 Step 1。验证失败时脚本会输出具体失败原因。

### 1. 执行归档

运行归档脚本，自动完成以下全部步骤：

```bash
bash "$OPENSUPER_ARCHIVE" "<change-name>"
```

脚本自动执行：
1. 入口状态验证（phase=archive, verify_result=pass, archived=false）
2. Delta spec 同步到主 spec
3. Design doc 前置元数据标注（archived-with, status）
4. Plan 前置元数据标注（archived-with）
5. 移动 change 到归档目录
6. 通过 `opensuper-state transition <archive-name> archived` 更新 `archived: true`

如脚本返回非零退出码，报告错误并停止。
如脚本返回零退出码，归档完成。
脚本摘要中的 `X/Y steps succeeded` 以真实执行步骤计数，不会因 delta spec 同步或文档标注重复累计。

当待同步的 delta spec 与已有主 spec 不一致时，脚本会在覆盖前打印 unified diff 预览，帮助确认归档同步内容。

如需预览而不实际执行，使用 `--dry-run` 参数。

### 2. 生命周期闭环

Spec 生命周期在此完成：
```
brainstorming → delta spec → 实施 → 验证 → 主 spec 覆盖 → design doc 标注 → 归档
```

## 退出条件

- 归档脚本执行成功（退出码 0）
- 归档目录 `openspec/changes/archive/YYYY-MM-DD-<change-name>/` 存在
- 归档后的 `.opensuper.yaml` 中 `archived: true`

归档脚本会把 `openspec/changes/<name>/` 移动到 `openspec/changes/archive/YYYY-MM-DD-<name>/`。归档成功后**不要再对原 change 名运行** `bash "$OPENSUPER_GUARD" <change-name> archive`，因为原活跃目录已经不存在。归档完整性以脚本退出码和归档目录状态为准。

## 完成

OpenSuper 流程全部完成。如需开始新工作，调用 `/opensuper` 或 `/opensuper-open`。
