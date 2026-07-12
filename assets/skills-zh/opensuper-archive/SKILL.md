---
name: opensuper-archive
description: "opensuper 阶段 5：归档。用 /opensuper-archive 调用。按 OpenSpec delta 语义合并主 spec，归档 change。"
---

# opensuper 阶段 5：归档（Archive）

## 产出语言契约

- 产出语言：中文。
- 本 skill 的所有面向用户输出和生成文档默认使用中文，包括 `proposal.md`、`design.md`、`tasks.md`、delta spec、Design Doc、Plan、verification report 和归档说明。
- 命令、路径、frontmatter key、代码标识符、包名和 API 名称保持原文。
- 只有用户明确要求英文时才改用英文正文。

## 前置条件

- 验证已通过（阶段 4 完成）
- 分支已处理
- `openspec/changes/<name>/.opensuper.yaml` 中 `verify_result: pass`
- 若 `opentest_gate` 为 `required` 或 `not-applicable`，对应 gate 已在 verify 阶段通过；archive 仍会重新验证，不能依赖旧结论

## 步骤

### 0. 输出语言约束

归档摘要和生命周期闭环说明必须使用触发本次工作流的用户请求语言。

### 0b. 入口状态验证（Entry Check）

执行入口验证：

```bash
opensuper_ENV="${opensuper_ENV:-$(find . "$HOME"/.*/skills "$HOME/.config" "$HOME/.gemini" -path '*/opensuper/scripts/opensuper-env.sh' -type f -print -quit 2>/dev/null)}"
if [ -z "$opensuper_ENV" ]; then
  echo "ERROR: opensuper-env.sh not found. Ensure the opensuper skill is installed." >&2
  return 1
fi
. "$opensuper_ENV"
"$opensuper_BASH" "$opensuper_STATE" check <name> archive
```

验证通过后继续 Step 1。验证失败时脚本会输出具体失败原因。

### 1. 归档前最终确认（阻塞点）

入口验证通过后，**必须按 `opensuper/reference/decision-point.md` 的协议暂停并等待用户确认是否立即归档**。不得在用户确认前运行 `"$opensuper_BASH" "$opensuper_ARCHIVE" "<change-name>"`。

确认前必须向用户展示简短摘要：
- change 名称
- 验证报告路径和结论
- 分支处理状态
- OpenTest gate、strict artifact 路径和证据账本值（如适用）
- 本次归档将执行的不可逆动作：按 OpenSpec delta 语义合并主 spec、标注 design doc / plan、移动 change 到 archive 目录

用户确认问题必须以单选题形式呈现，包含以下选项：
- 「确认归档」— 立即执行归档脚本，完成 spec 合并和 change 移动
- 「需要调整或重新验证」— 不执行归档；运行 `"$opensuper_BASH" "$opensuper_STATE" transition <change-name> archive-reopen` 回到 `phase: verify`，再调用 `/opensuper-verify`。若验证阶段确认需要修复，再按 `/opensuper-verify` 的验证失败决策回到 `/opensuper-build`
- 「暂不归档」— 不执行归档，保留当前 `phase: archive` 状态，等待用户稍后再次调用 `/opensuper-archive`

只有用户选择「确认归档」后，才允许继续 Step 2。用户选择「需要调整或重新验证」后，必须先执行 `archive-reopen` 状态回退，不得手动编辑 `.opensuper.yaml`。

### 2. 执行归档

运行归档脚本，自动完成以下全部步骤：

```bash
"$opensuper_BASH" "$opensuper_ARCHIVE" "<change-name>"
```

脚本自动执行：
1. 入口状态验证（phase=archive, verify_result=pass, archived=false）
2. 在任何文档标注、`openspec archive` 或归档状态修改前，调用与 verify/direct `verify-pass` 相同的 OpenTest gate 做实际 archive preflight
3. Design doc 前置元数据标注（archived-with, status）
4. Plan 前置元数据标注（archived-with）
5. 调用 OpenSpec archive 按 delta 语义合并主 spec 并移动 change 到归档目录
6. 校验主 spec 未残留 delta-only section 标题
7. 通过 `opensuper-state transition <archive-name> archived` 更新 `archived: true`

