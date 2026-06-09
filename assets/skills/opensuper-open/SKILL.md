---
name: opensuper-open
description: "OpenSuper Phase 1: Open. Invoke with /opensuper-open. Explore ideas through OpenSpec and create change structure (proposal + design + tasks)."
---

# OpenSuper Phase 1: Open

## Output Language Contract

- Output language: English.
- This skill writes all user-facing responses and generated documents in English by default, including `proposal.md`, `design.md`, `tasks.md`, delta specs, Design Docs, Plans, verification reports, and archive notes.
- Keep commands, paths, frontmatter keys, code identifiers, package names, and API names in their original form.
- Use another prose language only when the user explicitly requests it.

## Prerequisites

- No active change, or user wishes to create a new change

## Steps

### 0. Locate OpenSuper Scripts

Locate scripts before creating state:

```bash
OPENSUPER_SEARCH_ROOTS=("." "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.cursor/skills")
OPENSUPER_STATE="${OPENSUPER_STATE:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-state.sh' -type f -print -quit 2>/dev/null)}"
OPENSUPER_GUARD="${OPENSUPER_GUARD:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-guard.sh' -type f -print -quit 2>/dev/null)}"

if [ -z "$OPENSUPER_STATE" ] || [ -z "$OPENSUPER_GUARD" ]; then
  echo "ERROR: OpenSuper scripts not found. Ensure the opensuper skill is installed." >&2
  return 1
fi
```

### 1. Explore Idea

**Immediately execute:** Use the Skill tool to load the `openspec-explore` skill and pass this requirement: `Output language: English`. Skipping this step is prohibited.

After the skill loads, freely explore the problem space following its guidance. Exploration notes, problem breakdowns, and candidate solutions must be written in English.

### 2. Create Change Structure

**Immediately execute:** Use the Skill tool to load the `openspec-new-change` skill and pass this requirement: `Output language: English`. If user intent is unclear and needs to form a proposal first, load `openspec-propose` instead and pass the same English output requirement. Skipping this step is prohibited.

The generated `proposal.md`, `design.md`, and `tasks.md` prose must be written in English; commands, paths, field names, and code identifiers stay in their original form.

Confirm the following artifacts have been created:

```
openspec/changes/<name>/
├── .openspec.yaml
├── .opensuper.yaml
├── proposal.md       # Why + What: problem, goals, scope
├── design.md         # How (high-level): architectural decisions, solution selection
└── tasks.md          # Task checklist (checkboxes)
```

### 3. Initialize OpenSuper State

Initialize OpenSuper state file:

```bash
bash "$OPENSUPER_STATE" init <name> full
```

### 4. Content Completeness Check

Confirm the three documents have complete content:
- **proposal.md**: problem background, goals, scope, non-goals
- **design.md**: high-level architectural decisions, solution selection, data flow
- **tasks.md**: task list, each task has a clear description

## Exit Conditions

- proposal.md, design.md, and tasks.md are all created with complete content
- **Phase guard**: Run `bash "$OPENSUPER_GUARD" <change-name> open --apply`; after all PASS, state automatically advances to the next phase

You must use `--apply` before exiting. Otherwise `.opensuper.yaml` stays at `phase: open`, and the next phase entry check will fail.

```bash
bash "$OPENSUPER_GUARD" <change-name> open --apply
```

Full workflow advances to `phase: design`; hotfix/tweak presets advance to `phase: build`.

## Automatic Transition

After exit conditions are met, **proceed immediately to the next phase without waiting for user input**:

> **REQUIRED NEXT SKILL:** Invoke `opensuper-design` skill to enter the deep design phase.
