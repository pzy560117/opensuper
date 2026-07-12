---
name: opensuper-build
description: "opensuper Phase 3: Plan and Build. Invoke with /opensuper-build. Create plans and select execution method (subagent or direct) for implementation."
---

# opensuper Phase 3: Plan and Build (Build)

## Output Language Contract

- Output language: English.
- This skill writes all user-facing responses and generated documents in English by default, including `proposal.md`, `design.md`, `tasks.md`, delta specs, Design Docs, Plans, verification reports, and archive notes.
- Keep commands, paths, frontmatter keys, code identifiers, package names, and API names in their original form.
- Use another prose language only when the user explicitly requests it.

## Prerequisites

- Design Doc has been created (Phase 2 complete)
- Active change exists

## Steps

### 0. Entry State Verification (Entry Check)

Execute entry verification:

```bash
opensuper_ENV="${opensuper_ENV:-$(find . "$HOME"/.*/skills "$HOME/.config" "$HOME/.gemini" -path '*/opensuper/scripts/opensuper-env.sh' -type f -print -quit 2>/dev/null)}"
if [ -z "$opensuper_ENV" ]; then
  echo "ERROR: opensuper-env.sh not found. Ensure the opensuper skill is installed." >&2
  return 1
fi
. "$opensuper_ENV"
"$opensuper_BASH" "$opensuper_STATE" check <name> build
```

Proceed to Step 1 after verification passes. The script outputs specific failure reasons when verification fails.

**Idempotency**: All build phase operations can be safely re-executed. Read `.opensuper.yaml` `phase` field to confirm still in build, read plan header `base-ref`, then use `grep -n '\- \[ \]' tasks.md | head -1` to find the first unchecked task. Already-committed tasks must not be re-committed.

### 1. Create Plan (Subagent Offload)

Create the implementation plan through a subagent, avoiding planning skill occupying main session context. Plan files and execution feedback must use the language of the user request that triggered this workflow.

**Subagent instructions**:

You are an implementation planning expert. Create an implementation plan based on the following inputs:

1. **Immediately execute:** Use the Skill tool to load the Superpowers `writing-plans` skill. Skipping this step is prohibited. After the skill loads, ARGUMENTS must include: `Language: Use the language of the user request that triggered this workflow` and `Output language: English`.
2. Read the Design Doc (technical design document under `docs/superpowers/specs/`)
3. Read `openspec/changes/<name>/tasks.md` (task boundaries)
4. Follow the skill's guidance to create the plan

Plan requirements:
- Save to `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`
- Reference design document, break down into executable tasks
- Plan prose must be written in English; frontmatter keys, paths, commands, and code identifiers stay in their original form
- **Plan file header must contain associated metadata**:

```yaml
---
change: <openspec-change-name>
design-doc: docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md
base-ref: <git rev-parse HEAD before implementation>
---
```

`base-ref` is used during verification to measure committed changes across the full implementation range. Record the current commit when creating the plan:

```bash
git rev-parse HEAD
```

Write the plan to file, then return the file path.

**Execute subagent**: Use the current platform's subagent dispatch mechanism to send the above task.

After the subagent completes:
- If a valid file path is returned and the file exists, record it as the plan
- If the subagent fails or returns an invalid path, fall back to loading the Superpowers `writing-plans` skill inline in the main session (degraded fallback)

### 2. Update Plan Status and Provide Plan-Ready Pause Point

Record plan path:

```bash
"$opensuper_BASH" "$opensuper_STATE" set <name> plan docs/superpowers/plans/YYYY-MM-DD-feature.md
```

No manual phase update needed — guard auto-transitions when exit conditions are met.

After the plan is recorded, immediately provide a new user decision point:

| Option | Behavior | Description |
|--------|----------|-------------|
| A | Continue execution | Stay in the current model and proceed to Step 3 to choose workspace isolation and execution method |
| B | Pause to switch model | Record `build_pause: plan-ready`, stop this `/opensuper-build` invocation, and allow the user to resume later from `/opensuper` or `/opensuper-build` |

This is a user decision point. **Must follow the `opensuper/reference/decision-point.md` protocol to pause and wait for the user to explicitly choose**. Must not auto-continue and must not write the pause into `build_mode`.

When the user chooses to continue:

```bash
"$opensuper_BASH" "$opensuper_STATE" set <name> build_pause null
```

When the user chooses to pause:

