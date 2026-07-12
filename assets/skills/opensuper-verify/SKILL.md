---
name: opensuper-verify
description: "opensuper Phase 4: Verify and Close. Invoke with /opensuper-verify. Verify implementation matches design, handle development branch."
---

# opensuper Phase 4: Verify and Close (Verify)

## Output Language Contract

- Output language: English.
- This skill writes all user-facing responses and generated documents in English by default, including `proposal.md`, `design.md`, `tasks.md`, delta specs, Design Docs, Plans, verification reports, and archive notes.
- Keep commands, paths, frontmatter keys, code identifiers, package names, and API names in their original form.
- Use another prose language only when the user explicitly requests it.

## Prerequisites

- Code committed (Phase 3 complete)
- All tasks.md tasks completed

## Steps

### 0a. Output Language Constraint

Verification reports and branch-handling notes must use the language of the user request that triggered this workflow.

### 0b. Entry State Verification (Entry Check)

Execute entry verification:

```bash
opensuper_ENV="${opensuper_ENV:-$(find . "$HOME"/.*/skills "$HOME/.config" "$HOME/.gemini" -path '*/opensuper/scripts/opensuper-env.sh' -type f -print -quit 2>/dev/null)}"
if [ -z "$opensuper_ENV" ]; then
  echo "ERROR: opensuper-env.sh not found. Ensure the opensuper skill is installed." >&2
  return 1
fi
. "$opensuper_ENV"
"$opensuper_BASH" "$opensuper_STATE" check <change-name> verify
```

Proceed to Step 1 after verification passes. The script outputs specific failure reasons when verification fails.

**Idempotency**: All verify phase checks can be safely re-executed. If `verify_result` is already `pass` and `branch_status` is `handled`, verification is complete — execute guard to transition. If `verify_result` is `pending`, start verification from the beginning.

### 1. Scale Assessment

Execute scale assessment:

```bash
"$opensuper_BASH" "$opensuper_STATE" scale <change-name>
```

The script automatically counts tasks, delta spec count, changed file count, determines light or full verification mode, and sets the verify_mode field. Decision rule (any condition triggers full): tasks > 3, delta spec capabilities > 1, changed files > 4.

Before verification begins, handle uncommitted changes through `opensuper/reference/dirty-worktree.md` protocol. Verify phase special handling:

1. If dirty diff belongs to current change and involves implementation, tests, tasks, delta spec, or design doc changes, do not fix or commit directly in verify phase; report failures and enter Step 1b verification failure decision blocking point
2. If dirty diff is only verify phase artifacts (e.g., verification report draft, branch handling records), may continue and record state in verify phase
3. If dirty diff shows implementation but tasks.md not checked, treat as build state lag; report failures and enter Step 1b, let user decide to roll back for fix or accept deviation

Only after user chooses fix, allow rollback to build phase:

```bash
# Execute only after user confirms fix
"$opensuper_BASH" "$opensuper_STATE" transition <change-name> verify-fail
```

Note: When verify-fail rolls back to build, `branch_status` is not reset. If branch handling was already completed during the first verify attempt, skip the branch handling step on re-verify and keep the existing `branch_status: handled`.

Note: If every task in build phase was committed, the script's file count based on working tree diff may underestimate change scale. In this case, must read plan file header `base-ref` and verify with commit range:

```bash
PLAN=$("$opensuper_BASH" "$opensuper_STATE" get <change-name> plan)
BASE_REF=$(grep '^base-ref:' "$PLAN" 2>/dev/null | head -1 | sed 's/^base-ref: *//')
git diff --stat "$BASE_REF"...HEAD
```

If commit range shows changes exceed lightweight threshold (> 4 files, cross-module coordination, or delta spec spans more than 1 capability), manually set to full verification:

```bash
"$opensuper_BASH" "$opensuper_STATE" set <change-name> verify_mode full
```

**Override mechanism**: If the agent or user believes the automated assessment is inappropriate, override at any time with `"$opensuper_BASH" "$opensuper_STATE" set <change-name> verify_mode <light|full>`.

### 1b. Verification Failure Decision (Blocking Point)

