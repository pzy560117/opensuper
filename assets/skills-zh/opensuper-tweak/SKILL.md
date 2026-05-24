---
name: opensuper-tweak
description: "OpenSuper 预设路径：非 bug 的小改动（tweak）。跳过 brainstorming 和完整 plan，直接 open → lightweight build → light verify → archive。适用于文案、配置、文档或 prompt 的局部优化。"
---

# OpenSuper 预设路径：Tweak

Tweak 是 OpenSuper 五阶段能力的预设工作流，不是独立的平行流程。它复用 open、build、verify、archive 能力，仅跳过 brainstorming 和完整 plan。

适用于非 bug 的小范围变更，例如文案调整、配置调整、文档或 prompt 的局部优化。

**适用条件**（必须全部满足）：
1. 不新增 capability
2. 不改变架构
3. 不涉及接口变化
4. 通常不超过 3 个 tasks、4 个文件

**不适用**：如变更过程中发现需要 capability、架构或接口调整，应升级为完整 `/opensuper` 流程。

---

## 流程（preset workflow，4 阶段）

执行链路：open → lightweight build → light verify → archive。Tweak 为每个阶段提供默认决策：精简开启、轻量构建、轻量验证、验证通过后归档。

开始前先定位 OpenSuper 脚本：

```bash
OPENSUPER_SEARCH_ROOTS=("." "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.cursor/skills")
OPENSUPER_STATE="${OPENSUPER_STATE:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-state.sh' -type f -print -quit 2>/dev/null)}"
OPENSUPER_GUARD="${OPENSUPER_GUARD:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-guard.sh' -type f -print -quit 2>/dev/null)}"
OPENSUPER_ARCHIVE="${OPENSUPER_ARCHIVE:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-archive.sh' -type f -print -quit 2>/dev/null)}"
```

### 1. 快速开启（preset open）

复用 OpenSuper open 能力创建 change，但使用 tweak 默认值：不执行 `openspec-explore` 长探索，直接进入精简 change 创建。

**立即执行：** 使用 Skill 工具加载 `openspec-new-change` 技能。禁止跳过此步骤。

技能加载后，按其指引创建精简版产物：
  - `proposal.md` — 变更动机 + 目标 + 范围
  - `design.md` — 简短实现说明（无需方案对比）
  - `tasks.md` — 不超过 3 个任务
- **无需 delta spec**（除非变更改变了已有 spec 的验收场景；一旦需要 delta spec，升级为完整 `/opensuper`）

初始化 OpenSuper 状态文件：

```bash
bash "$OPENSUPER_STATE" init <name> tweak
```

初始化后验证状态：

```bash
bash "$OPENSUPER_STATE" check <name> open
```

阶段守卫完成 open → build 过渡：

```bash
bash "$OPENSUPER_GUARD" <change-name> open --apply
```

### 2. 轻量构建（preset build）

使用 tweak 默认值：`build_mode: direct`。跳过 `superpowers:brainstorming` 和 `superpowers:writing-plans`。

**立即执行：** 按 tasks.md 逐个执行任务：

1. 读取 `openspec/changes/<name>/tasks.md`，获取未完成任务列表
2. 对每个未完成任务：
   - 根据任务描述修改目标文件
   - 运行项目格式化命令（如 `mvn spotless:apply`、`npm run format` 等）
   - 运行相关测试确认通过
   - 将 tasks.md 中对应 `- [ ]` 勾选为 `- [x]`
   - 提交代码，commit message 格式：`tweak: <简述变更>`
3. 全部任务完成后，显式运行项目相关测试和构建命令
4. 运行阶段守卫完成 build → verify 过渡：

```bash
bash "$OPENSUPER_GUARD" <change-name> build --apply
```

状态文件自动更新为 `phase: verify`、`verify_result: pending`，然后进入验证。

### 3. 轻量验证（preset verify）

复用 `/opensuper-verify`。Tweak 必须保持轻量验证条件：≤ 3 tasks、≤ 4 files、无 delta spec、无新 capability。

**立即执行：** 使用 Skill 工具加载 `opensuper-verify` 技能。禁止跳过此步骤。

如规模评估进入完整验证路径，停止 tweak，升级为完整 `/opensuper`。

验证通过后，按 `/opensuper-verify` 的规则将 `.opensuper.yaml` 的 `verify_result` 记录为 `pass`，归档前不得跳过该状态。

### 4. 归档（preset archive）

复用 `/opensuper-archive`。归档前必须满足 `.opensuper.yaml` 中 `verify_result: pass`。

**立即执行：** 使用 Skill 工具加载 `opensuper-archive` 技能进行归档。禁止跳过此步骤。

---

## 连续执行模式

<IMPORTANT>
Tweak 流程为 **一次性连续执行**。调用 `/opensuper-tweak` 后，agent 必须自动走完全部 4 个阶段，中间不停顿等待用户输入（除非遇到升级条件需要用户确认）。

执行顺序：快速开启 → 轻量构建 → 轻量验证 → 归档 → 完成

每个阶段完成后立即进入下一阶段，无需用户再次输入。阶段内部仍必须按上文要求调用对应 OpenSuper/OpenSpec/Superpowers skill。
</IMPORTANT>

---

## 升级条件

满足以下**任一**条件时，停止 tweak 流程，升级为完整 `/opensuper`：

| 条件 | 说明 |
|------|------|
| 改动涉及 **5+ 文件** | 超出小改动范围 |
| 多模块协调修改 | 需要跨组件协调 |
| 需要新增测试用例 **5+** | 变更复杂度上升 |
| 配置项新增或删除 | 非值修改的配置变更 |
| 需要新增 capability | 超出局部优化 |
| 需要 delta spec | 影响了已有规格 |

升级方式：在当前 change 基础上补充 Design Doc（执行 `/opensuper-design`），后续正常走完整流程。

---

## 退出条件

- 小改动已完成，测试通过
- change 已归档
- 未新增 capability、架构调整或接口变化
- **阶段守卫**：build → verify 前运行 `bash "$OPENSUPER_GUARD" <change-name> build --apply`，verify → archive 前按 `/opensuper-verify` 规则运行 `bash "$OPENSUPER_GUARD" <change-name> verify --apply`
