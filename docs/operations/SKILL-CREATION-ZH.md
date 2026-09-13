# 使用 `/opensuper-any` 创建、验证与分发 Skill

本文只讲新版本推荐开放给普通用户的路径：通过 `/opensuper-any` 创建、优化、组合、验证并分发可复用 Skill。手工编写 `opensuper/skill.yaml`、`flow.yaml` 或 Bundle 状态文件不是普通用户路径。

## 一句话创建

在 Agent 平台里调用：

```text
/opensuper-any
```

然后描述你想创建或优化的 Skill。`/opensuper-any` 是 OpenSuper 的 Skill 创建向导：它读取项目级偏好、扫描真实本地 Skill、展示组合方案，用户确认后生成可 Eval、可 review、可发布、可分发的稳定组合 Skill Bundle。

普通用户只需要记住这条主线：

```text
/opensuper-any 创建 -> opensuper eval 验证 -> opensuper creator status/next -> opensuper publish review/approve/run -> opensuper publish distribute --preview -> opensuper publish distribute
```

`opensuper creator status` / `opensuper creator next` 是普通用户查看 readiness 和唯一推荐下一步的入口。`opensuper publish` 负责 review、approve、publish 和 distribute；`opensuper bundle` 仍是用于确定性状态、hash 和深度排障的高级 Bundle 后端；`opensuper skill run` / `opensuper skill continue` 是高级 Engine Run 调试入口。它们不是普通用户创建 Skill 的主入口。

## 首次建立项目级偏好

项目级偏好文件位于：

```text
.opensuper/skill-preferences.yaml
```

它和 `.opensuper/config.yaml` 同级，表达这个项目希望 `/opensuper-any` 优先复用哪些 Skill，以及遇到缺失、歧义、偏离和 scripts/hooks 时怎么处理。

如果文件不存在，`/opensuper-any` 应先扫描 OpenSuper 支持的平台 Skill，按能力分组展示可复用能力，并询问是否保存推荐偏好。用户不需要每次在输入框里重新列一长串 Skill。是否写入 `.opensuper/skill-preferences.yaml` 必须先询问用户。

推荐起点：

```yaml
version: 1
mode: advisory

prefer:
  - brainstorming
  - writing-plans
  - systematic-debugging
  - test-driven-development
  - requesting-code-review
  - verification-before-completion

require:
  - verification-before-completion

policies:
  missing: ask
  ambiguous: ask
  deviation: explain
  scripts: disclose
  hooks: disclose
```

字段含义：

- `mode: advisory`：默认模式，可以补充目标需要的 Skill，但必须解释偏离原因。
- `mode: strict`：团队标准化模式，required Skill 缺失、歧义或禁止 scripts/hooks 时阻塞。
- `prefer`：希望优先复用的 Skill，顺序代表偏好优先级。
- `require`：生成组合 Skill 时必须满足的 Skill。
- `policies.missing`：偏好 Skill 缺失时询问或失败。
- `policies.ambiguous`：同名 Skill 有多个不同来源时询问或失败。
- `policies.deviation`：偏离偏好时解释或失败。
- `policies.scripts` / `policies.hooks`：生成或分发 scripts/hooks 时允许、披露或禁止。

## 手写偏好

高级用户可以直接编辑 `.opensuper/skill-preferences.yaml`。这不是内部状态文件，可以手写、提交到项目，也可以由 `/opensuper-any` 首次扫描后生成。

示例：创建一个偏严谨的 PR 评审 Skill：

```yaml
version: 1
mode: advisory

prefer:
  - brainstorming
  - writing-plans
  - requesting-code-review
  - verification-before-completion

require:
  - requesting-code-review
  - verification-before-completion

policies:
  missing: ask
  ambiguous: ask
  deviation: explain
  scripts: disclose
  hooks: disclose
```

然后调用：

```text
/opensuper-any
```

可以这样描述目标：

```text
请基于项目级偏好创建一个 PR 评审助手。
它要先澄清评审范围，再制定检查计划，再执行代码审查，最后在完成前要求验证证据。
目标是给团队复用，不只是当前一次任务。
```

## 组合方案确认

`/opensuper-any` 不能直接写 Bundle draft。它必须先展示组合方案，用户确认后才进入生成。

组合方案至少要说明：

- 新 Skill 名称和目标场景。
- 预计复用的 Skill、来源、hash、用途和调用顺序。
- 哪些来自 `prefer`，哪些来自 `require`。
- 哪些由目标语义自动补充。
- 缺失和歧义候选。
- 是否偏离偏好顺序，以及原因。
- scripts/hooks 会产生什么可执行披露。
- 将生成哪些文件。

proposal 应给用户展示摘要、候选动作和 `proposalHash`。确认页至少要支持：

- `confirm-generate`
- `revise-proposal`
- `cancel`

用户确认后，`/opensuper-any` 才能写入 Skill Creator metadata。`proposalHash` 会由 metadata 记录并校验，不由用户作为参数传入。后端会把规范化 plan 固化到 `.opensuper/bundle-factory-plans/<name>/plan.json`，并记录 `planHash`、`preferenceHash`、偏好模式、策略、required Skill、resolved Skill 证据和偏离原因。

如果 proposal 还有缺失、歧义或组合 blocker，`/opensuper-any` 不应确认生成。需要用后端状态做候选修复时，可以暂存 unresolved Skill Creator state；候选和组合解决后，必须重新展示可生成方案并再次记录确认，否则生成、review 和 publish 都会拒绝继续。

