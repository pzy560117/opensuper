<p align="center">
  <a href="https://github.com/pzy560117/opensuper/blob/main/img/title-log.png">
    <picture>
      <source srcset="https://github.com/pzy560117/opensuper/blob/main/img/title-log.png">
      <img src="https://github.com/pzy560117/opensuper/blob/main/img/title-log.png" alt="OpenSuper logo">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://github.com/pzy560117/opensuper/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/pzy560117/opensuper/ci.yml?branch=main&style=flat-square&label=CI" /></a>
  <a href="https://deepwiki.com/pzy560117/opensuper"><img alt="DeepWiki" src="https://img.shields.io/badge/DeepWiki-pzy560117%2Fopensuper-blue?style=flat-square" /></a>
  <a href="https://www.npmjs.com/package/@pzy560117/opensuper"><img alt="npm version" src="https://img.shields.io/npm/v/@pzy560117/opensuper?style=flat-square" /></a>
  <a href="https://www.npmjs.com/package/@pzy560117/opensuper"><img alt="npm download count" src="https://img.shields.io/npm/dm/@pzy560117/opensuper?style=flat-square&label=Downloads/mo" /></a>
  <a href="https://www.npmjs.com/package/@pzy560117/opensuper"><img alt="npm weekly download count" src="https://img.shields.io/npm/dw/@pzy560117/opensuper?style=flat-square&label=Downloads/wk" /></a>
  <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" /></a>
</p>

# @pzy560117/opensuper

```
 ██████╗ ██████╗ ███╗   ███╗███████╗████████╗
██╔════╝██╔═══██╗████╗ ████║██╔════╝╚══██╔══╝
██║     ██║   ██║██╔████╔██║█████╗     ██║
██║     ██║   ██║██║╚██╔╝██║██╔══╝     ██║
╚██████╗╚██████╔╝██║ ╚═╝ ██║███████╗   ██║
 ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝   ╚═╝
```

