---
name: opensuper-design
description: "OpenSuper Phase 2: Deep Design. Invoke with /opensuper-design. Produce Design Doc and delta spec through brainstorming."
---

# OpenSuper Phase 2: Deep Design (Design)

## Prerequisites

- Active change exists (proposal.md, design.md, tasks.md)
- No Design Doc (no corresponding file under `docs/superpowers/specs/`)

## Steps

### 0. Entry State Verification (Entry Check)

Execute entry verification:

```bash
OPENSUPER_SEARCH_ROOTS=("." "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.cursor/skills")
OPENSUPER_STATE="${OPENSUPER_STATE:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-state.sh' -type f -print -quit 2>/dev/null)}"
OPENSUPER_GUARD="${OPENSUPER_GUARD:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-guard.sh' -type f -print -quit 2>/dev/null)}"
bash "$OPENSUPER_STATE" check <name> design
```

Proceed to Step 1 after verification passes. The script outputs specific failure reasons when verification fails.

### 1a. Read Existing Context

Read `proposal.md` and `design.md` under the active change, organize core content into summaries:
- **Proposal summary**: goals, motivation, scope
- **Design summary**: architectural decisions, high-level design

### 1b. Execute Brainstorming (With Context)

**Immediately execute:** Use the Skill tool to load the `superpowers:brainstorming` skill, ARGUMENTS contains:

```
Change: <change-name>
Proposal summary: <proposal core content>
Design summary: <design.md architectural decisions>
Skip context exploration, proceed directly to design questioning.
```

Skipping this step is prohibited, and continuing without loading this skill is prohibited.

If `superpowers:brainstorming` is unavailable, stop the process and prompt to install or enable Superpowers skills. Do not substitute this step with normal conversation.

After the skill loads, follow its guidance to produce:
- `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` — design document (technical RFC)
- `openspec/changes/<name>/specs/<capability>/spec.md` — capability specification (delta)

### 2. Update OpenSuper State

Record design_doc path, then run guard to auto-transition:

```bash
# Record design_doc path
bash "$OPENSUPER_STATE" set <name> design_doc docs/superpowers/specs/YYYY-MM-DD-topic-design.md

# Auto-transition to next phase
bash "$OPENSUPER_GUARD" <change-name> design --apply
```

State file is updated automatically. No manual editing of other fields required.

## Exit Conditions

- Design Doc has been created and saved
- Delta spec has been created if there are new capabilities
- `design_doc` written to `.opensuper.yaml`
- **Phase guard**: Run `bash "$OPENSUPER_GUARD" <change-name> design --apply`; after all PASS, state advances to `phase: build`

You must use `--apply` before exiting:

```bash
bash "$OPENSUPER_GUARD" <change-name> design --apply
```

## Automatic Transition

After exit conditions are met, **proceed immediately to the next phase without waiting for user input**:

> **REQUIRED NEXT SKILL:** Invoke `opensuper-build` skill to enter the planning and build phase.
