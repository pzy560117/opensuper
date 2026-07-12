# opensuper 阶段感知（防漂移规则）

> 此规则每轮注入，防止长上下文时遗忘 opensuper 流程状态。
> Hook 平台额外执行 `opensuper-hook-guard.sh` 进行硬性拦截；
> 此 Rule 是所有平台通用的软性防线。

## 全局规则

### 阶段感知（最高优先级）

有活跃 opensuper change 时（`openspec/changes/<name>/.opensuper.yaml` 存在），**每次开始执行操作前**必须读取 `phase` 字段确认当前阶段。

**阶段与允许操作：**

| 阶段 | 允许 | 禁止 |
|------|------|------|
| `open` | 创建 proposal/design/tasks, 运行 guard | 写源代码 |
| `design` | brainstorming, 创建 Design Doc, 运行 guard | 写源代码 |
| `build` | 写源代码、测试、执行计划 | 跳过用户确认点 |
| `verify` | 验证、branch handling | 跳过失败处理 |
| `archive` | 确认归档、运行归档脚本 | 写源代码 |

### Skill 调用（不可用普通对话替代）

以下操作必须通过 Skill 工具加载，Skill 不可用时应停止流程并提示安装：

- **brainstorming** — design 阶段、build 阶段中等规模 spec 变更
- **writing-plans** — build 阶段创建实现计划
- **executing-plans** / **subagent-driven-development** — build 阶段执行
- **test-driven-development** — `executing-plans` 由主会话在第一个 task 前加载；`subagent-driven-development` 由每个后台 implementer 和修复 agent 加载
- **systematic-debugging** — 遇到崩溃/测试失败/构建失败时
- **verification-before-completion** — verify 阶段
- **using-git-worktrees** — build 阶段选择 worktree 隔离时

### 脚本执行（不可跳过）

- **阶段退出**: `opensuper-guard <name> <phase> --apply`（必须看到 ALL CHECKS PASSED）
- **压缩恢复**: `opensuper-state check <name> <phase> --recover`
- **状态更新**: 关键操作后通过 `opensuper-state set` 更新字段，禁止手工编辑 .opensuper.yaml
- **handoff 生成**: `opensuper-handoff <name> design --write`（禁止手写摘要）

### 用户确认（不可自动跳过）

以下决策点必须暂停等待用户明确选择，不得根据推荐规则自动填写：

- **open**: 需求澄清完成确认、artifact 评审确认
- **design**: brainstorming 方案确认（确认前不得创建 Design Doc）
- **build**: plan-ready 暂停、isolation/build_mode/tdd_mode 选择、spec 大规模变更确认
- **verify**: 验证失败处理策略、branch handling 选择
- **archive**: 归档前最终确认

## Design 阶段专项

1. 第一个脚本操作 = `opensuper-handoff <name> design --write`（未生成 handoff 禁止加载 brainstorming）
2. brainstorming in progress: incrementally update brainstorm-summary.md（每轮澄清或方案迭代后增量更新恢复检查点，未确认内容标注为待确认/候选）
3. brainstorming 完成后下一步 = brainstorm-summary.md 定稿 → Design Doc → guard
4. active compaction gate: brainstorm-summary.md 定稿后、创建 Design Doc 前，优先触发宿主平台原生上下文压缩；无法程序化触发时暂停提示用户手动压缩或确认继续
5. **绝对不能直接开始写实现代码** — 必须先创建 Design Doc 并通过 guard

## Build 阶段专项

1. plan 创建后必须询问用户选择继续或暂停（`build_pause` 机制）
2. 每个 task 验收后必须: tasks.md 打勾 → git commit（不得积攒）。`subagent-driven-development` 必须等 spec compliance 与 code quality 两个审查都通过，再由协调者按任务唯一文本定向勾选和验证；不得用未完成任务总表代替当前任务验证
3. 遇到失败必须加载 **systematic-debugging** skill，根因未定位前不得提出源码修复
4. spec 变更分级: 小改直接编辑 | 中改加载 brainstorming | 大改暂停等用户确认拆分

## Verify 阶段专项

1. 第一步运行 `opensuper-state scale <name>` 确定验证级别
2. 验证失败后列出失败项等用户选择，CRITICAL 必须修
3. 连续 3 次失败后必须让用户选择接受偏差或继续修

## 上下文压缩恢复

如果怀疑发生上下文压缩（之前对话被摘要、找不到之前讨论的内容），立即运行：

```bash
"$opensuper_BASH" "$opensuper_STATE" check <name> <phase> --recover
```

按脚本输出的 **Recovery action** 决定下一步。

**特别注意 `build_mode`**：若恢复脚本输出 `build_mode: subagent-driven-development`，你是协调者，不是执行者。必须：
1. 使用 Skill 工具重新加载 Superpowers `subagent-driven-development` 技能 (Use the Skill tool to reload the Superpowers `subagent-driven-development` skill)
2. 读取 `opensuper/reference/subagent-dispatch.md` 获取 opensuper 专属扩展 (re-read `opensuper/reference/subagent-dispatch.md` for opensuper-specific extensions)
3. 读取 `openspec/changes/<name>/.opensuper/subagent-progress.md` 恢复精确阶段、证据和审查-修复轮次 (Read `openspec/changes/<name>/.opensuper/subagent-progress.md` to recover the exact stage, evidence, and review-fix round)
4. 禁止在主会话中直接执行 task (Do not execute the pending task directly in the main window)
5. 按检查点恢复；缺失或不匹配时才从第一个未勾选 task 开始
6. 已提交但未通过双审查的 task 保持未勾选，继续审查/修复循环
7. task 通过双审查和定向勾选验证后立即继续下一个 task，不得总结或询问是否继续

## 阶段退出后自动过渡

guard `--apply` 成功后，必须调用下一阶段的 skill：

- open → `opensuper-design`（full）/ `opensuper-build`（hotfix/tweak）
- design → `opensuper-build`
- build → `opensuper-verify`
- verify → `opensuper-archive`