`opentest_gate: required` 时，preflight 重新发现已分发的 adapter/provider consumer，并对项目相对 `opentest_strict_result` 做当前 Git/哈希/语义重算。每次 required gate 校验只调用 provider 一次，固定 120 秒超时和 1 MiB 输出缓冲上限；provider 前后还会重解析 strict result 与其 `state_file`，确认两者规范路径身份与原始字节均未变化。consumer、结果或 provider 缺失、超时/超限、`.pending` 存在、artifact identity/bytes 变化或任一非零退出码都会在不可逆操作前阻塞。`risk-accepted` 会重新校验唯一完整且可解析的 `OPENTEST_GATE_JSON`，要求每项在 `strict_finding_id`/`strict_key` 中严格二选一、声明性真实人类 `accepted_by`、日历有效且未来的 ISO-8601 期限（支持 offset/可变长度小数秒）和恢复路径；agent/AI/占位不得自批，并继续禁止 critical/security/data-integrity/money/payment/irreversible 风险。`not-applicable` 会重新校验同名唯一分隔块中的真实人类声明性批准、`scope: "docs-only"`，以及从不可变 `base_ref` 覆盖 committed/staged/unstaged/untracked 的路径范围；`docs/` 仅允许 `.md/.txt/.rst/.adoc` 与 `.png/.jpg/.jpeg/.gif/.svg/.webp` 静态图，当前 active 或 dated-archive change 目录仅允许 `.md/.openspec.yaml/.opensuper.yaml`；除此之外，仅允许仓库根目录中名为 ARCHITECTURE/README/CHANGELOG/CONTRIBUTING/LICENSE 且无扩展名或扩展名为 `.md/.txt/.rst/.adoc` 的文档。JSON/YAML/MDX、scripts、嵌套 Markdown 及所有 runtime/config 路径阻塞。空块、重复块、未闭合分隔符或 malformed JSON 一律阻塞。只有字段缺失或字面量 `null` 保持旧版兼容；空值/其他值不兼容，也不属于 fusion-complete。

归档目录 locator 采用 `YYYY-MM-DD-<change-name>` 时，gate 从 dated 目录读取状态，但 strict result 和机器块的 `change_id` 仍与原始 `<change-name>` 比较，不能把日期前缀写入证据身份。

账本为 `pass-contract` 才能满足 `required`；`pass-local`、`not-run` 或 `deferred` 都会阻塞 required archive。只有已批准的纯文档 `not-applicable` 可用 `not-run` 完成消费者例外。

如脚本返回非零退出码，报告错误并停止。
如脚本返回零退出码，归档完成。
脚本摘要中的 `X/Y steps succeeded` 以真实执行步骤计数，不会因 delta spec 同步或文档标注重复累计。

脚本会调用 OpenSpec 归档能力按 `ADDED/MODIFIED/REMOVED/RENAMED` 语义合并主 spec，并在归档后校验主 spec 中没有残留 delta-only section 标题。

如需预览而不实际执行，使用 `--dry-run` 参数。

### 3. 生命周期闭环

Spec 生命周期在此完成：
```
brainstorming → delta spec → 实施 → 验证 → 主 spec 合并 → design doc 标注 → 归档
```

## 退出条件

- 归档脚本执行成功（退出码 0）
- 归档目录 `openspec/changes/archive/YYYY-MM-DD-<change-name>/` 存在
- 归档后的 `.opensuper.yaml` 中 `archived: true`

归档脚本会把 `openspec/changes/<name>/` 移动到 `openspec/changes/archive/YYYY-MM-DD-<name>/`。

> **WARNING**: 归档成功后**不要再对原 change 名运行** `"$opensuper_BASH" "$opensuper_GUARD" <change-name> archive`，因为原活跃目录已经不存在。误调会导致 guard 报错"change directory not found"。归档完整性以脚本退出码和归档目录状态为准。

## 完成

opensuper 流程全部完成。如需开始新工作，调用 `/opensuper` 或 `/opensuper-open`。

## 上下文压缩恢复

按 `opensuper/reference/context-recovery.md` 执行，phase 参数为 `archive`。若 `archived: true` 且归档目录存在，归档已完成，无需再次执行归档操作。

若 OpenTest preflight 失败，不得手改 strict JSON 或跳过脚本：consumer 缺失时安装目标项目 `@pzy560117/opentest` 或同级 `opentest` skill（托管环境也可设置 `OPENSUPER_OPENTEST_CONSUMER`）；结果缺失、过期、Git/hash 不匹配时，在确认没有活跃 writer 后从目标项目重新运行 `opentest verify --strict --json --output <opentest_strict_result>`。存在 `.pending` 时先诊断 producer，只有确认无 writer 且恢复安全后才人工处理 marker。
