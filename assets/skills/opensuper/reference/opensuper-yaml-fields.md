# .opensuper.yaml Field Reference

Canonical path: `opensuper/reference/opensuper-yaml-fields.md`

This file is the field reference for the `.opensuper.yaml` state file. Consult on demand; not loaded inline with skills.

## Example

```yaml
workflow: full
phase: build
design_doc: docs/superpowers/specs/YYYY-MM-DD-topic-design.md
plan: docs/superpowers/plans/YYYY-MM-DD-feature.md
base_ref: a1b2c3d4e5f6...
build_mode: subagent-driven-development
build_pause: null
subagent_dispatch: confirmed
tdd_mode: tdd
isolation: branch
verify_mode: light
opentest_gate: required
opentest_strict_result: docs/opentest/reports/strict-verification.json
verify_result: pending
verification_report: null
branch_status: pending
created_at: 2026-05-26
verified_at: null
archived: false
```

## Required Fields

| Field | Meaning |
|-------|---------|
| `workflow` | `full`, `hotfix`, or `tweak` |
| `phase` | Current phase: `open`, `design`, `build`, `verify`, `archive` (init sets `open`; guard handles transitions) |
| `design_doc` | Associated Superpowers Design Doc path; may be empty |
| `plan` | Associated Superpowers Plan path; may be empty |
| `base_ref` | Git commit SHA recorded at init for scale assessment. Used as baseline for changed-file counting when no plan exists |
| `build_mode` | Selected execution mode; may be empty |
| `build_pause` | Build phase internal pause point. `null` = no pause, `plan-ready` = plan generated, paused for user model switch |
| `subagent_dispatch` | `null` or `confirmed`. Only when the platform's real background subagent/Task/multi-agent dispatch capability is confirmed may `build_mode: subagent-driven-development` be written and used to leave the build phase |
| `tdd_mode` | `tdd` or `direct`. Full workflow must select before leaving build. `tdd` forces write-failing-test-first per task; `direct` skips TDD enforcement. hotfix/tweak default to `direct` |
| `isolation` | `branch` or `worktree`, workspace isolation mode. Full init may be `null` but only until `/opensuper-build` Step 3; hotfix/tweak default to `branch` |
| `verify_mode` | `light` or `full`; may be empty |
| `opentest_gate` | `required`, `not-applicable`, or the unquoted YAML literal `null`. Only an absent field/unquoted `null` is legacy compatibility; quoted `"null"`/`'null'`, empty, other, malformed, or duplicate state values block |
| `opentest_strict_result` | Canonical project-relative path to OpenTest strict JSON. It must be non-empty for `required`; absolute, parent-traversing, and symlink-escaping paths are rejected |
| `auto_transition` | `true` or `false`. Only controls whether to automatically invoke the next skill after phase guard advances phase; `false` outputs `manual` from `opensuper-state next`, pausing next-skill invocation but not blocking phase field updates |
| `verify_result` | `pending`, `pass`, or `fail` |
| `verification_report` | Verification report file path; must point to an existing file before verify passes |
| `branch_status` | `pending` or `handled`; set to `handled` after branch handling completes |
| `created_at` | Change creation date (auto-written at init), format `YYYY-MM-DD` |
| `verified_at` | Verification pass timestamp; may be empty |
| `archived` | Whether the change has been archived |

## Optional Fields

| Field | Meaning |
|-------|---------|
| `direct_override` | `true`/`false`. Full workflow must explicitly set to `true` to use `build_mode: direct` |
| `build_command` | Project build command. Guard runs this first; prints command output on failure |
| `verify_command` | Project verify command. Verify guard runs this first; falls back to build command when unset |

## State Machine Hard Constraints

- Before `build → verify`, `isolation` must be `branch` or `worktree`
- Before `build → verify`, `build_mode` must be selected
- `build_mode: subagent-driven-development` requires `subagent_dispatch: confirmed`
- Full workflow must select `tdd_mode` as `tdd` or `direct` before leaving build
- `build_mode: direct` defaults to `hotfix`/`tweak` only; full workflow requires `direct_override: true`
- `build_pause` is not an execution mode; must not be written to `build_mode`
- The build constraints above exist in both `opensuper-guard.sh build --apply` and `opensuper-state.sh transition <name> build-complete`
- With `opentest_gate: required`, first generate `opentest_strict_result` in the target project, then let OpenSuper's shipped adapter invoke the OpenTest provider consumer for semantic recomputation. Each required gate check invokes the provider exactly once with a fixed 120-second timeout and 1 MiB output-buffer limit; a missing consumer, result, or provider, timeout/overflow, and every non-zero exit block
- Provider discovery order is `OPENSUPER_OPENTEST_CONSUMER` → sibling installed `opentest` skill → target-project `node_modules/@pzy560117/opentest`; `required` never falls back to legacy verification
- The adapter resolves the strict result and its `state_file` before and after the provider call, requiring canonical path identities plus result text/state raw bytes to stay unchanged; call-time replacement or rewriting blocks
- When the provider returns `risk-accepted`, the verification report requires exactly one complete, non-empty, parseable `OPENTEST_GATE_JSON`. Each item contains exactly one of `strict_finding_id`/`strict_key`; `accepted_by` declares a specific real-human identity and agents/AIs/generic roles/placeholders cannot self-approve; `expires_at` must be future, calendar-valid ISO-8601 with `Z`/offset and variable-length fractional seconds supported. Critical/security/data-integrity/money/payment/irreversible risks cannot be accepted
- `opentest_gate: not-applicable` accepts only one valid `scope: "docs-only"` machine block with declarative real-human approval and requires full immutable `base_ref` to resolve unchanged as an ancestor of `HEAD`. The adapter checks committed, staged, unstaged, and untracked paths. `docs/` accepts only `.md/.txt/.rst/.adoc` and static `.png/.jpg/.jpeg/.gif/.svg/.webp`; the active or dated-archive current-change directory accepts only `.md/.openspec.yaml/.opensuper.yaml`; outside those directories, only root ARCHITECTURE/README/CHANGELOG/CONTRIBUTING/LICENSE documents with no extension or `.md/.txt/.rst/.adoc` pass. JSON/YAML/MDX, scripts, nested Markdown, and every runtime/config path block
- Both machine exceptions reject empty/duplicate blocks, unmatched/extra delimiters, and malformed JSON. When an archive locator is `YYYY-MM-DD-<change>`, `change_id` still compares against original `<change>`
- Only absent/unquoted-literal-null `opentest_gate` stays legacy-compatible but is not `pass-contract` or fusion-complete; quoted `"null"`/`'null'`, empty, and other values block

## OpenTest Evidence Ledger Values

| Value | Meaning |
|-------|---------|
| `pass-contract` | OpenSuper successfully consumed strict evidence through the provider consumer; may satisfy `required` |
| `pass-local` | OpenTest-local verification passed but OpenSuper has not consumed it; cannot satisfy the gate |
| `not-run` | OpenTest has not run; only an approved docs-only `not-applicable` consumer exception may close this case |
| `deferred` | Evidence is postponed for handoff tracking only; cannot satisfy verify, archive, or fusion-complete |

The target project that installs both independent packages owns runtime state, strict JSON, ledgers, reports, and evidence. Neither package source repository is the shared artifact root.
