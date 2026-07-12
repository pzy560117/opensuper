---
name: opensuper-archive
description: "opensuper Phase 5: Archive. Invoke with /opensuper-archive. Merge delta specs into main specs with OpenSpec semantics, archive change."
---

# opensuper Phase 5: Archive (Archive)

## Output Language Contract

- Output language: English.
- This skill writes all user-facing responses and generated documents in English by default, including `proposal.md`, `design.md`, `tasks.md`, delta specs, Design Docs, Plans, verification reports, and archive notes.
- Keep commands, paths, frontmatter keys, code identifiers, package names, and API names in their original form.
- Use another prose language only when the user explicitly requests it.

## Prerequisites

- Verification passed (Phase 4 complete)
- Branch handled
- `verify_result: pass` in `openspec/changes/<name>/.opensuper.yaml`
- If `opentest_gate` is `required` or `not-applicable`, its gate passed during verify; archive still revalidates it and never trusts the old conclusion alone

## Steps

### 0. Output Language Constraint

Archive summaries and lifecycle closure notes must use the language of the user request that triggered this workflow.

### 0. Entry State Verification (Entry Check)

Execute entry verification:

```bash
opensuper_ENV="${opensuper_ENV:-$(find . "$HOME"/.*/skills "$HOME/.config" "$HOME/.gemini" -path '*/opensuper/scripts/opensuper-env.sh' -type f -print -quit 2>/dev/null)}"
if [ -z "$opensuper_ENV" ]; then
  echo "ERROR: opensuper-env.sh not found. Ensure the opensuper skill is installed." >&2
  return 1
fi
. "$opensuper_ENV"
"$opensuper_BASH" "$opensuper_STATE" check <name> archive
```

Proceed to Step 1 after verification passes. The script outputs specific failure reasons when verification fails.

### 1. Final Archive Confirmation (Blocking Point)

After entry verification passes, **must follow the `opensuper/reference/decision-point.md` protocol to pause and wait for the user to confirm whether to archive immediately**. Must not run `"$opensuper_BASH" "$opensuper_ARCHIVE" "<change-name>"` before user confirmation.

Before confirmation, show the user a brief summary:
- Change name
- Verification report path and result
- Branch handling status
- OpenTest gate, strict artifact path, and evidence-ledger value when applicable
- Irreversible actions this archive will perform: merge main specs with OpenSpec delta semantics, annotate design doc / plan, and move the change to the archive directory

The user confirmation question must be presented as a single-select question with these options:
- "Confirm archive" — immediately run the archive script to complete spec merge and change movement
- "Needs adjustment or re-verification" — do not archive; run `"$opensuper_BASH" "$opensuper_STATE" transition <change-name> archive-reopen` to return to `phase: verify`, then invoke `/opensuper-verify`. If verification confirms fixes are needed, follow `/opensuper-verify`'s verification-failure decision flow back to `/opensuper-build`
- "Do not archive yet" — do not archive; keep the current `phase: archive` state and wait for the user to invoke `/opensuper-archive` again later

Only after the user selects "Confirm archive" may Step 2 continue. After the user selects "Needs adjustment or re-verification", must first run the `archive-reopen` state transition; do not edit `.opensuper.yaml` manually.

### 2. Execute Archive

Run the archive script to automatically complete all steps:

```bash
"$opensuper_BASH" "$opensuper_ARCHIVE" "<change-name>"
```

The script automatically executes:
1. Entry state validation (phase=archive, verify_result=pass, archived=false)
2. Before any document annotation, `openspec archive`, or archive-state mutation, run the same OpenTest gate used by verify/direct `verify-pass` as the actual archive preflight
3. Design doc frontmatter annotation (archived-with, status)
4. Plan frontmatter annotation (archived-with)
5. OpenSpec archive for delta-merge semantics and moving the change to the archive directory
6. Main spec guard against leaked delta-only section headings
7. Update `archived: true` through `opensuper-state transition <archive-name> archived`

