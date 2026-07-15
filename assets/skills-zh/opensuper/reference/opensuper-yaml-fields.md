# .opensuper.yaml 字段说明

规范路径：`opensuper/reference/opensuper-yaml-fields.md`

本文件是 `.opensuper.yaml` 状态文件的字段参考。按需查阅，不随 skill 一次性加载。

## 示例

```yaml
workflow: full
phase: build
design_doc: docs/superpowers/specs/YYYY-MM-DD-topic-design.md
plan: docs/superpowers/plans/YYYY-MM-DD-feature.md
base_ref: a1b2c3d4e5f6...
build_mode: subagent-driven-development
build_pause: null
subagent_dispatch: confirmed
tdd_mode: tdd
isolation: branch
verify_mode: light
opentest_gate: required
opentest_strict_result: docs/opentest/reports/strict-verification.json
verify_result: pending
verification_report: null
branch_status: pending
created_at: 2026-05-26
verified_at: null
archive_confirmation: pending
archived: false
```

## 必需字段

| 字段 | 含义 |
|------|------|
| `workflow` | `full`、`hotfix` 或 `tweak` |
| `phase` | 当前阶段：`open`、`design`、`build`、`verify`、`archive`（init 统一设为 `open`，guard 负责过渡） |
| `design_doc` | 关联的 Superpowers Design Doc 路径，可为空 |
| `plan` | 关联的 Superpowers Plan 路径，可为空 |
| `base_ref` | init 时记录的 git commit SHA，用于 scale 评估。无 plan 时作为改动文件数统计基准 |
| `build_mode` | 已选择的执行方式，可为空 |
| `build_pause` | build 阶段内部暂停点。`null` 表示无暂停，`plan-ready` 表示 plan 已生成，用户选择切换模型后暂停 |
| `subagent_dispatch` | `null` 或 `confirmed`。仅当已确认当前平台存在真实后台 subagent / Task / multi-agent 调度能力时，`build_mode: subagent-driven-development` 才能写入并用于离开 build 阶段 |
| `tdd_mode` | `tdd` 或 `direct`。full workflow 离开 build 阶段前必须已选择。`tdd` 强制每个任务先写失败测试再实现；`direct` 不强制 TDD。hotfix/tweak 默认 `direct` |
| `isolation` | `branch` 或 `worktree`，工作区隔离方式。full 初始化可为 `null`，但只允许持续到 `/opensuper-build` Step 3 前；hotfix/tweak 默认 `branch` |
| `verify_mode` | `light` 或 `full`，可为空 |
| `opentest_gate` | `required`、`not-applicable` 或未加引号的 YAML 字面量 `null`。只有字段缺失/未加引号的 `null` 是旧版兼容；加引号的 `"null"`/`'null'`、空值、其他值及 malformed/duplicate 状态字段阻塞 |
| `opentest_strict_result` | OpenTest strict JSON 的项目相对规范路径。`required` 时不可为空；拒绝绝对路径、父目录穿越和经符号链接逃出目标项目的路径 |
| `auto_transition` | `true` 或 `false`。只控制阶段守卫推进 phase 后是否自动调用下一个 skill；`false` 时由 `opensuper-state next` 输出 `manual`，暂停下一 skill 调用，但不阻止 phase 字段更新 |
| `verify_result` | `pending`、`pass` 或 `fail` |
| `verification_report` | 验证报告文件路径，verify 通过前必须指向已存在文件 |
| `branch_status` | `pending` 或 `handled`，分支处理完成后设为 `handled` |
| `created_at` | change 创建日期（init 时自动写入），格式 `YYYY-MM-DD` |
| `verified_at` | 验证通过时间，可为空 |
| `archive_confirmation` | `pending` 或 `confirmed`。只有用户明确确认后通过 `archive-confirm` transition 写入；实际归档脚本会机器校验 |
| `archived` | change 是否已归档 |

## 可选字段

| 字段 | 含义 |
|------|------|
| `direct_override` | `true`/`false`。full workflow 如需使用 `build_mode: direct`，必须显式设为 `true` |
| `build_command` | 项目构建命令。guard 优先运行该命令，失败时打印命令输出 |
| `verify_command` | 项目验证命令。verify guard 优先运行该命令，未配置时回退到构建命令 |

## 状态机硬约束