When verification does not pass, **must follow the `opensuper/reference/decision-point.md` protocol to pause and wait for the user to decide whether to fix or accept the deviation**. Must not automatically run `"$opensuper_BASH" "$opensuper_STATE" transition <change-name> verify-fail`, nor automatically invoke `/opensuper-build`.

When pausing, must list:
- Failed items
- Whether CRITICAL or IMPORTANT (build failure, test failure, security issues, core acceptance scenario failure, lightweight code review correctness/security/edge-case issue)
- Recommended handling approach

**Uncertainty principle**: When severity is unclear, downgrade (SUGGESTION > WARNING > CRITICAL). Only use CRITICAL for build failures, test failures, and security issues; ambiguous or uncertain issues should be WARNING or SUGGESTION.

After user selection, continue as follows:
- **Fix all**: Run `"$opensuper_BASH" "$opensuper_STATE" transition <change-name> verify-fail`, then invoke `/opensuper-build` to fix
- **Handle item by item**: CRITICAL or IMPORTANT failures must be fixed; WARNING/SUGGESTION failures may choose to accept deviation, but must record acceptance reason and impact scope in verification report. If any CRITICAL or IMPORTANT failure exists, skipping fix to accept all is not allowed

**Retry limit**: After 3 consecutive verify-fail cycles, on the 4th failure the agent must not automatically choose to continue fixing; **must use the current platform's available user input/confirmation mechanism to pause** with only two options: "Accept all deviations and record" or "Continue fixing", for the user to explicitly decide.

### 2. Artifact Context Loading (Hash On-Demand Read)

When verification needs to read OpenSpec artifacts, first check whether they have changed since the design phase:

```bash
RECORDED_HASH=$("$opensuper_BASH" "$opensuper_STATE" get <change-name> handoff_hash)
CURRENT_HASH=$("$opensuper_BASH" "$opensuper_HANDOFF" <change-name> --hash-only 2>/dev/null || echo "")
```

- If `RECORDED_HASH` = `CURRENT_HASH` and both are non-empty and neither is `null`: OpenSpec artifacts are unchanged. **tasks.md does not need to be re-read in full** (use `grep -c '\- \[ \]' tasks.md` to confirm completion count). proposal.md, design.md, and delta specs must still be read for comparison checks.
- If `RECORDED_HASH` is empty, is `null`, or differs from `CURRENT_HASH`: artifacts have changed or hash was never recorded. Read all required files in full normally.

This optimization only skips re-reading tasks.md in full. proposal.md and design.md contain the full context needed for verification checks and must not be skipped due to hash match.

**Immediately execute:** Use the Skill tool to load the Superpowers `verification-before-completion` skill. Skipping this step is prohibited.

After the skill loads, follow the `verify_mode` branch:

### 2a. Lightweight Verification (Small Changes)

Run these 6 checks:

1. All tasks.md tasks completed `[x]`
2. Changed files match tasks.md descriptions (`git diff --stat` / `git diff --cached --stat` / `git diff --stat <base-ref>...HEAD` compared against tasks content)
3. Build passes (run project-specific build command, e.g., `npm run build`, `mvn compile`, `cargo build`, etc.)
4. Related tests pass
5. No obvious security issues (no hardcoded keys, no new unsafe operations)
6. Lightweight code review passes: use the Skill tool to load the Superpowers `requesting-code-review` skill and request a lightweight review that checks only correctness, security, and edge cases

The lightweight code review input should be limited to this change's diff, tasks.md, and necessary test results; the review scope covers implementation correctness, security risk, and edge cases only, and does not perform spec coverage, Design Doc consistency, or drift checks. If the review finds CRITICAL or IMPORTANT issues, treat verification as failed and enter Step 1b.

**Pass criteria**: All 6 items OK, no CRITICAL or IMPORTANT issues.

**When not passing**: Report failures, enter Step 1b verification failure decision blocking point. Only after user confirms fix, execute the following command to record failure and roll back to build phase, then invoke `/opensuper-build` to fix:

```bash
# Execute only after user confirms fix
"$opensuper_BASH" "$opensuper_STATE" transition <change-name> verify-fail
```

