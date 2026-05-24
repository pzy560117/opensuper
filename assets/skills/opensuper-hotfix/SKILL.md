---
name: opensuper-hotfix
description: "OpenSuper preset path: Bug fix / hotfix. Skip brainstorming, directly open → build → verify → archive. Applicable for behavior fixes, scenarios not involving new capability design."
---

# OpenSuper Preset Path: Hotfix

Quick bug fix workflow: open → build → verify → archive. Skip brainstorming and full plan, applicable for behavior fixes not involving new capability design.

**Applicable conditions** (all must be met):
1. Fix bugs in existing functionality, no new capability
2. No interface changes or architecture adjustments
3. Change scope is predictable (usually ≤ 2 files)

**Not applicable**: If fix process discovers need for architecture adjustments, should upgrade to full `/opensuper` workflow.

---

## Process (preset workflow, 4 phases)

Execution chain: open → build → verify → archive. Hotfix provides default decisions for each phase: streamlined open, direct build, scale-based verification, archive after verification passes.

Locate OpenSuper scripts before starting:

```bash
OPENSUPER_SEARCH_ROOTS=("." "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.cursor/skills")
OPENSUPER_STATE="${OPENSUPER_STATE:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-state.sh' -type f -print -quit 2>/dev/null)}"
OPENSUPER_GUARD="${OPENSUPER_GUARD:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-guard.sh' -type f -print -quit 2>/dev/null)}"
OPENSUPER_ARCHIVE="${OPENSUPER_ARCHIVE:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-archive.sh' -type f -print -quit 2>/dev/null)}"
```

### 1. Quick Open (preset open)

Reuse OpenSuper open capability to create change, but use hotfix defaults: do not execute `openspec-explore` long exploration, directly enter streamlined change creation.

**Immediately execute:** Use the Skill tool to load the `openspec-new-change` skill. Skipping this step is prohibited.

After the skill loads, follow its guidance to create streamlined artifacts:
  - `proposal.md` — problem description + root cause analysis + fix goal (no solution comparison needed)
  - `design.md` — fix solution (one is enough, no multi-solution comparison needed)
  - `tasks.md` — fix task list
- **No delta spec needed** (unless fix changes existing spec acceptance scenarios)

Initialize OpenSuper state file:

```bash
bash "$OPENSUPER_STATE" init <name> hotfix
```

Run phase guard to transition open → build:

```bash
bash "$OPENSUPER_GUARD" <change-name> open --apply
```

### 2. Direct Build (preset build)

Use hotfix defaults: `build_mode: direct`. Skip `superpowers:brainstorming` and `superpowers:writing-plans` (unless tasks > 3; if exceeds 3 tasks, transfer to `/opensuper-build`'s plan and execution method selection).

**Immediately execute:** Execute tasks one by one according to tasks.md:

1. Read `openspec/changes/<name>/tasks.md`, get incomplete task list
2. For each incomplete task:
   - Modify code according to task description
   - Run project formatter (e.g., `mvn spotless:apply`, `npm run format`)
   - Run related tests to confirm pass
   - Check corresponding `- [ ]` to `- [x]` in tasks.md
   - Commit code, commit message format: `fix: <brief fix description>`
3. After all tasks complete, explicitly run relevant project tests and build commands
4. Run phase guard to transition build → verify:

```bash
bash "$OPENSUPER_GUARD" <change-name> build --apply
```

State automatically updates to `phase: verify`, `verify_result: pending`, then enter verification.

**If fix affects existing spec acceptance scenarios**:
- Create delta spec in `openspec/changes/<name>/specs/<capability>/spec.md`
- Only include `## MODIFIED Requirements` section

### 3a. Hotfix-Exclusive Check: Root Cause Elimination

**Execute before loading opensuper-verify**, ensuring the fix actually eliminates the root cause:

1. Read bug description and root cause in proposal.md
2. Search and verify problem code no longer exists
3. If root cause not eliminated, return to Step 2 to continue fix

**Upgrade conditions**:
- Root cause check reveals deep architecture issues → Stop hotfix, upgrade to `/opensuper`
- Fix requires additional interface changes → Stop hotfix, upgrade to `/opensuper`

### 3b. Verification (preset verify)

After root cause elimination check passes, reuse `/opensuper-verify`, with opensuper-verify's scale assessment deciding lightweight or full verification.

**Immediately execute:** Use the Skill tool to load the `opensuper-verify` skill. Skipping this step is prohibited.

Small-scale hotfixes without delta spec usually meet lightweight verification conditions (≤ 3 tasks, ≤ 2 files), opensuper-verify's scale assessment will select lightweight verification path (5 quick checks). If hotfix created delta spec, enter full verification path according to opensuper-verify's scale assessment rules.

After verification passes, record `.opensuper.yaml` `verify_result` as `pass` according to `/opensuper-verify` rules, must not skip this status before archiving.

### 4. Archive (preset archive)

Reuse `/opensuper-archive`. Must satisfy `verify_result: pass` in `.opensuper.yaml` before archiving.

**Immediately execute:** Use the Skill tool to load the `opensuper-archive` skill to archive. Skipping this step is prohibited.
If there is delta spec, sync to main spec according to opensuper-archive rules, and handle associated Design Doc and Plan archiving annotations.

---

## Continuous Execution Mode

<IMPORTANT>
Hotfix workflow is **one-time continuous execution**. After invoking `/opensuper-hotfix`, agent must automatically complete all 4 phases, without pausing to wait for user input mid-way (unless encountering upgrade conditions requiring user confirmation).

Execution order: quick open → direct build → verification → archive → complete

After each phase completes, immediately enter next phase, no need for user input again. Within each phase, must still call corresponding OpenSuper/OpenSpec/Superpowers skill according to above requirements.
</IMPORTANT>

---

## Upgrade Conditions

Upgrade to full `/opensuper` when **any** of the following conditions are met:

| Condition | Explanation |
|-----------|-------------|
| Change involves **3+ files** | Exceeds single-point fix scope |
| Architecture changes | New modules, new interfaces, new dependencies |
| Database schema changes | Structural adjustments |
| Introduces new public API | Fix creates new external interface |
| Fix scope exceeds single function/module | Requires coordinated changes |

Upgrade method: On current change basis, supplement Design Doc (execute `/opensuper-design`), then proceed normally with full workflow.

---

## Exit Conditions

- Bug fixed, tests pass
- Change archived
- If spec changes, synced to main spec
- **Phase guard**: Before build → verify run `bash "$OPENSUPER_GUARD" <change-name> build --apply`; before verify → archive follow `/opensuper-verify` and run `bash "$OPENSUPER_GUARD" <change-name> verify --apply`