```bash
"$opensuper_BASH" "$opensuper_STATE" set <name> build_pause plan-ready
```

After setting `build_pause: plan-ready`, stop the current invocation. Do not choose `isolation` or `build_mode`, and do not load an execution skill.

### 3. Select Workflow Configuration

If resuming with `build_pause: plan-ready` and the `plan` file exists, do not rerun `writing-plans`. First tell the user the workflow is stopped at the plan-ready pause point; after the user confirms continuing, set:

```bash
"$opensuper_BASH" "$opensuper_STATE" set <name> build_pause null
```

Then continue this step to choose workspace isolation and execution method.

Plan has been written to the current branch. Before starting execution, **ask the user to choose both workspace isolation and execution method in a single interaction**:

**Workspace Isolation**:

| Option | Method | Description |
|--------|--------|-------------|
| A | Create branch | Create a new branch in the current repo, simple and fast |
| B | Create Worktree | Isolated workspace, fully independent, suitable for parallel development |

**Recommendation rules**:
- Change involves ≤ 3 files → Recommend A
- Need parallel development, current branch has uncommitted work → Recommend B

**Execution Method**:

| Option | Skill | Applicable Scenario |
|------|------|-------------------|
| A | Superpowers `subagent-driven-development` | Independent tasks, high complexity, requires two-phase review |
| B | Superpowers `executing-plans` | Simple tasks, no subagent environment, lightweight and fast |

**Execution method recommendation rules**:
- Task count ≥ 3 → Recommend A
- Task count ≤ 2 and no cross-module dependencies → Recommend B
- From hotfix path → Recommend B

This is a user decision point. **Must follow the `opensuper/reference/decision-point.md` protocol to pause and wait for the user to explicitly choose isolation method, execution method, and TDD mode**. Must not choose `branch` or `worktree` based on recommendation rules, and must not choose the execution method or TDD mode based on recommendation rules. Recommendation rules are for suggestion only, not a substitute for user confirmation.

After user selection, update `isolation`, execution method, and TDD mode fields:

```bash
"$opensuper_BASH" "$opensuper_STATE" set <name> isolation <branch|worktree>
```

- If the user chooses `executing-plans`: run `"$opensuper_BASH" "$opensuper_STATE" set <name> subagent_dispatch null`, then run `"$opensuper_BASH" "$opensuper_STATE" set <name> build_mode executing-plans`
- If the user chooses `subagent-driven-development`: first confirm the current platform has real background subagent / Task / multi-agent dispatch capability; after confirming, run `"$opensuper_BASH" "$opensuper_STATE" set <name> subagent_dispatch confirmed`, then run `"$opensuper_BASH" "$opensuper_STATE" set <name> build_mode subagent-driven-development`
- If real background dispatch capability cannot be confirmed, must not write `build_mode: subagent-driven-development`; must pause and wait for the user to choose `executing-plans` instead

**TDD Mode**:

| Option | Meaning | Applicable Scenario |
|--------|---------|---------------------|
| `tdd` | Write a failing test first for each task, then implement | Recommended. Changes involving business logic, new features, APIs |
| `direct` | Implement directly, no enforced TDD flow | Changes that don't need test coverage, or user chooses to skip tests and write code directly. hotfix/tweak presets default to `direct` |

Run `"$opensuper_BASH" "$opensuper_STATE" set <name> tdd_mode <tdd|direct>`

`isolation` is a script-enforced hard constraint. Full workflow init may temporarily leave it as `null`, but only before this step. If it remains `null`, both the `build → verify` guard and `opensuper-state transition build-complete` will fail.

`subagent_dispatch` is a script-enforced hard constraint. `build_mode: subagent-driven-development` requires `subagent_dispatch: confirmed` before leaving the build phase, otherwise both `opensuper-guard.sh build --apply` and `opensuper-state transition build-complete` will fail.

`tdd_mode` is a script-enforced hard constraint. Full workflow must have `tdd_mode` selected as `tdd` or `direct` before leaving the build phase, otherwise both `opensuper-guard.sh build --apply` and `opensuper-state transition build-complete` will fail.

`build_mode` defaults to `direct` only for hotfix/tweak presets. Full workflow must not default to `direct`. Use it only when the user explicitly asks to bypass the plan execution skills and you record an explicit override:

```bash
"$opensuper_BASH" "$opensuper_STATE" set <name> direct_override true
"$opensuper_BASH" "$opensuper_STATE" set <name> build_mode direct
```

