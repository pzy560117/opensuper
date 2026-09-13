# Eval Evidence Reference

## Eval choices

Before any verification action, show:

- `quick` estimated runs, covered components, and token workload.
- `full` estimated runs, covered components, and token workload.
- the three choices: `skip / quick / full eval`.

If eval is skipped, fails, or records stale-hash evidence, do not enter ready; do not publish or distribute.

For ordinary users, the verification path remains single-purpose: daily evaluation goes through
`opensuper eval`. `/opensuper-any` may internally record eval evidence, but must not present the internal
recording step as a replacement user-facing command.
For ordinary users, prefer the word "verify" when explaining; do not surface `Publish readiness:`
as a first-class concept.

## Result recording

Eval evidence must produce structured JSON with at least:

- the current draft hash.
- covered entry Skill and internal Node Skills.
- `workflow-protocol.json` hash.
- quick or full choice, token workload, and result summary.
- Bundle compile, safety check, and capability evidence.

Only current draft hash eval evidence can advance state. Stale eval evidence may remain on disk for
audit, but cannot make the current draft ready.

## Human review

Passing eval still requires human approval. The review summary must include at least:

First run `opensuper publish review <name> --platform <reference-platform> --json`, then use its
output to show:

- Bundle name, version, and hash.
- Multiple entry and internal Skill lists.
- `planHash`, `preferenceHash`, and `reference/resolved-skills.json` real Skill evidence,
  including project-level preference mode, required Skills, `sourceSummaries`, and the composed
  workflow summary.
- Recommended call order and `preferenceIndex`.
- Every item that deviates from the preferred order, plus the reason.
- Whether `.opensuper/skill-preferences.yaml` drifted after Factory initialization; `advisory` mode
  warns, while `strict` mode blocks.
- Whether the stable composed Skill Bundle required capability set
  `skills/scripts/rules/hooks/references` is complete, and whether `scripts/rules/hooks` remain
  the required control plane.
- Whether `opensuper/skill.yaml`, `opensuper/guardrails.yaml`, `opensuper/checks.yaml`, and `opensuper/eval.yaml`
  were generated.
- Whether `hooks/*.yaml` are treated only as portable hook descriptors until
  `opensuper publish distribute` compiles them for the target platform.
- Capability gaps and executable disclosures.
- eval choice, token workload, and result summary.
- `Validate this Skill` and the next action so the user knows why the candidate can become ready
  or is blocked.

Readiness blockers stop publishing. If missing current draft hash eval evidence, missing human
approval, required capability gaps, or unconfirmed executable disclosures remain, the flow must stop
in review and cannot continue to publish.

Only after explicit user approval may the agent run `opensuper publish approve` and publish.

## Install preview

Before real distribution, preview is mandatory:

```bash
opensuper publish distribute <name> --platform <id> --scope project --preview --json
```

Preview is a required check, not an optional extra. It should show:

- `Install preview`
- planned files
- unsupported capability
- executable disclosures
- `No files were written`

Only after the user confirms the preview result may the Skill remove `--preview` and execute real
distribution.
