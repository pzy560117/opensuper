# Public CLI Reference

Canonical path: `opensuper-classic/reference/scripts.md`

This file defines how Classic Skills call OpenSuper Runtime. Use only the public `opensuper` CLI on PATH. Bundled `opensuper/scripts/*.mjs` files are internal to installation and Runtime; Skills must not search for or invoke them directly.

## CLI Bootstrap

At workflow entry, run the public `opensuper` command needed below. For `command not found`, `executable not found`, or `ENOENT`, stop and explain that the OpenSuper CLI installation is incomplete. Do not bypass it by searching Skill files, walking platform directories, or invoking internal bundles. If the CLI starts but returns a nonzero exit code, report the original error instead of retrying with an internal script.

## Public Workflow Commands

Use the public CLI for everyday workflow operations:

```bash
opensuper classic workspace prepare <change-name> --isolation <current|branch|worktree> --json
opensuper classic workspace resolve <change-name> --json
opensuper state select <change-name>
opensuper state current
opensuper state clear-selection
opensuper state check <change-name> <phase> --json
opensuper state check <change-name> <phase> --recover --json
opensuper state check <change-name> <phase> --recover --details --json
opensuper state checkpoint <change-name>
opensuper state checkpoint <change-name> --file <json-path>
opensuper state sync-plan <change-name>
opensuper state delivery <change-name>
opensuper state delivery <change-name> --verify
opensuper state delivery <change-name> --file <json-path>
opensuper check run <change-name> <build|verify> --local -- <program> [args...]
opensuper guard <change-name> <phase> --apply
opensuper handoff <change-name> design --write
opensuper archive <change-name>
opensuper resume-probe . --stdin --json
opensuper classic intent route --stdin
```

Run workspace prepare during Open. If the workspace is unknown, changes, or its previous selection is invalid, run workspace resolve, enter the returned projectRoot, then select. For normal phase handoffs, reuse valid selection without rescanning Worktrees. Source writes must belong to the selected change.

Entry check --json returns layout, configuration, nextAction, task summaries, coordination, and delivery. Do not separately query fields already returned. If session recovery lacks context, start with --recover for a summary; add --details only for complete tasks, checkpoints, or evidence. See context-recovery.md.

checkpoint input requires schemaVersion:1 and taskIds/revision/stage/sessionId/evidence/unresolved/reviewRounds; reads return `{checkpoint, stale}`. Runtime validates the data and generates Markdown. See context-recovery.md for JSON. task-complete automatically synchronizes legacy-plan tasks with established opensuper-task ID mappings. Use sync-plan for a separate update; planSync mapping-required requires completing mappings, not reimplementing tasks.

delivery input includes action (local|push|pr), targetBranch, and optional remote, commit, and prUrl; see opensuper-archive for examples. Normal entry and delivery reads do not access the network. Only `state delivery <change-name> --verify` checks remote and PR state read-only, returning `{delivery, verification}`. A successful record write does not prove delivery success. Stop for unavailable commands, rejected operations, or inconsistent records; do not bypass checks by editing internal state.

guard `--apply` updates state after checks pass. Use `opensuper state transition` when directly invoking a state-machine event. After phase advancement, follow auto-transition.md using the successful result's `agent.continuation`. Query next only when returned state is missing or invalid.

## Automatic State Updates

guard accepts `--apply` to update `.opensuper.yaml` automatically after validation:

```bash
opensuper guard <change-name> <phase> --apply
```

`--apply` invokes state-machine transitions internally. To invoke an event directly, use:

```bash
opensuper state transition <change-name> open-complete
opensuper state transition <change-name> design-complete
opensuper state transition <change-name> build-complete
opensuper state transition <change-name> verify-pass
opensuper state transition <change-name> verify-fail
opensuper state transition <change-name> archive-confirm
opensuper state transition <change-name> archive-reopen
opensuper state transition <change-name> archived
opensuper state transition <change-name> preset-escalate
```

Archive through `opensuper archive <change-name>`. OpenSpec first moves the change into a date-prefixed archive directory; OpenSuper then records state. Update pre-archive confirmation through `archive-confirm` or `archive-reopen`. Do not manually run the `archived` transition outside the archive procedure.

## Resolving the Next Step

After the phase Guard advances phase, follow auto-transition.md and prefer `agent.continuation` from the successful JSON result. The next phase can use this returned state without repeating next, select, or check. Query only when session recovery lacks context, external state changes, or an older result lacks this information:

```bash
opensuper state next <change-name>
```

Output includes `NEXT: auto|manual|done`, `SKILL: <skill-name>` (omitted for `done`), and `HINT` (only for `manual`). `auto_transition: false` returns `manual`: it prevents automatic invocation of the next Skill without changing the phase already advanced.

## Archive Command

Run all archive steps with:

```bash
opensuper archive <change-name>
```

## Task Context and Artifact Language

Every OpenSpec and Superpowers artifact must use the configured OpenSuper artifact language, a normalized language ID: `en` or `zh-CN`. For an existing change, prefer `configuration.language` from the current valid entry. Only if entry omits it, read `language` in `<classic-change-dir>/.opensuper.yaml` through `opensuper state get <name> language`. Before `.opensuper.yaml` exists, read `classic.language` from project `.opensuper/config.yaml`, then global `~/.opensuper/config.yaml`. Use the current user request's language only when neither is configured. Explicitly include the resolved language in prompts or ARGUMENTS sent to external OpenSpec/Superpowers Skills.

After binding the Classic workspace and reading the current `.opensuper.yaml` `phase`, automatically run `opensuper task <project-root> --task "<original user request>" --phase "<phase>" --session "<stable task id>" --json`. Add only returned `text` to context. Context Manifest (`manifest` / `<context_manifest>`) contains summaries, selection reasons, and stable IDs. When full content, sources, or verification methods are needed, run the same command with `--expand-context "<id>"`. When paths, operations, or phase change, reuse the same `--session` and pass updated `--path`, `--operation`, and `--phase` to select applicable context again.

If `<active_policies>` includes `<verification command="...">`, add those commands to current Verify checks and record their actual results. Only commands that have actually passed can promote the corresponding policy to enforced.

Use `opensuper memory remember ... --scope global|project` when the user explicitly asks to retain a preference or project convention long-term. Use `opensuper memory observe` only for stable collaboration habits reusable across tasks without an explicit request. Neither may store task summaries, progress, command output, or test results.

After actually using an item and learning its result, take `applications[].applicationId` from JSON (or `application_id` from Hook text) and run `opensuper task <project-root> --task "<original user request>" --application "<application-id>" --outcome used-successfully|ignored|overridden|corrected|contributed-to-failure --json`. Report outcomes truthfully; never mark unused items as successfully used. At task end, still run `opensuper task` with `--complete --workflow <workflow> --change <change-id>` to record the checkpoint.

Without Hooks, the Skill calls the same interface. `opensuper memory context` is only a compatibility entry. Missing plugin results or failed calls do not block the workflow.