## `/opensuper-any` 的产出

一次完整生成或优化后，产物应包含：

```text
<bundle-draft>/
  bundle.yaml
  skills/<entry-skill>/
    SKILL.md
    opensuper/
      skill.yaml
      guardrails.yaml
      checks.yaml
      eval.yaml
    reference/
      resolved-skills.json
      composition-report.md
    scripts/
  rules/
  hooks/
```

关键文件：

- `SKILL.md`：用户真正调用的入口。
- `reference/resolved-skills.json`：真实 Skill 来源、hash、摘要、选择原因和偏好证据。
- `reference/composition-report.md`：组合方案、偏离解释、风险和 review evidence。
- `opensuper/skill.yaml`：内部运行计划，不是用户手写入口。
- `opensuper/guardrails.yaml`：由偏好和风险策略生成的约束。
- `opensuper/checks.yaml`：运行完成度和 required Skill 检查。
- `opensuper/eval.yaml`：Eval manifest。
- `scripts/`、`rules/`、`hooks/`：稳定推进流程的 required control plane。

## Eval

有 `opensuper/eval.yaml` 时，推荐先做发现预检查：

```bash
opensuper eval ./generated-skill/opensuper/eval.yaml --collect
```

然后跑真实评估并生成 HTML 报告：

```bash
opensuper eval ./generated-skill/opensuper/eval.yaml --html
```

eval 结果必须绑定当前 draft hash。没有当前 hash 的 eval 证据、eval 失败或 eval 被跳过时，不得 publish。

## Publish

发布前必须先看 readiness。普通用户可以让 `/opensuper-any` 推进；需要手工命令时优先用：

```bash
opensuper creator status <name> --json
opensuper creator next <name> --json
opensuper publish review <name> --platform <reference-platform> --json
opensuper publish approve <name> --reviewer <reviewer> --json
opensuper publish run <name> --platform <reference-platform> --json
```

Review summary 必须展示：

- `planHash`
- `preferenceHash`
- 项目级偏好模式和 required Skill
- resolved Skill 证据
- 组合方案和偏离原因
- eval evidence
- readiness、blockers、warnings、evidence
- `Publish readiness:`
- `User next steps:`

阻塞项包括：

- unresolved candidate
- required Skill 缺失或歧义
- strict 模式下偏好文件漂移
- 缺少当前 hash 的 eval 证据
- 缺少当前 hash 的人工 approval
- required capability gap
- executable disclosure 未确认

## Distribute

发布后，`/opensuper-any` 必须询问用户是否分发，不能自动分发。

真正执行前，必须先跑 preview：

```bash
opensuper publish distribute <name> --platform <id> --scope project --preview --json
```

用户应先看到：

- `Distribution preview`
- planned files
- unsupported capability
- executable disclosures
- `No files were written`

如果用户确认分发，才运行：

```bash
opensuper publish distribute <name> --platform <id> --scope project --json
```

如果目标平台包含 hook 或脚本等可执行能力，必须先展示披露信息。用户确认后才可加入：

```bash
--confirm-executables
```

如果用户明确选择跳过 optional 能力，才可加入：

```bash
--skip-capability <capability>
```

## 恢复中断流程

如果做到一半中断，回来后直接对 Agent 说：

```text
继续上次的 Skill 创建
```

`/opensuper-any` 应先扫描可恢复状态，展示名称、状态、next action、blockers 和上次确认的组合方案摘要。恢复时会检查：

- Skill Creator state 是否存在。
- draft hash 是否变化。
- `.opensuper/skill-preferences.yaml` 的 `preferenceHash` 是否变化。
- resolved Skill hash 是否变化。
- eval evidence 是否仍匹配当前 hash。
- approval 是否仍匹配当前 hash。

面向用户的恢复示例：

```text
恢复摘要
Current step: review
Suggested user command: opensuper creator next <name>
```

如果偏好或 Skill 来源发生变化，`advisory` 模式应提示并让用户选择继续旧组合方案或重新生成；`strict` 模式应默认阻塞，要求用户确认继续或重新生成。

## 高级后端参考

普通用户通常让 `/opensuper-any` 调用下面的命令。它们用于修复候选解析、审计 authoring lane，或在自动化里显式操作 Skill Creator 状态；只有直接排查后端状态时才需要使用原始 `opensuper bundle` 命令。

```bash
opensuper creator guide --project . --json
opensuper creator propose <name> --file <plan.json> --json
opensuper creator init <name> --file <plan.json> --json
opensuper creator resolve <name> --candidate <query> --source <root-or-hash> --json
opensuper creator init <name> --file <plan.json> --confirmed-proposal --json
opensuper creator generate <name> --json
opensuper creator authoring-plan <name> --depth quick --json
opensuper creator authoring-record <name> --lane <lane-id> --file <lane-output.json> --json
```

`opensuper creator status` 的 JSON 会包含 next action，方便 `/opensuper-any` 或自动化恢复；普通用户只需要看 `opensuper creator status` / `opensuper creator next` 的用户命令。

## 用户最少需要记什么

1. `/opensuper-any` 是创建、优化、组合 Skill 的主入口。
2. `.opensuper/skill-preferences.yaml` 是项目级偏好，可以手写，也可以由 `/opensuper-any` 生成。
3. 生成前必须先看组合方案，确认后才会写 Bundle draft。
4. Eval 是发布前证据，不是发布动作。
5. Creator 状态用 `opensuper creator status` / `opensuper creator next` 看下一步；review、publish 和 distribute 仍归 `opensuper publish`。