**Report format**: Brief table listing 6 check results + PASS/FAIL.

**Skipped items** (not checked in lightweight verification):
- spec scenario coverage
- design doc consistency deep comparison
- code pattern consistency suggestions that do not affect correctness, security, or edge cases
- delta spec and design doc drift detection

### 2b. Full Verification (Large Changes)

When scale assessment result is "large":

**Immediately execute:** Use the Skill tool to load the `openspec-verify-change` skill and pass this requirement: `Output language: English`. Skipping this step is prohibited.

After the skill loads, follow its guidance to verify. Check items:
1. All tasks.md tasks completed (`[x]`)
2. Implementation matches `openspec/changes/<name>/design.md` high-level design decisions
3. Implementation matches Design Doc (technical design documents under `docs/superpowers/specs/`)
4. All capability spec scenarios pass
5. proposal.md goals are satisfied
6. No contradictions between delta spec and design doc (if Build phase had incremental spec modifications, check if design doc has corresponding records)
7. Associated design documents under `docs/superpowers/specs/` are locatable (file exists and is related to current change)

When verification does not pass: report missing items, enter Step 1b verification failure decision blocking point. Only after user confirms fix, execute the following command to record failure and roll back to build phase, then invoke `/opensuper-build` to supplement:

```bash
# Execute only after user confirms fix
"$opensuper_BASH" "$opensuper_STATE" transition <change-name> verify-fail
```

**Spec Drift Handling** (user decision point):
- If check item 6 finds contradictions (delta spec has content but design doc does not reflect it), **must use the current platform's available user input/confirmation mechanism as a single-select question to pause and wait for the user to choose the handling method**; must not select automatically. Options:
  - Option A: Append "Implementation Divergence" section to design doc recording deviation reason. Option A is a verify phase allowed artifact; after writing, must not re-trigger Step 1b dirty-worktree decision due to that design doc change
  - Option B: After user selects B, run `"$opensuper_BASH" "$opensuper_STATE" transition <change-name> verify-fail`, then invoke `/opensuper-build`; `/opensuper-build`'s Spec Incremental Update rules will load the Superpowers `brainstorming` skill to update Design Doc + delta spec
  - Option C: Confirm deviation is acceptable, continue verification (design doc will be marked as `superseded-by-main-spec` during archiving)

### 2c. OpenTest Strict Quality Evidence (State-Selected)

OpenTest only produces quality evidence. OpenSuper still owns TDD mode, build execution, Superpowers verification, branch handling, phase transitions, and archive. The target project that installs both independent packages owns the strict artifact, `.opentest.yaml`, ledger, reports, and evidence.

Read `opentest_gate` first:

#### `required`

1. Confirm `opentest_strict_result` is a non-empty canonical project-relative path with no parent traversal or symlink escape.
2. After the final commit and evidence update, run the OpenTest producer first from the target project. The OpenSuper guard does not generate this output, and JSON must never be hand-edited:

```bash
OPENTEST_RESULT=$("$opensuper_BASH" "$opensuper_STATE" get <change-name> opentest_strict_result)
opentest verify --strict --json --output "$OPENTEST_RESULT"
```

3. The producer must exit 0. Record the strict artifact path, a backlink to the OpenTest final evidence note, and the ledger status in the verification report. Local generation alone is `pass-local` and cannot pass the OpenSuper gate.
4. After the report is complete, run the verify guard. OpenSuper's shipped adapter discovers the provider consumer in this order: `OPENSUPER_OPENTEST_CONSUMER` → sibling installed `opentest` skill → target-project `node_modules/@pzy560117/opentest/assets/skills/opentest/scripts/opentest-strict-result.mjs`, then delegates semantic recomputation. Each required gate check invokes the provider exactly once, with a fixed 120-second timeout and 1 MiB output-buffer limit. It must validate supported schema `1.x`, the same change, current Git `HEAD`, `state-evidence-v1`, canonical in-project paths, required roles/hashes, no `.pending` marker, and a result of `pass` or valid `risk-accepted`. Before and after the provider call, it resolves the strict result and its `state_file` again, requires both canonical path identities to stay unchanged, and compares the result text plus state raw bytes. Never authorize by reading only the top-level `result`.