With `opentest_gate: required`, preflight rediscovers the shipped adapter/provider consumer and semantically recomputes the project-relative `opentest_strict_result` against current Git and hashes. Each required gate check invokes the provider exactly once with a fixed 120-second timeout and 1 MiB output-buffer limit; it also resolves the strict result and its `state_file` before and after the call and requires their canonical path identities and raw bytes to remain unchanged. A missing consumer, result, or provider, timeout/overflow, a present `.pending`, call-time artifact replacement/change, or any non-zero exit blocks before irreversible work. `risk-accepted` revalidates the single complete parseable `OPENTEST_GATE_JSON`, requires each item to contain exactly one of `strict_finding_id`/`strict_key`, a declarative real-human `accepted_by`, a calendar-valid future ISO-8601 expiry (offsets and variable-length fractional seconds supported), and a recovery path. Agents/AIs/placeholders cannot self-approve, and critical/security/data-integrity/money/payment/irreversible risks remain forbidden. `not-applicable` revalidates declarative real-human approval, `scope: "docs-only"`, and committed/staged/unstaged/untracked scope from immutable `base_ref`; `docs/` accepts only `.md/.txt/.rst/.adoc` and static `.png/.jpg/.jpeg/.gif/.svg/.webp`, the active or dated-archive current-change directory accepts only `.md/.openspec.yaml/.opensuper.yaml`, and outside those directories only root ARCHITECTURE/README/CHANGELOG/CONTRIBUTING/LICENSE documents with no extension or `.md/.txt/.rst/.adoc` pass. JSON/YAML/MDX, scripts, nested Markdown, and every runtime/config path block. Empty/duplicate blocks, unmatched delimiters, or malformed JSON block. Only an absent field or literal `null` stays legacy-compatible; empty/other values do not, and legacy is not fusion-complete.

When the archive-directory locator is `YYYY-MM-DD-<change-name>`, the gate reads state from that dated directory but still compares strict-result and machine-block `change_id` with the original `<change-name>`; never put the date prefix into evidence identity.

Only ledger `pass-contract` satisfies `required`; `pass-local`, `not-run`, and `deferred` all block required archive. Only the approved docs-only `not-applicable` exception may close with `not-run`.

If script returns non-zero exit code, report error and stop.
If script returns zero exit code, archive is complete.
The summary `X/Y steps succeeded` counts real executed steps and does not double-count delta spec sync or document annotation.

The script calls OpenSpec archive to merge `ADDED/MODIFIED/REMOVED/RENAMED` delta semantics into main specs, then verifies main specs do not contain delta-only section headings.

Use `--dry-run` flag to preview without executing.

### 3. Lifecycle Closed Loop

Spec lifecycle completes here:
```
brainstorming → delta spec → implementation → verification → main spec merge → design doc annotation → archive
```

## Exit Conditions

- Archive script executed successfully (exit code 0)
- Archive directory `openspec/changes/archive/YYYY-MM-DD-<change-name>/` exists
- Archived `.opensuper.yaml` contains `archived: true`

The archive script moves `openspec/changes/<name>/` to `openspec/changes/archive/YYYY-MM-DD-<name>/`.

> **WARNING**: After successful archive, **do not run** `"$opensuper_BASH" "$opensuper_GUARD" <change-name> archive` against the old active change name; the active directory no longer exists. Doing so will cause the guard to error with "change directory not found". Archive completeness is determined by script exit code and archived directory state.

## Complete

opensuper workflow complete. To start new work, invoke `/opensuper` or `/opensuper-open`.

## Context Compression Recovery

Follow `opensuper/reference/context-recovery.md` with phase set to `archive`. If `archived: true` and archive directory exists, archival is complete — do not re-execute archive operations.

If OpenTest preflight fails, never hand-edit strict JSON or skip the script. When the consumer is missing, install target-project `@pzy560117/opentest` or a sibling `opentest` skill (managed environments may set `OPENSUPER_OPENTEST_CONSUMER`). For a missing/stale result or Git/hash mismatch, confirm no writer is active, then rerun `opentest verify --strict --json --output <opentest_strict_result>` from the target project. If `.pending` exists, diagnose the producer and remove the marker manually only after confirming no writer remains and recovery is safe.