> 中文版：[README-zh.md](README-zh.md)
> [Bilibili video](https://www.bilibili.com/video/BV1y4Gi6CEo1/?spm_id_from=333.1387.homepage.video_card.click&vd_source=d22726fe6b108647dbebf1c5d8817377)
> [DouYin](https://www.douyin.com/search/OpenSuper?aid=cd8fcc82-498b-4d59-8860-617deb719412&modal_id=7646429015808936293&type=general)

**OpenSpec + Superpowers dual-star development workflow** — one command from idea to archive.

OpenSpec handles **WHAT** (outlines, proposals, spec lifecycle, archiving).

Superpowers handles **HOW** (technical design, planning, execution, wrap-up).

OpenSuper chains both into a five-phase automated pipeline.

> [!IMPORTANT]
> **0.3.9 Highlights** — Lifecycle transitions, cross-change hook routing, and archive approval now fail closed, with a complete Windows Git Bash regression pass;
>
> New **Beta context compression** cutting Build-phase input tokens by **25–30%**;
> New active context compression mechanism to release context consumed by reading specs and brainstorming, preserving window space for the subsequent Build phase.
> 6 default-on workflow token optimizations; New `auto_transition` config for automatic or manual phase handoff;
> Hook+Rule anti-drift phase guard; Optional TDD mode and subagent dispatch confirmation;
> Large PRD split into multiple changes; Pre-archive confirmation with reopen, verify retry limit, systematic debugging interception, and verification completion check.
>
> See [NEWS.md](NEWS.md) for details.

## Why OpenSuper

OpenSpec excels at managing requirements, creating proposals, managing Spec lifecycles, and archiving, but its proposals
and tasks lack the detail of Superpowers brainstorming.

Superpowers generates Spec documents after brainstorming, but these documents typically lack stateful design — after
completing requirements, Specs only have tasks checked off in the document, and Agents even forget to check them off.
This causes the Agent to re-examine documents and project code to verify on resumption, wasting many tokens.

**OpenSuper combines the strengths of both**, integrating the core workflow into 5 phases

The main entry `/OpenSuper` supports current Spec state detection, suitable for long tasks — after closing your AI coding
session midway, just `/OpenSuper` and OpenSuper will automatically read the active Spec (lists multiple for selection),
dynamically identify which phase is currently executing, and continue.

At the same time, OpenSuper provides full Spec lifecycle management. During execution, it links OpenSpec change/spec
artifacts with Superpowers design and planning documents, then automates handoff, state updates, validation, and archive
sync so users do not have to repeatedly remind the Agent to keep documents synchronized and connected.

## What You'll Learn

Many excellent Skill projects exist in the current Skill market, but they generally have preference issues — users may
only like some features. For example, when using both OpenSpec and Superpowers, one might only use OpenSpec's Spec
management capabilities, but prefer Superpowers' TDD-driven approach for coding.

Long-term Skill users know these capabilities can be freely combined, but exactly how to do so still requires real
practice. The OpenSuper project can serve as a reference:

- **How to reliably trigger nested Skills** — Not letting the Agent rely on document descriptions to perform "look-alike
  Skill trigger" operations (like writing files based on Skill descriptions), but truly triggering Skills (key feature:
  Skill trigger prints on CC). OpenSuper triggers many capabilities from OpenSpec and Superpowers. How is this Prompt
  written?

- **How to make combined Skills flow automatically across phases** — Not relying on manual intervention. OpenSuper's 5-phase
  flow can automatically trigger Skills for the core process except for necessary user choices, while the state machine
  also protects state transition reliability.

- **How to turn the Spec lifecycle into a resumable workflow** — OpenSuper links OpenSpec change/spec artifacts with
  Superpowers design and planning documents, then records phase, execution mode, verification results, and archive
  status in `.OpenSuper.yaml`, so the Agent can resume after interruption instead of rereading documents and guessing
  progress.

- **How to turn document synchronization from "user reminders" into automation** — OpenSuper puts handoff, state updates,
  validation, and archive sync into scripted flows, reducing repeated prompts like "remember to update the design
  doc", "remember to sync the spec", and "remember to archive the change".

- **How to design guard conditions that Agents can execute** — OpenSuper does not simply trust the Agent saying "done" at
  phase exits. Scripts such as `OpenSuper-guard.sh`, `OpenSuper-yaml-validate.sh`, and `OpenSuper-state.sh` check tasks, state
  fields, verification evidence, and archive conditions before allowing the workflow to advance.

- **How to distribute and install Skills across platforms** — OpenSuper supports multiple AI coding platforms,
  project/global installation, Chinese/English Skill choices, and platform-specific directory differences such as
  Antigravity using different project-level and global paths. It can be a reference for CLI installers and Skill package
  structure.

- **How to turn shell scripts into Agent workflow infrastructure** — OpenSuper's scripts need to work across macOS, Linux,
  and Windows Git Bash while handling hashes, YAML fields, state machines, and archive flows. It shows how to move
  fragile workflow control out of scattered Prompt text and into testable, reusable tools.

## Install

Requirements:

- Node.js 20+
- npm/npx
- Git
- Bash-compatible shell for workflow scripts (Windows users should use Git Bash or an equivalent bash environment)

```bash
npm install -g @pzy560117/opensuper
```

The OpenTest quality gate is optional; its provider is needed only when a change uses `opentest_gate: required`. The recommended setup installs OpenTest in the same target project so the shipped consumer is discoverable from project `node_modules`:

```bash
npm install --save-dev @pzy560117/opentest@^0.1.19
npx opentest init
```

Alternatively, install the OpenTest skill beside the selected platform's `opensuper` skill:

```bash
npx @pzy560117/opentest install --scope project --platform <platform-id> --language en
```

Managed installations may point `OPENSUPER_OPENTEST_CONSUMER` at OpenTest's shipped `opentest-strict-result.mjs`. Installing only the CLI globally does not guarantee consumer discovery; one of the environment, sibling-skill, or target-project dependency paths must also exist.

### 0.3.9 validated baseline

| Component   | Validated version | Installation policy                               |
| ----------- | ----------------: | ------------------------------------------------- |
| OpenSuper   |             0.3.9 | npm package                                       |
| Node.js     |               20+ | Runtime requirement                               |
| OpenSpec    |             1.6.0 | `OpenSuper init` installs the pinned npm version  |
| Skills CLI  |             1.5.9 | Pinned `npx` installer                            |
| Superpowers |            v6.1.1 | `OpenSuper init` installs the pinned official tag |

OpenSpec and Superpowers are not bundled with OpenSuper. Re-run this repository's verification gates before updating either pin.

## Quick Start

```bash
cd your-project
OpenSuper init
```

`OpenSuper init` will:

1. Prompt you to select AI platforms (auto-detects existing configs)
2. Choose install scope: project-level (current directory) or global (home directory)
3. Select language for OpenSuper skills: English or 中文
4. Install [OpenSpec](https://github.com/Fission-AI/OpenSpec) skills
5. Install [Superpowers](https://github.com/obra/superpowers) skills
6. Deploy OpenSuper skills (in your chosen language) to selected platforms
7. Create `docs/superpowers/specs/` and `docs/superpowers/plans/` working directories for project-scope installs

OpenSpec CLI is installed globally for both skill scopes because runtime commands resolve it from PATH; skill files still follow the selected scope.

`OpenSuper init` does not force-install OpenTest. New changes default to `opentest_gate: null` for legacy compatibility. To require contract evidence, install OpenTest independently in the target project and set that change to `opentest_gate: required` with a project-relative `opentest_strict_result`.

The OpenSuper skill language also determines the default language for documents generated during OpenSuper orchestration. Choosing 中文 makes `proposal.md`, `design.md`, `tasks.md`, delta specs, Design Docs, Plans, and verification reports default to Chinese prose; choosing English makes them default to English prose. Commands, paths, frontmatter keys, code identifiers, package names, and API names stay in their original form.

> [!TIP]
> update version
>
> `OpenSuper update` or `npm install -g @pzy560117/opensuper@latest` to get the latest features and fixes.

## Support for OpenClaw and Hermes, and other AI platforms

For platforms that use the generic `skills` CLI directly, you can install the OpenSuper skill package with:

```bash
npx skills add pzy560117/opensuper
```

## Screenshots

<p align="center">
  <img src="https://github.com/pzy560117/opensuper/blob/main/img/runner.png" alt="runner">
</p>

<p align="center">Auto-install OpenSpec & Superpowers, one-click dev environment setup</p>
<p align="center">Multi-phase Skill entry, auto-detects current Spec stage, auto-triggers core flow, manual review at key nodes</p>

## Commands

<details>
<summary><code>OpenSuper init [path]</code> — Initialize OpenSuper workflow</summary>

Initializes OpenSpec, Superpowers, and OpenSuper skills for selected AI coding platforms.

| Option            | Description                                                                    |
|-------------------|--------------------------------------------------------------------------------|
| `--yes`           | Non-interactive mode, auto-select detected platforms (or all if none detected) |
| `--scope <scope>` | Install scope: `project` or `global`                                           |
| `--skip-existing` | Skip already installed components                                              |
| `--overwrite`     | Overwrite already installed components                                         |
| `--json`          | Output structured JSON                                                         |

When multiple existing components are found on the same platform, interactive init offers one bulk choice: overwrite
all, skip all, or choose per component.

</details>

<details>
<summary><code>OpenSuper status [path]</code> — Show active changes and next workflow command</summary>

Displays active changes, task progress, and the recommended next OpenSuper workflow command.

| Option   | Description                              |
|----------|------------------------------------------|
| `--json` | Output active changes with `nextCommand` |

</details>

<details>
<summary><code>OpenSuper doctor [path]</code> — Diagnose OpenSuper installation health</summary>

Checks project/global installation health, working directories, installed skills, scripts, and OpenSuper state files.

| Option            | Description                                                     |
|-------------------|-----------------------------------------------------------------|
| `--json`          | Output structured diagnostic results                            |
| `--scope <scope>` | Diagnose `auto`, `project`, or `global` scope (default: `auto`) |

</details>

<details>
<summary><code>OpenSuper update [path]</code> — Update OpenSuper package and skills</summary>

Updates the npm package and refreshes installed OpenSuper skills in detected project/global targets.

| Option              | Description                                   |
|---------------------|-----------------------------------------------|
| `--json`            | Output npm and skill update results as JSON   |
| `--language <lang>` | Override detected skill language (`en`, `zh`); also determines the default prose language for OpenSuper-generated documents |
| `--scope <scope>`   | Update only `global` or `project` scope       |

</details>

<details>
<summary><code>OpenSuper uninstall [path]</code> — Remove OpenSuper skills, rules, and hooks</summary>

Safely removes OpenSuper-distributed skills, rules, and hooks from all detected platforms. Preserves user-defined hooks and non-OpenSuper configuration.

| Option            | Description                                    |
|-------------------|------------------------------------------------|
| `--force`         | Skip confirmation prompt                       |
| `--scope <scope>` | Uninstall only `global` or `project` scope     |
| `--json`          | Output removal results as JSON                 |

```bash
OpenSuper uninstall              # Interactive — shows targets, asks for confirmation
OpenSuper uninstall --force      # Non-interactive — removes everything immediately
OpenSuper uninstall --scope project  # Only remove project-level installations
```

</details>

| Command           | Description  |
|-------------------|--------------|
| `OpenSuper --help`    | Show help    |
| `OpenSuper --version` | Show version |

## Supported Platforms

`OpenSuper init` supports 29 AI coding platforms:

<details>
<summary>View full platform list</summary>

| Platform           | Skills Dir   | Platform   | Skills Dir    |
|--------------------|--------------|------------|---------------|
| Claude Code        | `.claude/`   | Cursor     | `.cursor/`    |
| Codex              | `.codex/`    | OpenCode   | `.opencode/`  |
| Windsurf           | `.windsurf/` | Cline      | `.cline/`     |
| RooCode            | `.roo/`      | Continue   | `.continue/`  |
| GitHub Copilot     | `.github/`   | Gemini CLI | `.gemini/`    |
| Amazon Q Developer | `.amazonq/`  | Qwen Code  | `.qwen/`      |
| Kilo Code          | `.kilocode/` | Auggie     | `.augment/`   |
| Kimi Code          | `.kimi-code/`| Kiro       | `.kiro/`      |
| Lingma             | `.lingma/`   | Junie      | `.junie/`     |
| CodeBuddy          | `.codebuddy/`| CoStrict   | `.cospec/`    |
| Crush              | `.crush/`    | Factory Droid | `.factory/` |
| iFlow              | `.iflow/`    | Pi         | `.pi/`        |
| Qoder              | `.qoder/`    | Antigravity | `.agents/`   |
| Bob Shell          | `.bob/`      | ForgeCode  | `.forge/`     |
| Trae               | `.trae/`     |            |               |

</details>

Some platforms use different project and global directories. For example, OpenCode global installs use
`.config/opencode`, Lingma global installs use `.lingma`, and Antigravity global installs use `.gemini/antigravity`.

## Skills

After `OpenSuper init`, three groups of skills are installed to the selected platform's `skills/` directory:

When Chinese OpenSuper skills are installed, OpenSuper passes Chinese output requirements to the OpenSpec and Superpowers skills it invokes, so workflow document prose defaults to Chinese. Installing English skills applies the corresponding English default.

### OpenSuper Skills

<details>
<summary>View OpenSuper skills</summary>

| Skill            | Description                                                    |
|------------------|----------------------------------------------------------------|
| `/OpenSuper`         | Main entry — auto-detects phase and dispatches to sub-commands |
| `/OpenSuper-open`    | Phase 1: Open a change (proposal, design, task breakdown)      |
| `/OpenSuper-design`  | Phase 2: Deep design (brainstorming, Design Doc)               |
| `/OpenSuper-build`   | Phase 3: Plan and build (implementation plan, code commits)    |
| `/OpenSuper-verify`  | Phase 4: Verify and finish (testing, verification report)      |
| `/OpenSuper-archive` | Phase 5: Archive (delta spec sync, status annotation)          |
| `/OpenSuper-hotfix`  | Preset: Quick bug fix (skips brainstorming)                    |
| `/OpenSuper-tweak`   | Preset: Small change (skips brainstorming and full plan)       |

</details>

### Guard & Automation Scripts

<details>
<summary>View script list</summary>

| Script                   | Purpose                                                                                                                           |
|--------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| `OpenSuper-env.sh`           | Script discovery helper — exports bundled script paths such as `OpenSuper_GUARD`, `OpenSuper_STATE`, `OpenSuper_HANDOFF`, and `OpenSuper_ARCHIVE` |
| `OpenSuper-guard.sh`         | Phase transition guard — validates exit conditions, `--apply` auto-updates `.OpenSuper.yaml`                                          |
| `OpenSuper-handoff.sh`       | Design handoff — generates deterministic context packages from OpenSpec artifacts with SHA256 tracing                             |
| `opensuper-opentest-gate.sh` | OpenTest gate entrypoint — locates change state/report and invokes the shared adapter                                            |
| `opensuper-opentest-gate.mjs` | OpenTest adapter — discovers the provider consumer, delegates strict semantic recomputation, and validates OpenSuper exception blocks |
| `OpenSuper-archive.sh`       | One-command archive — validates state, syncs specs, moves to archive, updates status                                              |
| `OpenSuper-yaml-validate.sh` | Schema validator — validates `.OpenSuper.yaml` structure and field values                                                             |
| `OpenSuper-hook-guard.sh`    | Phase write guard — PreToolUse hook, blocks file writes during open/design/archive phases                                         |
| `OpenSuper-state.sh`         | Unified state management — init/set/get/check/scale, agents' exclusive YAML interface                                             |

</details>

### OpenSpec Skills

Spec lifecycle management: propose, explore, sync, verify, archive, and more.

### Superpowers Skills

Development methodology: brainstorming, TDD, subagent-driven development, code review, plan writing, and more.

## Workflow

```
/OpenSuper
  ↓ auto-detect
/OpenSuper-open  -->  /OpenSuper-design  -->  /OpenSuper-build  -->  /OpenSuper-verify  -->  /OpenSuper-archive
(OpenSpec)         (Superpowers)       (Superpowers)       (Both)           (OpenSpec)

/OpenSuper-hotfix (preset path, skips brainstorming)
  open  -->  build  -->  verify  -->  archive

/OpenSuper-tweak (preset path, skips brainstorming and full plan)
  open  -->  lightweight build  -->  light verify  -->  archive
```

### Five Phases

| Phase              | Command          | Owner       | Artifacts                            |
|--------------------|------------------|-------------|--------------------------------------|
| 1. Open            | `/OpenSuper-open`    | OpenSpec    | proposal.md, design.md, tasks.md     |
| 2. Deep Design     | `/OpenSuper-design`  | Superpowers | Design Doc, delta spec               |
| 3. Plan & Build    | `/OpenSuper-build`   | Superpowers | Implementation plan, code commits    |
| 4. Verify & Finish | `/OpenSuper-verify`  | Both        | Verification report, branch handling |
| 5. Archive         | `/OpenSuper-archive` | OpenSpec    | delta→main spec sync, archive        |

### Core Principles

- **Brainstorming is non-skippable** — every change must go through deep design (except hotfix/tweak)
- **Delta specs are living documents** — freely editable during Phase 3, synced at archive
- **Keep tasks.md in sync** — check off each task as completed
- **Commit frequently** — one commit per task, message reflects design intent
- **Verify before archive** — `/OpenSuper-verify` must pass before `/OpenSuper-archive`

### State Management

OpenSuper uses a decoupled state architecture with separate YAML files:

| File             | Owner    | Purpose                                             |
|------------------|----------|-----------------------------------------------------|
| `.openspec.yaml` | OpenSpec | Spec lifecycle, change metadata                     |
| `.OpenSuper.yaml`    | OpenSuper    | Workflow phase, execution mode, verification status |

All states and execution phases are updated via scripts, and each phase verifies that tasks are truly complete before
advancing. Compared to storing complex state rules only in Skill text, this script-backed state machine gives OpenSuper more
reliable phase transitions, correct YAML, and easier breakpoint recovery; agents can read the current Spec situation
through OpenSuper's built-in commands.

<details>
<summary>View key .OpenSuper.yaml fields</summary>

**Key Fields in `.OpenSuper.yaml`:**

```yaml
workflow: full
auto_transition: true
phase: build
build_mode: subagent-driven-development
build_pause: null
isolation: branch
verify_mode: null
opentest_gate: required
opentest_strict_result: docs/opentest/reports/strict-verification.json
tdd_mode: null
subagent_dispatch: null
design_doc: docs/superpowers/specs/YYYY-MM-DD-topic-design.md
plan: docs/superpowers/plans/YYYY-MM-DD-feature.md
verify_result: pending
verification_report: null
branch_status: pending
verified_at: null
archive_confirmation: pending
archived: false
direct_override: false
build_command: null
verify_command: null
handoff_context: openspec/changes/<name>/.OpenSuper/handoff/design-context.json
handoff_hash: <sha256>
```

In full workflow, `build_mode`, `build_pause`, `isolation`, `verify_mode`, `tdd_mode`, and `subagent_dispatch` may
temporarily be `null`; `build_mode` and `isolation` must be resolved before `build → verify`. `opentest_gate` accepts only `required`, `not-applicable`, or the unquoted YAML literal `null`; only an absent field or unquoted `null` is legacy. Quoted `"null"`/`'null'`, empty/other values, and malformed/duplicate state fields block. With `required`, `opentest_strict_result` must be a canonical relative path inside the target project, and absolute, parent-traversing, or symlink-escaping paths are rejected. `auto_transition` controls automatic vs manual skill invocation after phase completion — see the [auto-transition reference](https://github.com/pzy560117/opensuper/blob/main/assets/skills/opensuper/reference/auto-transition.md). `build_pause` records an internal build-phase pause point:
`null` means no pause, while `plan-ready` means the plan has been generated and the user paused before choosing
isolation and execution mode. It is not an execution mode and must not be written into `build_mode`.
`verification_report` stays `null` until verification writes a report, and `verify-pass` requires that report to exist
plus `branch_status: handled`. Before a mutating archive, explicit user approval must be recorded through the `archive-confirm` transition as `archive_confirmation: confirmed`; direct phase writes are rejected unless `OPENSUPER_FORCE_PHASE=1` is intentionally used for state repair. Fields after `archived` in the example are optional or script-derived: `direct_override`
is only needed for full-workflow direct builds, project commands may be absent unless configured, and
`handoff_context` / `handoff_hash` are recorded by `OpenSuper-handoff.sh` before leaving design. Projects can configure
`build_command` / `verify_command` in the change or repo root, and guard will run those commands first and print failure
output.

</details>

### OpenTest Strict Quality Gate

OpenSuper and OpenTest remain independent packages: OpenTest produces quality evidence, while OpenSuper consumes it and owns `.opensuper.yaml`, verify/archive transitions, and archive. The shared runtime root is always the target project that installs both packages, never either package's source repository.

| `opentest_gate` | Behavior |
|-----------------|----------|
| `required` | Generate strict JSON first, then let the OpenSuper adapter delegate semantic recomputation to the OpenTest provider consumer |
| `not-applicable` | Allow only a structured, human-approved docs-only exception; no strict JSON is generated |
| Absent field / unquoted YAML literal `null` | Preserve the legacy workflow, but this is not `pass-contract` or fusion-complete; quoted `"null"`/`'null'`, empty, and other values block |

The order for `required` is fixed: after the final commit and OpenTest evidence update, run the producer from the target project, then run the OpenSuper verify guard:

```bash
opentest verify --strict --json --output docs/opentest/reports/strict-verification.json
```

The adapter discovers the provider consumer in this order: `OPENSUPER_OPENTEST_CONSUMER` → sibling installed `opentest` skill → `node_modules/@pzy560117/opentest/assets/skills/opentest/scripts/opentest-strict-result.mjs`. It does not trust the JSON `result` alone; it recomputes schema `1.x`, change/current `HEAD`, `state-evidence-v1`, in-project paths, roles, hashes, and `.pending` state. Each required gate check invokes the provider exactly once with a fixed 120-second timeout and 1 MiB output-buffer limit. Before and after that call it resolves the strict result and its `state_file` again, requiring canonical path identities plus original result/state bytes to remain unchanged. A missing consumer, result, or provider, timeout/overflow, call-time replacement/rewrite, and every non-zero producer/adapter/provider exit block.

The same gate protects all three terminal paths: verify/archive in `opensuper-guard.sh`, direct `opensuper-state.sh transition <change> verify-pass`, and the actual `opensuper-archive.sh` preflight before any irreversible archive work.

`risk-accepted` requires exactly one complete, non-empty, parseable delimited `OPENTEST_GATE_JSON` block in the OpenSuper verification report. Each entry must contain exactly one of `strict_finding_id` or `strict_key`, then map one-to-one to `reason`, `owner`, declarative real-human `accepted_by`, `impact_scope`, future ISO-8601 `expires_at`, and `recovery_path`. `accepted_by` does not authenticate identity; an agent/AI/system/automation/generic-role or placeholder value cannot self-approve. Expiry must be calendar-valid and may use `Z`/`±HH:MM` offsets plus variable-length fractional seconds. Critical, security, data-integrity, money/payment, and irreversible risks cannot be accepted. `not-applicable` also requires exactly one valid delimited block declaring `gate: "not-applicable"`, `scope: "docs-only"`, a reason, and declarative real-human approval. Empty/duplicate blocks, unmatched/extra delimiters, malformed JSON, prose, or `not-run` alone cannot pass.

`not-applicable` additionally requires `.opensuper.yaml` full immutable `base_ref` to resolve unchanged as an ancestor of current `HEAD`, then checks committed (`base_ref...HEAD`), staged, unstaged, and untracked paths. The allowlist is exact: `docs/` accepts only `.md/.txt/.rst/.adoc` and static `.png/.jpg/.jpeg/.gif/.svg/.webp`; the active or dated-archive current-change directory accepts only `.md`, `.openspec.yaml`, and `.opensuper.yaml`; outside those directories, only root ARCHITECTURE/README/CHANGELOG/CONTRIBUTING/LICENSE documents with no extension or `.md/.txt/.rst/.adoc` are accepted. JSON/YAML/MDX, scripts, nested Markdown, and every runtime/config path block. When an archive locator is `YYYY-MM-DD-<change>`, strict-result and machine-block `change_id` still compare against original `<change>`.

Keep evidence-ledger values literal in reports:

| Value | Meaning |
|-------|---------|
| `pass-contract` | OpenSuper successfully consumed the strict artifact through the provider consumer; may satisfy `required` |
| `pass-local` | Only OpenTest-local verification passed; the consumer has not accepted it and the gate is not satisfied |
| `not-run` | OpenTest did not run; only an approved docs-only `not-applicable` consumer exception may close this case |
| `deferred` | Evidence is postponed for handoff tracking only; cannot satisfy verify/archive or fusion-complete |

For recovery, never hand-edit strict JSON or bypass scripts. On `consumer not found`, install the target-project dependency or sibling skill, or correct `OPENSUPER_OPENTEST_CONSUMER`. For a missing result or stale Git/hash binding, rerun the strict producer from the target project. If the adjacent `.pending` exists, first confirm the producer has stopped and assess the output; remove the marker manually only when recovery is safe, and never overwrite it automatically.

### Reliability Features

OpenSuper ensures agent execution reliability through automated state transitions:

<details>
<summary>View reliability features</summary>

1. **Entry Verification** — Each phase validates preconditions before execution
    - Checks file existence, state consistency, and phase transitions
    - Outputs `[HARD STOP]` with actionable suggestions if validation fails

2. **Automated State Transitions** — `OpenSuper-guard.sh --apply` updates `.OpenSuper.yaml` automatically
    - All phase transitions (open → design/build → verify → archive) use `guard --apply`
    - No manual state editing required — eliminates write-verification errors
    - `OpenSuper-state.sh` is the agents' exclusive interface for state operations
    - Guard and archive scripts use `OpenSuper-state.sh` internally for state management

3. **Schema Validation** — `OpenSuper-yaml-validate.sh` ensures data integrity
    - Validates required and optional fields
    - Validates enum values, including `direct_override`
    - Validates `design_doc`, `plan`, and `handoff_context` paths exist, plus `handoff_hash` format
    - Detects unknown/typos fields

4. **Build Decision Enforcement** — Guard and state transitions both block skipped build choices
    - `isolation` must be `branch` or `worktree`
    - `build_mode` must be selected before leaving build
    - `build_pause: plan-ready` is a recoverable pause after plan generation, not a `build_mode`
    - Full workflow `build_mode: direct` requires `direct_override: true`

5. **Verification Evidence** — Guard enforces proof before phase advance
    - `verify-pass` transition requires `verification_report` pointing to an existing report file
    - `branch_status` must be `handled` before verify can pass
    - Guard checks `verification_report exists` and `branch_status=handled` as hard prerequisites
    - Prevents false phase advances when verification or branch handling was skipped

6. **OpenTest Gate Bypass Protection** — When selected, one adapter/provider consumer protects guard, direct `verify-pass`, and actual archive preflight
    - Strict evidence must match the current change, Git `HEAD`, artifact paths, and hashes
    - `required` never falls back to legacy results; missing consumer/provider/result or any non-zero exit blocks

7. **Archive Automation** — `OpenSuper-archive.sh` handles the full archive flow in one command
    - Enforces `archive_confirmation: confirmed`, then merges delta specs into main specs through OpenSpec
    - Annotates design doc and plan frontmatter
    - Moves change to archive directory and updates `archived: true`
    - Supports `--dry-run` for preview

8. **Cross-change Hook Routing** — when multiple active changes exist, writes inside a change use that change's phase; ambiguous source writes fail closed
    - Whitelists `openspec/*`, phase-eligible `docs/superpowers/*`, `.claude/*`, `.opensuper/*`, and `.superpowers/*`

</details>

## Project Structure

```
your-project/
├── .OpenSuper/
│   └── config.yaml              # Project-level global config (context_compression, auto_transition, etc.)
├── .claude/skills/              # Platform skills dir (OpenSuper + OpenSpec + Superpowers)
│   ├── OpenSuper/SKILL.md
│   │   └── scripts/
│   │       ├── OpenSuper-guard.sh       # Phase transition guard (--apply auto-updates state)
│   │       ├── OpenSuper-env.sh         # Script discovery helper
│   │       ├── OpenSuper-handoff.sh     # Design handoff (OpenSpec → Superpowers context tracing)
│   │       ├── opensuper-opentest-gate.sh # OpenTest gate shell entrypoint
│   │       ├── opensuper-opentest-gate.mjs # Provider-consumer adapter
│   │       ├── OpenSuper-archive.sh     # One-command archive automation
│   │       ├── OpenSuper-yaml-validate.sh # Schema validator
│   │       ├── OpenSuper-hook-guard.sh   # Phase write guard (PreToolUse hook)
│   │       └── OpenSuper-state.sh       # Unified state management (init/set/get/check/scale)
│   ├── OpenSuper-*/SKILL.md
│   ├── openspec-*/SKILL.md
│   └── brainstorming/SKILL.md
├── openspec/                    # OpenSpec — WHAT
│   ├── config.yaml
│   └── changes/
│       └── <name>/
│           ├── .openspec.yaml       # OpenSpec state
│           ├── .OpenSuper.yaml          # OpenSuper workflow state (decoupled)
│           ├── proposal.md
│           ├── design.md
│           ├── specs/<capability>/spec.md
│           └── tasks.md
├── docs/opentest/               # OpenTest — target-owned ledgers, reports, strict JSON, and evidence
└── docs/superpowers/            # Superpowers — HOW
    ├── specs/                   # Design documents
    ├── plans/                   # Implementation plans
    └── reports/                 # OpenSuper verification reports with gate links/structured exceptions
```

<details>
<summary>Context Compression (Beta)</summary>

OpenSuper supports context compression at the Design → Build handoff. When enabled, `OpenSuper-handoff.sh` generates a compact
context package that reduces Build-phase input tokens by **25–30%** without affecting implementation correctness.

| Mode   | Behavior                                 | Token Savings |
|--------|------------------------------------------|---------------|
| `off`  | Full Spec excerpts in handoff context    | Baseline      |
| `beta` | Design Doc + SHA256 hash references only | ~25–30%       |

Key findings from benchmark testing:

- **Test pass rate**: 100% across all tiers (compression does not affect correctness)
- **Spec coverage**: 100% (off) vs 95% (beta) — minor edge-case detail loss
- **Scaling**: Larger tasks yield higher absolute savings (up to 15,000 tokens for large-tier tasks)

Enable in `.OpenSuper/config.yaml`: `context_compression: beta`

Run `pnpm benchmark:context` from a source checkout to reproduce the benchmark.

</details>

<details>
<summary>Auto Transition</summary>

`auto_transition` controls whether OpenSuper automatically invokes the next skill after a phase completes, or pauses for
manual handoff. Phase advancement itself always happens — this setting only affects skill invocation.

| Value  | Behavior |
|--------|----------|
| `true` | Auto-invoke the next skill after each phase (default) |
| `false` | Pause after each phase; user manually triggers the next skill |

Three-layer configuration with precedence: `OpenSuper_AUTO_TRANSITION` env var > `.OpenSuper/config.yaml` (project) > `.OpenSuper.yaml` (change).

See the [auto-transition reference](https://github.com/pzy560117/opensuper/blob/main/assets/skills/opensuper/reference/auto-transition.md) for configuration details, workflow mapping, and FAQ.

</details>

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) | [中文版](CONTRIBUTING-zh.md) for development setup, commit
conventions, PR process, branch workflow, and guidance for adding platforms,
skills, scripts, or changelog entries.

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.

## Roadmap

Track release plans and open work in the [OpenSuper issues](https://github.com/pzy560117/opensuper/issues).

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=pzy560117/opensuper&type=Date)](https://star-history.com/#pzy560117/opensuper&Date)

## Contributors

<a href="https://github.com/pzy560117/opensuper/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=pzy560117/opensuper&columns=12&anon=1" />
</a>

## License

[MIT](LICENSE)

## Reference

[LINUX DO - 新的理想型社区](https://linux.do/)
