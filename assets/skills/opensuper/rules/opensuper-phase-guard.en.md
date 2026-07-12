# opensuper Phase Awareness (Anti-Drift Rules)

> This rule is injected every round to prevent forgetting opensuper workflow state during long context.
> The Hook platform additionally executes `opensuper-hook-guard.sh` for hard interception;
> this Rule is a universal soft defense line for all platforms.

## Global Rules

### Phase Awareness (Highest Priority)

When there is an active opensuper change (`openspec/changes/<name>/.opensuper.yaml` exists), **before starting any operation** you must read the `phase` field to confirm the current phase.

**Phases and allowed operations:**

| Phase | Allowed | Prohibited |
|-------|---------|------------|
| `open` | Create proposal/design/tasks, run guard | Write source code |
| `design` | brainstorming, create Design Doc, run guard | Write source code |
| `build` | Write source code, tests, execute plans | Skip user confirmation points |
| `verify` | Verification, branch handling | Skip failure handling |
| `archive` | Confirm archive, run archive script | Write source code |

### Skill Invocation (Cannot Replace with Normal Conversation)

The following operations must be loaded through the Skill tool. When Skill is unavailable, stop the workflow and prompt to install:

- **brainstorming** — design phase, build phase medium-scale spec changes
- **writing-plans** — build phase creating implementation plans
- **executing-plans** / **subagent-driven-development** — build phase execution
- **test-driven-development** — in `executing-plans`, the main session loads it before the first task; in `subagent-driven-development`, each background implementer and fix agent loads it
- **systematic-debugging** — when encountering crashes/test failures/build failures
- **verification-before-completion** — verify phase
- **using-git-worktrees** — build phase when selecting worktree isolation

### Script Execution (Cannot Skip)

- **Phase exit**: `opensuper-guard <name> <phase> --apply` (must see ALL CHECKS PASSED)
- **Compression recovery**: `opensuper-state check <name> <phase> --recover`
- **State update**: After key operations, update fields through `opensuper-state set`; manually editing .opensuper.yaml is prohibited
- **handoff generation**: `opensuper-handoff <name> design --write` (handwriting summaries is prohibited)

### User Confirmation (Cannot Auto-Skip)

The following decision points must pause to wait for explicit user selection; do not auto-fill based on recommendation rules:

- **open**: Requirements clarification completion confirmation, artifact review confirmation
- **design**: brainstorming proposal confirmation (Design Doc cannot be created before confirmation)
- **build**: plan-ready pause, isolation/build_mode/tdd_mode selection, spec large-scale change confirmation
- **verify**: Verification failure handling strategy, branch handling selection
- **archive**: Final confirmation before archiving

## Design Phase Specifics

1. First script operation = `opensuper-handoff <name> design --write` (loading brainstorming before generating handoff is prohibited)
2. brainstorming in progress: incrementally update brainstorm-summary.md (update recovery checkpoint after each clarification round or proposal iteration; unconfirmed content marked as pending/candidate)
3. After brainstorming completes, next step = brainstorm-summary.md finalization → Design Doc → guard
4. active compaction gate: after brainstorm-summary.md is finalized and before creating Design Doc, prioritize triggering host platform's native context compression; when programmatic triggering is unavailable, pause to prompt user to manually compress or confirm continuing
5. **Absolutely cannot start writing implementation code directly** — must first create Design Doc and pass guard

## Build Phase Specifics

1. After plan creation, must ask user to choose continue or pause (`build_pause` mechanism)
2. After each task acceptance, must: tasks.md checkmark → git commit (do not accumulate). `subagent-driven-development` must wait for both spec compliance and code quality reviews to pass, then the coordinator performs targeted verification by unique task text; do not use an incomplete task summary table to replace current task verification
3. When encountering failures, must load **systematic-debugging** skill; do not propose source code fixes before root cause is located
4. spec change grading: small changes edit directly | medium changes load brainstorming | large changes pause and wait for user confirmation to split

## Verify Phase Specifics

1. First step run `opensuper-state scale <name>` to determine verification level
2. After verification fails, list failed items and wait for user selection; CRITICAL must be fixed
3. After 3 consecutive failures, must let user choose to accept deviation or continue fixing

## Context Compression Recovery

If context compression is suspected (previous conversation was summarized, previous discussion cannot be found), immediately run:

```bash
"$opensuper_BASH" "$opensuper_STATE" check <name> <phase> --recover
```

Decide next step according to the script's **Recovery action** output.

**Special attention to `build_mode`**: If recovery script outputs `build_mode: subagent-driven-development`, you are the coordinator, not the executor. Must:
1. Use the Skill tool to reload the Superpowers `subagent-driven-development` skill
2. Re-read `opensuper/reference/subagent-dispatch.md` for opensuper-specific extensions
3. Read `openspec/changes/<name>/.opensuper/subagent-progress.md` to recover the exact stage, evidence, and review-fix round
4. Do not execute tasks directly in the main session
5. Resume from the checkpoint; start from the first unchecked task only when it is missing or mismatched
6. Already committed but not yet passed both reviews tasks remain unchecked; continue review/fix loop
7. After dual review and targeted checkoff verification pass, immediately continue to the next task without summarizing or asking whether to continue

## Automatic Transition After Phase Exit

After guard `--apply` succeeds, must invoke the next phase's skill:

- open → `opensuper-design` (full) / `opensuper-build` (hotfix/tweak)
- design → `opensuper-build`
- build → `opensuper-verify`
- verify → `opensuper-archive`