Without `direct_override: true`, `build_mode=direct` in full workflow is blocked by both guard and state transition.

**Execute isolation**:

- **branch**: Recommend a branch name based on the workflow type and current date, then let the user confirm or input a custom name. This is a user decision point — **must use the current platform's available user input/confirmation mechanism to pause and wait for the user to explicitly confirm or override the branch name**. Must not skip this step and create the branch directly.

  Branch naming convention:
  - Read the `workflow` field from `.opensuper.yaml` to determine the prefix
  - `workflow: full` → recommend `feature/YYYYMMDD/<change-name>`
  - `workflow: hotfix` → recommend `hotfix/YYYYMMDD/<change-name>`
  - `workflow: tweak` → recommend `tweak/YYYYMMDD/<change-name>`
  - Date is derived from `date +%Y%m%d` at runtime

  Example: if change name is `fix-login-bug` and today is 2026-06-09, recommend `feature/20260609/fix-login-bug`

  After the user confirms or provides a custom branch name, run `git checkout -b <branch-name>`, subsequent work on the new branch.

- **worktree**: Must use the Skill tool to load the Superpowers `using-git-worktrees` skill to create isolated workspace. Do not bypass this skill with plain shell commands or native tools; if the skill is unavailable, stop the process and prompt to install or enable Superpowers skills.

After creating isolation, confirm plan file is accessible (naturally accessible with branch method; for worktree method, confirm plan has been committed). If the plan file has not been committed under worktree mode, commit it first before creating the worktree:

```bash
git add docs/superpowers/plans/YYYY-MM-DD-feature.md
git commit -m "chore: add implementation plan"
```

**Execute plan**: Must handle execution according to the actual runtime of `build_mode`.

- `build_mode: executing-plans`: **Immediately execute:** Use the Skill tool to load the Superpowers `executing-plans` skill. Skipping this step is prohibited. If the skill is unavailable, stop the process and prompt to install or enable the corresponding skill; do not substitute with normal conversation. After the skill loads, ARGUMENTS must include the same Language constraint as Step 1: `Language: Use the language of the user request that triggered this workflow` and `Output language: English`. Execute according to plan.
- `build_mode: subagent-driven-development`: The main session only coordinates and must not write implementation code directly. **Immediately execute:** Use the Skill tool to load the Superpowers `subagent-driven-development` skill. After the skill loads, read `opensuper/reference/subagent-dispatch.md` for opensuper-specific extensions (real background dispatch, task isolation, checkoff verification, TDD constraints, continuous execution, context recovery) and apply them alongside the skill's workflow. If they conflict, the more specific opensuper extensions take precedence.
- If the current platform has no real background agent dispatch capability, must pause and wait for the user to choose main window execution instead. After the user chooses, must run `"$opensuper_BASH" "$opensuper_STATE" set <name> build_mode executing-plans`, then follow the `build_mode: executing-plans` branch to load the Superpowers `executing-plans` skill. Must not continue executing tasks before the user explicitly chooses.

**TDD Mode Execution Constraints**:

If `tdd_mode: tdd`:
- `build_mode: executing-plans`: After loading the execution skill and before executing the first task, **Immediately execute:** Use the Skill tool to load the Superpowers `test-driven-development` skill once. Skipping this step is prohibited. After the skill loads, start from the first unchecked task and follow the loaded TDD Red-Green-Refactor cycle for each task. Must not skip the failing test verification phase. Do not reload this skill for subsequent tasks; follow the already-loaded flow. If resuming after context compaction, re-run this step to load the TDD skill once, then continue from the first unchecked task.
- `build_mode: subagent-driven-development`: The main session does not load the TDD skill. TDD constraints and evidence thresholds are defined in `opensuper/reference/subagent-dispatch.md`; every background implementer and fix agent must use the Skill tool to load the Superpowers `test-driven-development` skill and follow the opensuper-injected TDD hard constraint.

If `tdd_mode: direct`: Follow normal flow, no enforced TDD.

**`executing-plans` review gate**:

When `build_mode` is `executing-plans`, after all planned tasks are complete and before running the build → verify phase guard, must use the Skill tool to load the Superpowers `requesting-code-review` skill and request code review at least once.

