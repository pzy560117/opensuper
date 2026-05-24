---
name: opensuper-tweak
description: "OpenSuper preset path: Non-bug small changes (tweak). Skip brainstorming and full plan, directly open → lightweight build → light verify → archive. Applicable for copy, configuration, documentation or prompt local optimization."
---

# OpenSuper Preset Path: Tweak

Tweak is a preset workflow of OpenSuper's five-phase capabilities, not a separate parallel process. It reuses open, build, verify, archive capabilities, only skipping brainstorming and full plan.

Applicable for small-scale non-bug changes, such as copy adjustments, configuration adjustments, documentation or prompt local optimization.

**Applicable conditions** (all must be met):
1. No new capability
2. No architecture changes
3. No interface changes involved
4. Usually not exceeding 3 tasks, 4 files

**Not applicable**: If change process discovers need for capability, architecture, or interface adjustments, should upgrade to full `/opensuper` workflow.

---

## Process (preset workflow, 4 phases)

Execution chain: open → lightweight build → light verify → archive. Tweak provides default decisions for each phase: streamlined open, lightweight build, lightweight verification, archive after verification passes.

Locate OpenSuper scripts before starting:

```bash
OPENSUPER_SEARCH_ROOTS=("." "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.cursor/skills")
OPENSUPER_STATE="${OPENSUPER_STATE:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-state.sh' -type f -print -quit 2>/dev/null)}"
OPENSUPER_GUARD="${OPENSUPER_GUARD:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-guard.sh' -type f -print -quit 2>/dev/null)}"
OPENSUPER_ARCHIVE="${OPENSUPER_ARCHIVE:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-archive.sh' -type f -print -quit 2>/dev/null)}"
```

### 1. Quick Open (preset open)

Reuse OpenSuper open capability to create change, but use tweak defaults: do not execute `openspec-explore` long exploration, directly enter streamlined change creation.

**Immediately execute:** Use the Skill tool to load the `openspec-new-change` skill. Skipping this step is prohibited.

After the skill loads, follow its guidance to create streamlined artifacts:
  - `proposal.md` — change motivation + goals + scope
  - `design.md` — brief implementation description (no solution comparison needed)
  - `tasks.md` — not exceeding 3 tasks
- **No delta spec needed** (unless change changes existing spec acceptance scenarios; once delta spec needed, upgrade to full `/opensuper`)

Initialize OpenSuper state file:

```bash
bash "$OPENSUPER_STATE" init <name> tweak
```

Run phase guard to transition open → build:

```bash
bash "$OPENSUPER_GUARD" <change-name> open --apply
```

### 2. Lightweight Build (preset build)

Use tweak defaults: `build_mode: direct`. Skip `superpowers:brainstorming` and `superpowers:writing-plans`.

**Immediately execute:** Execute tasks one by one according to tasks.md:

1. Read `openspec/changes/<name>/tasks.md`, get incomplete task list
2. For each incomplete task:
   - Modify target file according to task description
   - Run project formatter (e.g., `mvn spotless:apply`, `npm run format`)
   - Run related tests to confirm pass
   - Check corresponding `- [ ]` to `- [x]` in tasks.md
   - Commit code, commit message format: `tweak: <brief change description>`
3. After all tasks complete, explicitly run relevant project tests and build commands
4. Run phase guard to transition build → verify:

```bash
bash "$OPENSUPER_GUARD" <change-name> build --apply
```

State automatically updates to `phase: verify`, `verify_result: pending`, then enter verification.

### 3. Lightweight Verification (preset verify)

Reuse `/opensuper-verify`. Tweak must maintain lightweight verification conditions: ≤ 3 tasks, ≤ 4 files, no delta spec, no new capability.

**Immediately execute:** Use the Skill tool to load the `opensuper-verify` skill. Skipping this step is prohibited.

If scale assessment enters full verification path, stop tweak, upgrade to full `/opensuper`.

After verification passes, record `.opensuper.yaml` `verify_result` as `pass` according to `/opensuper-verify` rules, must not skip this status before archiving.

### 4. Archive (preset archive)

Reuse `/opensuper-archive`. Must satisfy `verify_result: pass` in `.opensuper.yaml` before archiving.

**Immediately execute:** Use the Skill tool to load the `opensuper-archive` skill to archive. Skipping this step is prohibited.

---

## Continuous Execution Mode

<IMPORTANT>
Tweak workflow is **one-time continuous execution**. After invoking `/opensuper-tweak`, agent must automatically complete all 4 phases, without pausing to wait for user input mid-way (unless encountering upgrade conditions requiring user confirmation).

Execution order: quick open → lightweight build → lightweight verification → archive → complete

After each phase completes, immediately enter next phase, no need for user input again. Within each phase, must still call corresponding OpenSuper/OpenSpec/Superpowers skill according to above requirements.
</IMPORTANT>

---

## Upgrade Conditions

Upgrade to full `/opensuper` when **any** of the following conditions are met:

| Condition | Explanation |
|-----------|-------------|
| Change involves **5+ files** | Exceeds small change scope |
| Cross-module coordination required | Needs coordination across components |
| **5+** new test cases needed | Change complexity increasing |
| Config item additions or deletions | Non-value config changes |
| New capability needed | Exceeds local optimization |
| Delta spec needed | Affects existing specifications |

Upgrade method: On current change basis, supplement Design Doc (execute `/opensuper-design`), then proceed normally with full workflow.

---

## Exit Conditions

- Small change completed, tests pass
- Change archived
- No new capability, architecture adjustments, or interface changes
- **Phase guard**: Before build → verify run `bash "$OPENSUPER_GUARD" <change-name> build --apply`; before verify → archive follow `/opensuper-verify` and run `bash "$OPENSUPER_GUARD" <change-name> verify --apply`