A missing consumer, result, or provider; any non-zero producer/adapter/provider exit; provider timeout/overflow; or missing, malformed, unsupported, failing, stale, wrong-change, path-escaping, hash-mismatched, semantically forged, pending, or call-time identity/byte-changing evidence fails verification and enters Step 1b. `required` never falls back to legacy fields.

If provider recomputation returns `risk-accepted`, follow `opensuper/reference/decision-point.md` to pause for item-by-item human approval. `accepted_by` declares the approver identity; it does not authenticate a human. It must name a specific real person, and an agent/AI/assistant/bot/system/automation/generic-role or placeholder identity cannot self-approve. The verification report must contain exactly one complete, non-empty, parseable delimited machine block below; empty blocks, duplicates, unmatched/extra delimiters, and malformed JSON block. Every accepted entry must contain exactly one of `strict_finding_id` or `strict_key` and match exactly one producer finding:

```markdown
<!-- OPENTEST_GATE_JSON
{"schema_version":"1.0","change_id":"change-name","gate":"risk-accepted","accepted_findings":[{"strict_finding_id":"RISK-001","reason":"bounded reason","owner":"owner","accepted_by":"Jane Smith","impact_scope":"bounded scope","expires_at":"2099-01-01T00:00:00Z","recovery_path":"issue or concrete remediation"}]}
OPENTEST_GATE_JSON -->
```

Every entry requires a non-empty `reason`, `owner`, declarative real-human `accepted_by`, `impact_scope`, future ISO-8601 `expires_at`, and concrete `recovery_path`. `expires_at` may use `Z` or a `±HH:MM` offset and any fractional-second length, but its calendar date, time, and offset must be valid and the resulting instant strictly in the future. A missing/both/type-mismatched selector, unknown or duplicate match, expired value, or any other incomplete entry blocks. Critical, security, data-integrity, money/payment, and other irreversible categories are forbidden regardless of human approval.

#### `not-applicable`

This is only for a docs-only change with no runtime behavior, security, data, payment, or integration change. First pause for human approval. `accepted_by` only declares a specific real-human identity; an agent/AI/generic-role or placeholder value cannot self-approve. The verification report must contain exactly one complete, non-empty, parseable delimited machine block:

```markdown
<!-- OPENTEST_GATE_JSON
{"schema_version":"1.0","change_id":"change-name","gate":"not-applicable","scope":"docs-only","reason":"no runtime behavior changes","accepted_by":"Jane Smith"}
OPENTEST_GATE_JSON -->
```

`change_id` must match, `reason` must be non-empty, and `accepted_by` must declare a specific non-placeholder real human. Surrounding prose is not authorization; an empty/duplicate block, unmatched/extra delimiter, malformed JSON, missing block, prose-only statement, or `not-run` alone blocks.

In addition to structured approval, the adapter requires `.opensuper.yaml` `base_ref` to be a full 40/64-character immutable commit id that resolves unchanged and is an ancestor of current `HEAD`. It checks committed (`base_ref...HEAD`), staged, unstaged, and untracked paths together. The allowlist is exact: `docs/` accepts only `.md/.txt/.rst/.adoc` and static `.png/.jpg/.jpeg/.gif/.svg/.webp`; the active or dated-archive current-change directory accepts only `.md`, `.openspec.yaml`, and `.opensuper.yaml`; outside those directories, only root ARCHITECTURE/README/CHANGELOG/CONTRIBUTING/LICENSE documents with no extension or `.md/.txt/.rst/.adoc` are accepted. JSON/YAML/MDX, scripts, nested Markdown, and runtime/config paths such as `src/`, `assets/`, `packages/`, `config/`, `.codex/`, CI workflows, and tests block.

#### Absent Field or Literal `null`

Only an absent `opentest_gate` field or its literal value `null` keeps legacy verify/archive behavior without requiring OpenTest. Empty, other, malformed, or duplicate state values block. Legacy is compatibility mode only: never record it as `pass-contract` or claim fusion-complete.