Requirements:
- the `requesting-code-review` skill must be loaded before `"$opensuper_BASH" "$opensuper_GUARD" <change-name> build --apply`
- if `requesting-code-review` skill is unavailable, skip the review gate but must record `<!-- review skipped: skill unavailable -->` in tasks.md, then continue guard transition
- CRITICAL review findings (security vulnerabilities, data loss risk, build/test failures) must be fixed first and must not be carried into verify
- if non-CRITICAL review findings are accepted, record the acceptance reason and impact scope in tasks.md, the commit body, a verification report draft, or another durable artifact

### 3b. In-Execution Debugging (Debug Gate)

During task execution, whenever a crash, unexpected behavior, test failure, or build failure appears while running the program, tests, build, or manual verification, must use the Skill tool to load the Superpowers `systematic-debugging` skill. Before root-cause investigation is complete, must not propose or implement source-code fixes.

For specific investigation, minimal failing test, fix verification, and keeping the current change verification loop, follow `opensuper/reference/debug-gate.md`.

### 4. Spec Incremental Updates

When the initial spec is found incomplete during implementation, handle by scale:

| Scale | Trigger Conditions | Approach |
|------|-------------------|----------|
| Small | Missing acceptance scenarios, edge cases | Directly edit delta spec + design.md, append tasks.md tasks |
| Medium | Interface changes, new components, data flow changes | **Must use the current platform's available user input/confirmation mechanism to pause and wait for the user to explicitly confirm**, then must use Skill tool to load the Superpowers `brainstorming` skill to update Design Doc + delta spec |
| Large | Brand-new capability requirements | **Must use the current platform's available user input/confirmation mechanism to pause and wait for the user to explicitly confirm the split**; after user confirms, create independent change through `/opensuper-open` |

**50% Threshold Determination**: Using initial task count in tasks.md as baseline, if new tasks exceed half of that total, it's considered outside original plan scope, **must follow the `opensuper/reference/decision-point.md` protocol to pause and wait for the user to decide whether to split into a new change**.

When creating an independent change, must invoke `/opensuper-open`, not `/opsx:new` directly. `/opensuper-open` creates both OpenSpec artifacts and `.opensuper.yaml`, preventing the new change from leaving the opensuper state machine.

**User choices must include**:
- "Split into new change" — create independent change via `/opensuper-open`
- "Continue in current change" — record scope-expansion decision, update tasks.md and delta spec, then continue

**Principles**:
- Delta spec is a living document, can be modified at any time during this phase
- Each update should be committed with commit message explaining the change reason
- Do not sync to main spec in advance, sync uniformly during archiving
- For small-scale incremental direct delta spec edits, note in commit message to facilitate design doc drift assessment during archiving

### 4b. Prepare OpenTest Strict Evidence (When Selected)

OpenTest is an independent quality-evidence producer. It does not replace this phase's TDD, build, tests, or review gate. All state and evidence must live in the target project that installs both OpenSuper and OpenTest.

- `opentest_gate: required`: `opentest_strict_result` must be a non-empty canonical project-relative path. After the final implementation commit and after the OpenTest ledger, matrix, report, and evidence are current, generate the strict artifact first in the target project:

```bash
OPENTEST_RESULT=$("$opensuper_BASH" "$opensuper_STATE" get <change-name> opentest_strict_result)
opentest verify --strict --json --output "$OPENTEST_RESULT"
```

  The producer must exit 0. This is at most `pass-local`; record `pass-contract` only after the verify phase lets OpenSuper's shipped adapter invoke the OpenTest provider consumer for semantic recomputation. Each required gate check invokes the provider exactly once with a fixed 120-second timeout and 1 MiB output-buffer limit; before and after the call it resolves the strict result and its `state_file` again, comparing canonical path identities plus result text/state raw bytes. Strict JSON binds current Git `HEAD` and evidence hashes; regenerate after every later commit or evidence change, and never hand-edit JSON. If the producer returns `risk-accepted`, exit 0 still does not pass the gate: verify must obtain human approval and write exactly one valid `OPENTEST_GATE_JSON`, with each entry containing exactly one of `strict_finding_id`/`strict_key`. `accepted_by` is a declarative real-human identity; agents/AIs/placeholders cannot self-approve. `expires_at` must be future, calendar-valid ISO-8601 (offsets and variable-length fractional seconds are allowed), while critical/security/data-integrity/money/payment/irreversible risks remain forbidden.
