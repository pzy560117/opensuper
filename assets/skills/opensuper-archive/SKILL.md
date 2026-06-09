---
name: opensuper-archive
description: "OpenSuper Phase 5: Archive. Invoke with /opensuper-archive. Sync delta spec to main spec, archive change."
---

# OpenSuper Phase 5: Archive (Archive)

## Output Language Contract

- Output language: English.
- This skill writes all user-facing responses and generated documents in English by default, including `proposal.md`, `design.md`, `tasks.md`, delta specs, Design Docs, Plans, verification reports, and archive notes.
- Keep commands, paths, frontmatter keys, code identifiers, package names, and API names in their original form.
- Use another prose language only when the user explicitly requests it.

## Prerequisites

- Verification passed (Phase 4 complete)
- Branch handled
- `verify_result: pass` in `openspec/changes/<name>/.opensuper.yaml`

## Steps

### 0. Entry State Verification (Entry Check)

Execute entry verification:

```bash
OPENSUPER_SEARCH_ROOTS=("." "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.cursor/skills")
OPENSUPER_STATE="${OPENSUPER_STATE:-$(find "${OPENSUPER_SEARCH_ROOTS[@]}" -path '*/opensuper/scripts/opensuper-state.sh' -type f -print -quit 2>/dev/null)}"
bash "$OPENSUPER_STATE" check <name> archive
```

Proceed to Step 1 after verification passes. The script outputs specific failure reasons when verification fails.

### 1. Execute Archive

Run the archive script to automatically complete all steps:

```bash
bash "$OPENSUPER_ARCHIVE" "<change-name>"
```

The script automatically executes:
1. Entry state validation (phase=archive, verify_result=pass, archived=false)
2. Delta spec sync to main spec (overwrite)
3. Design doc frontmatter annotation (archived-with, status)
4. Plan frontmatter annotation (archived-with)
5. Move change to archive directory
6. Update `archived: true` through `opensuper-state transition <archive-name> archived`

If script returns non-zero exit code, report error and stop.
If script returns zero exit code, archive is complete.
The summary `X/Y steps succeeded` counts real executed steps and does not double-count delta spec sync or document annotation.

When a delta spec differs from an existing main spec, the script prints a unified diff before overwrite so the archive sync content is visible.

Use `--dry-run` flag to preview without executing.

### 2. Lifecycle Closed Loop

Spec lifecycle completes here:
```
brainstorming → delta spec → implementation → verification → main spec overwrite → design doc annotation → archive
```

## Exit Conditions

- Archive script executed successfully (exit code 0)
- Archive directory `openspec/changes/archive/YYYY-MM-DD-<change-name>/` exists
- Archived `.opensuper.yaml` contains `archived: true`

The archive script moves `openspec/changes/<name>/` to `openspec/changes/archive/YYYY-MM-DD-<name>/`. After successful archive, do not run `bash "$OPENSUPER_GUARD" <change-name> archive` against the old active change name; the active directory no longer exists. Archive completeness is determined by the script exit code and archived directory state.

## Complete

OpenSuper workflow complete. To start new work, invoke `/opensuper` or `/opensuper-open`.