- `phase` 不允许直接 `set`；正常流程必须使用 transition，仅状态修复可显式设置 `OPENSUPER_FORCE_PHASE=1`
- `build → verify` 前，`isolation` 必须是 `branch` 或 `worktree`
- 实际归档前，`archive_confirmation` 必须通过 `archive-confirm` transition 变为 `confirmed`；`archive-reopen` 会重置为 `pending`
- `build → verify` 前，`build_mode` 必须已选择
- `build_mode: subagent-driven-development` 必须同时有 `subagent_dispatch: confirmed`
- full workflow 离开 build 阶段前 `tdd_mode` 必须已选择为 `tdd` 或 `direct`
- `build_mode: direct` 默认只允许 `hotfix` / `tweak`；full workflow 需要 `direct_override: true`
- `build_pause` 不是执行方式，不得写入 `build_mode`
- 以上 build 约束同时存在于 `opensuper-guard.sh build --apply` 和 `opensuper-state.sh transition <name> build-complete`
- `opentest_gate: required` 时，必须先在目标项目生成 `opentest_strict_result`，再由 OpenSuper 已分发的 adapter 调用 OpenTest provider consumer 做语义重算；每次 required gate 校验只调用 provider 一次，固定 120 秒超时和 1 MiB 输出缓冲上限。缺少 consumer、结果文件或 provider，超时/超限，以及任一非零退出码都会阻塞
- provider consumer 按 `OPENSUPER_OPENTEST_CONSUMER` → 同级已安装 `opentest` skill → 目标项目 `node_modules/@pzy560117/opentest` 的顺序发现，不会在 `required` 下回退为旧版验证
- adapter 在 provider 前后重新解析 strict result 与其 `state_file`，并要求规范路径身份以及 result 原文/state 原始字节均不变；任何调用期间替换或改写都阻塞
- provider 返回 `risk-accepted` 时，验证报告必须包含唯一、完整、非空且可解析的 `OPENTEST_GATE_JSON`。每项必须在 `strict_finding_id` 与 `strict_key` 中严格二选一；`accepted_by` 只声明具体真实人类身份，agent/AI/通用角色/占位不得自批；`expires_at` 必须是日历有效且未来的 ISO-8601，可带 `Z`/offset 和可变长度小数秒。critical/security/data-integrity/money/payment/irreversible 风险禁止接受
- `opentest_gate: not-applicable` 仅接受唯一合法 `scope: "docs-only"` 机器块和声明性真实人类批准，并要求完整不可变 `base_ref` 原样解析为当前 `HEAD` 的祖先。adapter 检查 committed、staged、unstaged、untracked 四类路径；`docs/` 仅允许 `.md/.txt/.rst/.adoc` 与 `.png/.jpg/.jpeg/.gif/.svg/.webp` 静态图，当前 active 或 dated-archive change 目录仅允许 `.md/.openspec.yaml/.opensuper.yaml`；除此之外，仅允许仓库根目录中名为 ARCHITECTURE/README/CHANGELOG/CONTRIBUTING/LICENSE 且无扩展名或扩展名为 `.md/.txt/.rst/.adoc` 的文档。JSON/YAML/MDX、scripts、嵌套 Markdown 及所有 runtime/config 路径阻塞
- 两种机器例外都拒绝空块、重复块、未闭合/多余分隔符或 malformed JSON。归档 locator 为 `YYYY-MM-DD-<change>` 时仍以原始 `<change>` 比较 `change_id`
- 只有 `opentest_gate` 缺失/未加引号的 YAML 字面量 `null` 保持旧版兼容，但不属于 `pass-contract` 或 fusion-complete；加引号的 `"null"`/`'null'`、空值和其他值阻塞

## OpenTest 证据账本值

| 值 | 含义 |
|----|------|
| `pass-contract` | strict 证据已由 OpenSuper 经 provider consumer 成功消费，可满足 `required` |
| `pass-local` | 仅 OpenTest 本地验证通过，尚未被 OpenSuper 消费，不能满足 gate |
| `not-run` | 尚未执行 OpenTest；只有已批准的纯文档 `not-applicable` 可据此完成消费者例外 |
| `deferred` | 证据延后，仅用于交接追踪，不能满足 verify、archive 或 fusion-complete |

运行时状态、strict JSON、ledger、报告及证据都由安装两个独立包的目标项目持有；不要把任一包的源码仓库当作共享产物根目录。