- `opentest_gate: not-applicable`: do not generate a strict artifact. This is only for a genuinely docs-only change and requires exactly one valid structured `OPENTEST_GATE_JSON` with declarative real-human approval during verify. Eligibility checks committed, staged, unstaged, and untracked changes from a full immutable `base_ref` that is an ancestor of `HEAD`. The allowlist is exact: `docs/` accepts only `.md/.txt/.rst/.adoc` and static `.png/.jpg/.jpeg/.gif/.svg/.webp`; the active or dated-archive current-change directory accepts only `.md`, `.openspec.yaml`, and `.opensuper.yaml`; outside those directories, only root ARCHITECTURE/README/CHANGELOG/CONTRIBUTING/LICENSE documents with no extension or `.md/.txt/.rst/.adoc` are accepted. JSON/YAML/MDX, scripts, nested Markdown, and every runtime/config path block.
- Only an absent `opentest_gate` field or its literal `null` value preserves legacy compatibility. Empty, other, malformed, or duplicate state values block; legacy must never be called `pass-contract` or fusion-complete.

`not-run` and `deferred` only record unexecuted/postponed handoff states and cannot satisfy `required`. `not-run` closes only with the approved docs-only `not-applicable` consumer exception.

Verify discovers the provider consumer through `OPENSUPER_OPENTEST_CONSUMER` → sibling installed `opentest` skill → target-project `node_modules/@pzy560117/opentest`. Do not downgrade adapter/provider-consumer failures during build. Verify treats a missing consumer, provider, or result, timeout/overflow, artifact identity/byte change during the call, and every non-zero exit as blocking. `OPENTEST_GATE_JSON` must have exactly one matching open/close delimiter pair and non-empty valid JSON; duplicates, unmatched delimiters, or malformed content block.

### 5. Context Management

Build is the longest phase and may span many tasks. To support resume after context compaction:

- **After each task**: complete acceptance per the current execution branch before checking off and committing. `subagent-driven-development` must wait for both reviews to pass and perform targeted verification by unique task text. Use `grep -c '\- \[ \]' tasks.md` to check remaining unchecked count; no need to re-read the entire file
- **Context compression recovery**: Follow `opensuper/reference/context-recovery.md` with phase set to `build`.
- **User manual-change resume**: handle uncommitted changes through `opensuper/reference/dirty-worktree.md`. That protocol defines checks, attribution, and prohibitions. Build-specific handling:
  1. After attribution, if the diff implies plan or spec changes, handle it through Step 4 "Spec Incremental Updates"
- **Long task split**: if a single task exceeds 200 lines of code changes, consider splitting it into multiple subtasks and commits

## Exit Conditions

- All tasks.md checked
- Code committed
- Project-specific build/tests explicitly run and pass; do not rely only on guard auto-detection
- `isolation` has been written as `branch` or `worktree`
- `build_mode` has been written as `subagent-driven-development`, `executing-plans`, or `direct` with explicit override; if `subagent-driven-development`, `subagent_dispatch` must be `confirmed`
- `tdd_mode` has been written as `tdd` or `direct`
- If `build_mode` is `executing-plans`, the Skill tool has been used to load the Superpowers `requesting-code-review` skill and request code review at least once, and CRITICAL review findings have been fixed or acceptance rationale for non-CRITICAL review findings has been recorded
- **Phase guard**: Run `"$opensuper_BASH" "$opensuper_GUARD" <change-name> build --apply`; after all PASS, state advances to `phase: verify`

Guard reads project command configuration first:

```yaml
build_command: <build command>
verify_command: <verify command>
```

Configuration can live in the change `.opensuper.yaml`, or in repo-root `.opensuper.yaml` / `opensuper.yaml` / `.opensuper.yml` / `opensuper.yml`.
Only when no command is configured does guard fall back to `npm run build`, Maven, or Cargo auto-detection. When a command fails, guard prints the command output as evidence for debugging.

Before exit, run guard to auto-transition:

```bash
"$opensuper_BASH" "$opensuper_GUARD" <change-name> build --apply
```

State file is automatically updated to `phase: verify`, `verify_result: pending`.

## Automatic Handoff to Next Phase

Follow `opensuper/reference/auto-transition.md`. Key command:

```bash
"$opensuper_BASH" "$opensuper_STATE" next <change-name>
```

- `NEXT: auto` → invoke the skill pointed to by `SKILL` to enter the next phase
- `NEXT: manual` → do not invoke the next skill; prompt user to run `/<SKILL>` manually
- `NEXT: done` → workflow is complete, no further action needed
