<p align="center">
  <a href="https://github.com/pzy560117/opensuper/blob/main/img/title-log.png">
    <picture>
      <source srcset="https://github.com/pzy560117/opensuper/blob/main/img/title-log.png">
      <img src="https://github.com/pzy560117/opensuper/blob/main/img/title-log.png" alt="OpenSuper logo">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://github.com/pzy560117/opensuper/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/pzy560117/opensuper/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="https://www.npmjs.com/package/@pzy560117/opensuper"><img alt="npm version" src="https://img.shields.io/npm/v/%40pzy560117%2Fopensuper?style=flat-square" /></a>
  <a href="https://www.npmjs.com/package/@pzy560117/opensuper"><img alt="npm download count" src="https://img.shields.io/npm/dm/%40pzy560117%2Fopensuper?style=flat-square&label=Downloads/mo" /></a>
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
> [B站视频介绍 ](https://www.bilibili.com/video/BV1y4Gi6CEo1/?spm_id_from=333.1387.homepage.video_card.click&vd_source=d22726fe6b108647dbebf1c5d8817377)

**OpenSpec + Superpowers dual-star development workflow** — one command from idea to archive.

OpenSpec handles **WHAT** (outlines, proposals, spec lifecycle, archiving). Superpowers handles **HOW** (technical design, planning, execution, wrap-up). OpenSuper chains both into a five-phase automated pipeline.

## Why OpenSuper

OpenSpec excels at managing requirements, creating proposals, managing Spec lifecycles, and archiving, but its proposals and tasks lack the detail of Superpowers brainstorming.

Superpowers generates Spec documents after brainstorming, but these documents typically lack stateful design — after completing requirements, Specs only have tasks checked off in the document, and Agents even forget to check them off. This causes the Agent to re-examine documents and project code to verify on resumption, wasting many tokens.

**OpenSuper combines the strengths of both**, integrating the core workflow into 5 phases

The main entry `/opensuper` supports current Spec state detection, suitable for long tasks — after completing and closing CC midway, just `/opensuper continue` and OpenSuper will automatically read the active Spec (lists multiple for selection), dynamically identify which phase is currently executing, and continue.

## Install

```bash
npm install -g @pzy560117/opensuper
```

## Quick Start

```bash
cd your-project
opensuper init
```

`opensuper init` will:

1. Prompt you to select AI platforms (auto-detects existing configs)
2. Choose install scope: project-level (current directory) or global (home directory)
3. Select language for OpenSuper skills: English or 中文
4. Install [OpenSpec](https://github.com/Fission-AI/OpenSpec) skills
5. Install [Superpowers](https://github.com/obra/superpowers) skills
6. Deploy OpenSuper skills (in your chosen language) to selected platforms
7. Create `docs/superpowers/specs/` and `docs/superpowers/plans/` working directories

> [!TIP]
> update version
>
> `opensuper update` or `npm install -g @pzy560117/opensuper@latest` to get the latest features and fixes.

## Screenshots

<p align="center">
  <img src="https://github.com/pzy560117/opensuper/blob/main/img/runner.png" alt="runner">
</p>

<p align="center">Auto-install OpenSpec & Superpowers, one-click dev environment setup</p>
<p align="center">Multi-phase Skill entry, auto-detects current Spec stage, auto-triggers core flow, manual review at key nodes</p>

## Commands

| Command | Description |
|---------|-------------|
| `opensuper init [path]` | Initialize OpenSuper workflow |
| `opensuper status [path]` | Show active changes, task progress, and next workflow command |
| `opensuper doctor [path]` | Diagnose project/global OpenSuper installation health |
| `opensuper update [path]` | Update the npm package and installed OpenSuper skills |
| `opensuper --help` | Show help |
| `opensuper --version` | Show version |

### init Options

| Option | Description |
|--------|-------------|
| `--yes` | Non-interactive mode, auto-select detected platforms |
| `--skip-existing` | Skip already installed components |
| `--overwrite` | Overwrite already installed components |
| `--json` | Output structured JSON |

When multiple existing components are found on the same platform, interactive init offers one bulk choice: overwrite all, skip all, or choose per component.

### status Options

| Option | Description |
|--------|-------------|
| `--json` | Output active changes with `nextCommand` |

### doctor Options

| Option | Description |
|--------|-------------|
| `--json` | Output structured diagnostic results |
| `--scope <scope>` | Diagnose `auto`, `project`, or `global` scope (default: `auto`) |

### update Options

| Option | Description |
|--------|-------------|
| `--json` | Output npm and skill update results as JSON |
| `--language <lang>` | Override detected skill language (`en`, `zh`) |
| `--scope <scope>` | Update only `global` or `project` scope |

## Supported Platforms

`opensuper init` supports 28 AI coding platforms:

| Platform | Skills Dir | Platform | Skills Dir |
|----------|-----------|----------|-----------|
| Claude Code | `.claude/` | Cursor | `.cursor/` |
| Codex | `.codex/` | OpenCode | `.opencode/` |
| Windsurf | `.windsurf/` | Cline | `.cline/` |
| RooCode | `.roo/` | Continue | `.continue/` |
| GitHub Copilot | `.github/` | Gemini CLI | `.gemini/` |
| Amazon Q Developer | `.amazonq/` | Qwen Code | `.qwen/` |
| Kilo Code | `.kilocode/` | Auggie | `.augment/` |
| Kiro | `.kiro/` | Lingma | `.lingma/` |
| Junie | `.junie/` | CodeBuddy | `.codebuddy/` |
| CoStrict | `.cospec/` | Crush | `.crush/` |
| Factory Droid | `.factory/` | iFlow | `.iflow/` |
| Pi | `.pi/` | Qoder | `.qoder/` |
| Antigravity | `.agent/` | Bob Shell | `.bob/` |
| ForgeCode | `.forge/` | Trae | `.trae/` |

## Skills

After `opensuper init`, three groups of skills are installed to the selected platform's `skills/` directory:

### OpenSuper Skills

| Skill | Description |
|-------|-------------|
| `/opensuper` | Main entry — auto-detects phase and dispatches to sub-commands |
| `/opensuper-open` | Phase 1: Open a change (proposal, design, task breakdown) |
| `/opensuper-design` | Phase 2: Deep design (brainstorming, Design Doc) |
| `/opensuper-build` | Phase 3: Plan and build (implementation plan, code commits) |
| `/opensuper-verify` | Phase 4: Verify and finish (testing, verification report) |
| `/opensuper-archive` | Phase 5: Archive (delta spec sync, status annotation) |
| `/opensuper-hotfix` | Preset: Quick bug fix (skips brainstorming) |
| `/opensuper-tweak` | Preset: Small change (skips brainstorming and full plan) |

### Guard & Automation Scripts

| Script | Purpose |
|--------|---------|
| `opensuper-guard.sh` | Phase transition guard — validates exit conditions, `--apply` auto-updates `.opensuper.yaml` |
| `opensuper-archive.sh` | One-command archive — validates state, syncs specs, moves to archive, updates status |
| `opensuper-yaml-validate.sh` | Schema validator — validates `.opensuper.yaml` structure and field values |
| `opensuper-state.sh` | Unified state management — init/set/get/check/scale, agents' exclusive YAML interface |

### OpenSpec Skills

Spec lifecycle management: propose, explore, sync, verify, archive, and more.

### Superpowers Skills

Development methodology: brainstorming, TDD, subagent-driven development, code review, plan writing, and more.

## Workflow

```
/opensuper
  ↓ auto-detect
/opensuper-open  -->  /opensuper-design  -->  /opensuper-build  -->  /opensuper-verify  -->  /opensuper-archive
(OpenSpec)         (Superpowers)       (Superpowers)       (Both)           (OpenSpec)

/opensuper-hotfix (preset path, skips brainstorming)
  open  -->  build  -->  verify  -->  archive

/opensuper-tweak (preset path, skips brainstorming and full plan)
  open  -->  lightweight build  -->  light verify  -->  archive
```

### Five Phases

| Phase | Command | Owner | Artifacts |
|-------|---------|-------|-----------|
| 1. Open | `/opensuper-open` | OpenSpec | proposal.md, design.md, tasks.md |
| 2. Deep Design | `/opensuper-design` | Superpowers | Design Doc, delta spec |
| 3. Plan & Build | `/opensuper-build` | Superpowers | Implementation plan, code commits |
| 4. Verify & Finish | `/opensuper-verify` | Both | Verification report, branch handling |
| 5. Archive | `/opensuper-archive` | OpenSpec | delta→main spec sync, archive |

### Core Principles

- **Brainstorming is non-skippable** — every change must go through deep design (except hotfix/tweak)
- **Delta specs are living documents** — freely editable during Phase 3, synced at archive
- **Keep tasks.md in sync** — check off each task as completed
- **Commit frequently** — one commit per task, message reflects design intent
- **Verify before archive** — `/opensuper-verify` must pass before `/opensuper-archive`

### State Management

OpenSuper uses a decoupled state architecture with separate YAML files:

| File | Owner | Purpose |
|------|-------|---------|
| `.openspec.yaml` | OpenSpec | Spec lifecycle, change metadata |
| `.opensuper.yaml` | OpenSuper | Workflow phase, execution mode, verification status |

**Key Fields in `.opensuper.yaml`:**

```yaml
workflow: full
phase: build
design_doc: docs/superpowers/specs/YYYY-MM-DD-topic-design.md
plan: docs/superpowers/plans/YYYY-MM-DD-feature.md
build_mode: subagent-driven-development
isolation: branch
verify_mode: light
verify_result: pending
verification_report: docs/superpowers/reports/YYYY-MM-DD-change-verify.md
branch_status: pending
verified_at: null
archived: false
```

In full workflow, `build_mode` and `isolation` may temporarily be `null` at init time, but they must be resolved before `build → verify`. `direct` is allowed by default only for hotfix/tweak; full workflow requires `direct_override: true`. Projects can configure `build_command` / `verify_command` in the change or repo root, and guard will run those commands first and print failure output.

All states and execution phases are updated via scripts, and **each phase verifies that tasks are truly completed before exiting — conditions are met before the phase exits and state is updated**. Compared to recording complex state management mechanisms in Skills, the script approach strongly guarantees the reliability of core state transitions, correctness of YAML files, and convenience of breakpoint recovery — Agents only need to use OpenSuper's built-in commands to read state and know the current Spec's situation.

### Reliability Features

OpenSuper ensures agent execution reliability through automated state transitions:

1. **Entry Verification** — Each phase validates preconditions before execution
   - Checks file existence, state consistency, and phase transitions
   - Outputs `[HARD STOP]` with actionable suggestions if validation fails

2. **Automated State Transitions** — `opensuper-guard.sh --apply` updates `.opensuper.yaml` automatically
   - All phase transitions (design → build → verify → archive) use `guard --apply`
   - No manual state editing required — eliminates write-verification errors
   - `opensuper-state.sh` is the agents' exclusive interface for state operations
   - Guard and archive scripts use `opensuper-state.sh` internally for state management

3. **Schema Validation** — `opensuper-yaml-validate.sh` ensures data integrity
   - Validates required and optional fields
   - Validates enum values, including `direct_override`
   - Validates referenced file paths exist
   - Detects unknown/typos fields

4. **Build Decision Enforcement** — Guard and state transitions both block skipped build choices
   - `isolation` must be `branch` or `worktree`
   - `build_mode` must be selected before leaving build
   - Full workflow `build_mode: direct` requires `direct_override: true`

5. **Verification Evidence** — Guard enforces proof before phase advance
   - `verify-pass` transition requires `verification_report` pointing to an existing report file
   - `branch_status` must be `handled` before verify can pass
   - Guard checks `verification_report exists` and `branch_status=handled` as hard prerequisites
   - Prevents false phase advances when verification or branch handling was skipped

6. **Archive Automation** — `opensuper-archive.sh` handles the full archive flow in one command
   - Validates entry state, syncs delta specs to main specs
   - Annotates design doc and plan frontmatter
   - Moves change to archive directory and updates `archived: true`
   - Supports `--dry-run` for preview

**Security**: Path traversal protection on all change name inputs

## Project Structure

```
your-project/
├── .claude/skills/              # Platform skills dir (OpenSuper + OpenSpec + Superpowers)
│   ├── opensuper/SKILL.md
│   │   └── scripts/
│   │       ├── opensuper-guard.sh       # Phase transition guard (--apply auto-updates state)
│   │       ├── opensuper-archive.sh     # One-command archive automation
│   │       ├── opensuper-yaml-validate.sh # Schema validator
│   │       └── opensuper-state.sh       # Unified state management (init/set/get/check/scale)
│   ├── opensuper-*/SKILL.md
│   ├── openspec-*/SKILL.md
│   └── brainstorming/SKILL.md
├── openspec/                    # OpenSpec — WHAT
│   ├── config.yaml
│   └── changes/
│       └── <name>/
│           ├── .openspec.yaml       # OpenSpec state
│           ├── .opensuper.yaml          # OpenSuper workflow state (decoupled)
│           ├── proposal.md
│           ├── design.md
│           ├── specs/<capability>/spec.md
│           └── tasks.md
└── docs/superpowers/            # Superpowers — HOW
    ├── specs/                   # Design documents
    └── plans/                   # Implementation plans
```

## What You'll Learn

Many excellent Skill projects exist in the current Skill market, but they generally have preference issues — users may only like some features. For example, when using both OpenSpec and Superpowers, one might only use OpenSpec's Spec management capabilities, but prefer Superpowers' TDD-driven approach for coding.

Long-term Skill users know these capabilities can be freely combined, but exactly how to do so still requires real practice. The OpenSuper project can serve as a reference:

- **How to reliably trigger nested Skills** — Not letting the Agent rely on document descriptions to perform "look-alike Skill trigger" operations (like writing files based on Skill descriptions), but truly triggering Skills (key feature: Skill trigger prints on CC). OpenSuper will trigger many capabilities from OpenSpec and Superpowers — how is this Prompt written?

- **How to make combined Skills multi-phase auto-flow** — Not relying on manual intervention. OpenSuper's 5-phase flow automatically triggers Skills for core processes except necessary user selections, while the **state machine mechanism** also ensures state transition reliability.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, commit conventions, PR process, and guidance for adding platforms or skills.

```bash
# Clone
git clone https://github.com/pzy560117/opensuper
cd opensuper

# Install dependencies
pnpm install

# Dev mode (watch)
pnpm dev

# Build
pnpm build

# Test (unit + coverage)
pnpm test
pnpm test:coverage
pnpm test:shell         # bats shell tests

# Lint & format
pnpm lint
pnpm format
```

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.

## Security

- Pre-publish scan for API keys, secrets, tokens, and private keys
- `.npmignore` prevents source code and config files from entering the npm package
- `.gitignore` covers secrets, credentials, IDE configs, and more

## License

[MIT](LICENSE.md)

## Reference
[LINUX DO - 新的理想型社区](https://linux.do/)
