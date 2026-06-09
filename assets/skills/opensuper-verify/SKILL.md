---
name: opensuper-verify
description: "OpenSuper Phase 4: Verify and Complete. Invoke with /opensuper-verify. Verify implementation matches design, handle development branch."
---

# OpenSuper Phase 4: Verify and Complete (Verify)

## Output Language Contract

- Output language: English.
- This skill writes all user-facing responses and generated documents in English by default, including `proposal.md`, `design.md`, `tasks.md`, delta specs, Design Docs, Plans, verification reports, and archive notes.
- Keep commands, paths, frontmatter keys, code identifiers, package names, and API names in their original form.
- Use another prose language only when the user explicitly requests it.

## Prerequisites

- Code has been committed (Phase 3 complete)
- All tasks in tasks.md are complete

## Steps

### 0. Entry State Verification (Entry Check)

Execute entry verification:

```bash
OPENSUPER_SEARCH_ROOTS=("." "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.cursor/skills")
OPENSUPER_STATE="${OPENSUPER_STATE:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-state.sh' -type f -print -quit 2>/dev/null)}"
OPENSUPER_GUARD="${OPENSUPER_GUARD:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-guard.sh' -type f -print -quit 2>/dev/null)}"
bash "$OPENSUPER_STATE" check <name> verify
```

Proceed to Step 1 after verification passes. The script outputs specific failure reasons when verification fails.

### 1. Change Scale Assessment

Execute scale assessment:

```bash
bash "$OPENSUPER_STATE" scale <name>
```

Script automatically counts tasks, delta specs, and changed files to determine whether to use light or full verification mode, and sets the verify_mode field.

Note: if the build phase committed after each task, worktree diff can underestimate change size. In that case, read the plan header `base-ref` and re-check the full commit range:

```bash
PLAN=$(bash "$OPENSUPER_STATE" get <name> plan)
BASE_REF=$(grep '^base-ref:' "$PLAN" 2>/dev/null | head -1 | sed 's/^base-ref: *//')
git diff --stat "$BASE_REF"...HEAD
```

If the commit range exceeds lightweight thresholds (> 5 files, cross-module coordination, or more than 1 delta spec capability), manually switch to full verification:

```bash
bash "$OPENSUPER_STATE" set <name> verify_mode full
```

### 2a. Lightweight Verification (Small Changes)

When scale assessment result is "small", skip `openspec-verify-change`, directly execute the following checks:

1. All tasks in tasks.md completed `[x]`
2. Changed files consistent with tasks.md description (compare `git diff --stat` against task content)
3. Build passes (run project-appropriate build command, e.g., `npm run build`, `mvn compile`, `cargo build`)
4. Related tests pass
5. No obvious security issues (no hardcoded secrets, no new unsafe operations)

**Pass standard**: All 5 items OK, no CRITICAL issues.

**When failing**: report failed items, record failure, move back to build, then invoke `/opensuper-build`.

```bash
bash "$OPENSUPER_STATE" transition <name> verify-fail
```

**Report format**: Brief table listing 5 check results + PASS/FAIL.

**Skipped items** (not checked in lightweight verification):
- spec scenario coverage
- design doc consistency deep comparison
- code pattern consistency recommendations
- delta spec and design doc drift detection

### 2b. Full Verification (Large Changes)

When scale assessment result is "large":

**Immediately execute:** Use the Skill tool to load the `openspec-verify-change` skill and pass this requirement: `Output language: English`. Skipping this step is prohibited.

After the skill loads, follow its guidance to verify. Check items:
1. All tasks in tasks.md completed (`[x]`)
2. Implementation matches design.md design decisions
3. Implementation matches brainstorming design document
4. All capability specification scenarios pass
5. proposal.md goals satisfied
6. No contradiction between delta spec and design doc (if Build phase had incremental spec modifications, check if design doc has corresponding records)
7. `docs/superpowers/specs/` associated design document can be located (file exists and relates to current change)

When verification fails: report missing items, record failure, move back to build, then invoke `/opensuper-build`.

```bash
bash "$OPENSUPER_STATE" transition <name> verify-fail
```

**Spec drift handling**:
- If check item 6 finds contradiction (delta spec has content but design doc doesn't reflect it), prompt user:
  - Option A: Append "Implementation Divergence" section to design doc recording deviation reason
  - Option B: Roll back to Build phase, supplement brainstorming to update design doc
  - Option C: Confirm deviation acceptable, continue verification (design doc will be marked as `superseded-by-main-spec` during archiving)

### 3. Completion (Superpowers)

**Immediately execute:** Use the Skill tool to load the `superpowers:finishing-a-development-branch` skill and pass this requirement: `Output language: English`. Skipping this step is prohibited.

If `superpowers:finishing-a-development-branch` is unavailable, stop the process and prompt to install or enable Superpowers skills. Do not substitute this step with normal conversation.

After the skill loads, follow its guidance to complete. Branch handling options:
1. Local merge to main branch
2. Push and create PR
3. Keep branch (handle later)
4. Discard work

**Confirmation items**:
- All tests pass
- No hardcoded secrets or security issues

## Exit Conditions

- Verification report passed
- Branch handled
- **Phase guard**: Run `bash "$OPENSUPER_GUARD" <change-name> verify --apply`; after all PASS, it uses `opensuper-state transition verify-pass` to advance to `phase: archive`

After verification and branch handling are complete, run guard to auto-transition:

```bash
bash "$OPENSUPER_GUARD" <change-name> verify --apply
```

State file is automatically updated to `phase: archive`, `verify_result: pass`, `verified_at: YYYY-MM-DD`.

## Automatic Transition

After exit conditions are met, **proceed immediately to the next phase without waiting for user input**:

> **REQUIRED NEXT SKILL:** Invoke `opensuper-archive` skill to enter the archiving phase.