#### Evidence Ledger Values in the Verification Report

| Value | Meaning | Satisfies Gate? |
|-------|---------|-----------------|
| `pass-contract` | OpenSuper's adapter/provider consumer successfully recomputed and consumed the strict artifact | Yes, for `required` |
| `pass-local` | Only the OpenTest-local command passed; OpenSuper has not consumed it | No |
| `not-run` | OpenTest was not executed | Only with the approved docs-only `not-applicable` exception |
| `deferred` | Evidence is postponed with follow-up ownership recorded | No; handoff tracking only |

The same gate is called by direct `opensuper-state transition <change-name> verify-pass` and the actual archive preflight, so a direct state transition cannot bypass this step. When an archived locator uses `YYYY-MM-DD-<change-name>`, the adapter locates that dated directory but still compares strict-result and machine-block `change_id` with the original `<change-name>`.

### 3. Finishing (Superpowers)

**Immediately execute:** Use the Skill tool to load the Superpowers `finishing-a-development-branch` skill and pass this requirement: `Output language: English`. Skipping this step is prohibited.

If the Superpowers `finishing-a-development-branch` skill is unavailable, stop the process and prompt to install or enable Superpowers skills. Do not substitute this step with normal conversation.

After the skill loads, follow its guidance to finish. Branch handling options:
1. Merge to main branch locally
2. Push and create PR
3. Keep branch (handle later)
4. Discard work

This is a user decision point. **Must follow the `opensuper/reference/decision-point.md` protocol to pause and wait for the user to choose branch handling method**. Must not select based on recommendations, defaults, or current branch status. Only after the user completes selection and the corresponding operation finishes, may `branch_status: handled` be written.

**Confirmation items**:
- All tests pass
- No hardcoded keys or security issues

### 4. Record Verification Evidence

Verification report must be saved to disk and recorded in `.opensuper.yaml`; after branch handling completes, state fields must also be written. Do not manually set `verify_result: pass`; use guard for auto-transition.

```bash
mkdir -p docs/superpowers/reports
# Write verification conclusions to report file, e.g.:
# docs/superpowers/reports/YYYY-MM-DD-<change-name>-verify.md

"$opensuper_BASH" "$opensuper_STATE" set <change-name> verification_report docs/superpowers/reports/YYYY-MM-DD-<change-name>-verify.md
"$opensuper_BASH" "$opensuper_STATE" set <change-name> branch_status handled
```

## Exit Conditions

- Verification report passed
- Branch handled
- `verification_report` in `.opensuper.yaml` points to an existing verification report file
- `branch_status: handled` in `.opensuper.yaml`
- With `opentest_gate: required`, the adapter/provider consumer has validated the strict artifact as `pass-contract`; with `not-applicable`, the structured docs-only block is valid; only absent-field/literal-null legacy state is compatible and it must not be labeled fusion-complete
- **Phase guard**: Run `"$opensuper_BASH" "$opensuper_GUARD" <change-name> verify --apply`; after all PASS, auto-transitions to `phase: archive` through `opensuper-state transition verify-pass`

After both verification and branch handling are complete, run guard for auto-transition:

```bash
"$opensuper_BASH" "$opensuper_GUARD" <change-name> verify --apply
```

State file auto-updates to `phase: archive`, `verify_result: pass`, `verified_at: YYYY-MM-DD`.

## Automatic Handoff to Next Phase

Follow `opensuper/reference/auto-transition.md`. Key command:

```bash
"$opensuper_BASH" "$opensuper_STATE" next <change-name>
```

- `NEXT: auto` → invoke the skill pointed to by `SKILL` to enter the next phase
- `NEXT: manual` → do not invoke the next skill; prompt user to run `/<SKILL>` manually
- `NEXT: done` → workflow is complete, no further action needed

Note: after `opensuper-archive` starts, it must first execute the final archive confirmation blocking point and wait for the user to explicitly choose "Confirm archive" before running the archive script. Must not automatically archive just because verification passed.

## Context Compression Recovery

Follow `opensuper/reference/context-recovery.md` with phase set to `verify`.
