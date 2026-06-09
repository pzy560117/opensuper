# Changelog

All notable changes to opensuper will be documented in this file.

## What's Changed [Unreleased]

## What's Changed [0.2.7] - 2026-06-09

### Changed

- **Windows shell test runtime selection**: `scripts/run-bats.js` and shell-script tests now prefer Git Bash on Windows before falling back to the WSL launcher `bash`, with `OPENSUPER_BASH` available for custom paths
- **README release links**: English and Chinese README files now point to `releases/latest` instead of a hardcoded tag
- **README asset URLs**: README images now use raw GitHub content URLs for more reliable npm and GitHub rendering
- **Contribution docs**: `CONTRIBUTING.md` now reflects the real default branch (`main`), documents `format:check`, and adds Windows notes for shell testing
- **Project rules and guide**: Root `AGENTS.md` and `CLAUDE.md` now describe OpenSuper's project-level execution model, and a new Chinese guide maps OpenSpec, Superpowers, worktree isolation, and Harness Engineering into this repository
- **Author-perspective analysis**: The Chinese guide now explains `pzy560117/opensuper` as the author's own engineering sample, including its design motives, problem framing, and why it is useful as a methodology reference
- **C/C++ and TS guidance**: The Chinese guide now explains why OpenSuper is particularly effective for C/C++ and TypeScript projects, including recommended verification patterns and `build_command` / `verify_command` examples
- **Origin and talk-track docs**: Added dedicated Chinese docs for OpenSuper's origin, evolution, and recommended external storytelling structure
- **Presentation transcript**: Added a cleaned Chinese transcript doc based on the author's pasted presentation text, preserving original positioning and demo narrative

### Fixed

- **Windows shell-script flakiness**: Portable shell tests no longer fail on machines where `bash` resolves to the WSL launcher but no working Linux userland is installed
- **Long-running shell-script test timeout**: The verification scaling integration test now uses an explicit timeout that matches its real runtime on Windows
- **README license links**: English and Chinese README files now link to the actual `LICENSE` file

## What's Changed [0.2.6] - 2026-05-23

### Added

- **Build decision enforcement**: Build guard and `opensuper-state.sh transition build-complete` now require `isolation` and `build_mode` before moving from build to verify
- **Direct mode override**: Full workflows must set `direct_override: true` before using `build_mode: direct`; hotfix/tweak remain allowed by default
- **Configurable guard commands**: Guard scripts now read `build_command` and `verify_command` from the change `.opensuper.yaml` or repo-root OpenSuper config before falling back to auto-detected build commands
- **Archive diff preview**: Archive sync prints a unified diff before overwriting an existing main spec when it differs from the delta spec
- **Cross-platform script smoke CI**: Added Ubuntu, macOS, and Windows smoke coverage for OpenSuper shell scripts and portable shell tests
- **Shell line-ending policy**: Added `.gitattributes` rules to keep shell and Bats scripts on LF endings

### Changed

- **Guard failure output**: Guard checks now preserve and print command failure output, plus actionable `Next:` hints for missing build decisions and unfinished tasks
- **Command handling**: Project commands run through `bash -lc`, Maven uses `mvnw` or `mvn.cmd` where appropriate, and Windows Git Bash paths are handled in shell test helpers
- **Archive step counting**: Dry-run, delta sync, annotation, move, and archive status steps now count real executed steps without double-counting repeated operations
- **English docs and skills**: Synced the English README and OpenSuper skill text with the Chinese build-decision, command-config, and archive behavior descriptions

### Fixed

- **macOS shell script state updates**: Replaced GNU-only `sed -i` writes in `opensuper-state.sh` with portable temp-file updates, fixing macOS CI failures during `scale`, `transition`, and YAML field updates
- **Optional field reads under pipefail**: Guard and state scripts now tolerate missing optional YAML fields without exiting early under `set -euo pipefail`
- **Bash detection fallback**: Shell test helpers now handle failed `bash` probes without crashing on empty `spawnSync` output
- **Configured command persistence**: `opensuper-state.sh set` now escapes sed replacement metacharacters so command values containing `&`, `|`, or backslashes are preserved
- **Optional schema fields**: YAML validation now recognizes `direct_override`, `build_command`, and `verify_command`
- **Quoted YAML values**: State, guard, and validator scripts now strip only wrapping quotes instead of deleting all quote characters from values

### Tests

- Added coverage for missing build decisions, direct-mode override blocking and allowance, configured build/verify commands, command metacharacter preservation, unfinished-task remediation output, archive step counts, cross-platform path handling, BSD/GNU sed portability, optional YAML field reads under `pipefail`, and failed bash probe handling

## What's Changed [0.2.5] - 2026-05-22

### Added

- **PR title lint workflow**: Added GitHub Actions validation for semantic PR titles with OpenSuper-specific scopes (`cli`, `commands`, `core`, `skills`, `assets`, `scripts`, `docs`, `ci`, `deps`, `release`)
- **Structured JSON output**: `opensuper init --json` and `opensuper update --json` now emit machine-readable results instead of mixed human logs
- **`doctor --scope`**: `opensuper doctor` can diagnose `auto`, `project`, or `global` scope, with `auto` checking both project and global installs
- **Next-step status hint**: `opensuper status` now reports the next workflow command (`/opensuper-open`, `/opensuper-design`, `/opensuper-build`, `/opensuper-verify`, `/opensuper-archive`) in text and JSON output
- **README asset guard**: Added tests and prepublish validation to keep README images on npm-friendly absolute URLs

### Changed

- **`opensuper update` preserves installed context**: Update now detects existing OpenSuper skill targets across project/global scopes, preserves installed scope, detects Chinese vs English skills, and updates only platforms where OpenSuper skills are already installed
- **`opensuper update` self-updates npm package**: Update now prints and runs the matching npm update command for the detected package scope before refreshing installed skills
- **Friendlier update output**: Update logs the npm command, per-target skill copy command, final npm status, updated target count, scope, and language summary
- **Init overwrite flow**: Interactive `opensuper init` now offers a bulk overwrite/skip choice when multiple existing components are detected on the same platform
- **CLI option validation**: `update --language`, `update --scope`, and `doctor --scope` now validate accepted values through Commander choices
- **README CLI docs**: Updated English and Chinese README command sections to document JSON output, doctor scope, update behavior, status next-step hints, and init overwrite behavior
- **CONTRIBUTING link**: Added contribution guide references to both English and Chinese README development sections

### Fixed

- **Doctor false positives**: `opensuper doctor` now recognizes current `.opensuper.yaml` fields including `verification_report` and `branch_status`
- **npm README images**: README images now use absolute GitHub URLs so package pages can render them

### Tests

- Added coverage for update language/scope detection, JSON output, friendly command display, status next-step hints, doctor current-state validation, README image URLs, init bulk overwrite selection, and PR title workflow configuration

## What's Changed [0.2.4] - 2026-05-21

### Added

- **Verification evidence enforcement**: `verify-pass` transition now requires `verification_report` (file must exist) and `branch_status: handled` before allowing phase advance. Guard checks these as hard prerequisites
- **`verification_report` and `branch_status` fields** in `.opensuper.yaml`: New state fields track verification report path and branch handling status
- **Verification evidence step** in opensuper-verify (zh): New Step 4 requiring report file creation and branch status recording before guard apply
- **`branch_status` enum validation**: `opensuper-state.sh set` validates `branch_status` as `pending` or `handled`
- **Guard verify checks**: `opensuper-guard.sh` now checks `verification_report exists` and `branch_status=handled` during verify phase
- **Bats test CRLF fix**: Shell tests strip `\r` from scripts before execution, fixing Windows compatibility
- **`test:shell` runner**: Replaced direct `bats` call with `node scripts/run-bats.js` for cross-platform support

### Changed

- **Hotfix root cause check reordered**: Moved root cause elimination check **before** opensuper-verify loading (Step 3a → 3b split), preventing it from being skipped during verify flow
- **Hotfix header description simplified**: Replaced ambiguous "not a separate parallel process" with direct "Quick bug fix workflow" for standalone invocation clarity
- **Removed non-action steps from opensuper-design**: Deleted Step 3 (Dual Spec Division table) and Step 4 (Document Hierarchy) — pure reference material with no agent actions
- **Removed duplicate script location blocks**: opensuper-open (Step 3) and opensuper-archive (Step 1) no longer repeat the full `OPENSUPER_SEARCH_ROOTS` find block when variables already cached
- **Removed duplicate 50% threshold in opensuper-build**: Single mention in threshold determination table instead of table + bullet repetition
- **Generic error handling**: Error table in opensuper main skill changed "Maven compile/test" → "Build/test" for language-agnostic wording
- **opensuper-state.sh usage help**: Fixed `check` parameter order in help text (`check <change-name> <phase>`)

### Fixed

- **opensuper-state.sh `init` change directory resolution**: `cmd_init` now resolves `change_dir` before checking if `.opensuper.yaml` already exists, fixing path resolution for nested directories
- **Guard deadlock on verify**: `verify-pass` transition now resets `verification_report` and `branch_status` when rolling back via `verify-fail`, preventing stale evidence from allowing false transitions

### Tests

- **+66 lines** in `opensuper-scripts.test.ts`: New tests for verification evidence blocking, branch status validation, and guard verify with evidence
- **+12 lines** in `opensuper-state.bats`: New tests for `branch_status` enum validation, CRLF stripping, and new field presence in init output

## What's Changed [0.2.3] - 2026-05-19

### Added

- **"Why OpenSuper" section**: README now explains the rationale behind OpenSuper — how it combines OpenSpec's WHAT management with Superpowers' HOW execution into a unified 5-phase pipeline
- **"Screenshots" section**: Added three screenshots demonstrating platform selection, initialization, and skill execution in action
- **"What You'll Learn" section**: New section showcasing OpenSuper as a reference for stable nested skill triggering and multi-phase auto-flow patterns
- **State Management YAML example**: Extended documentation with complete `.opensuper.yaml` field example showing all key configuration values

### Changed

- **opensuper-build skill description**: Clarified that execution mode (subagent vs executing-plans) is user-selectable based on task complexity, not always subagent-driven
- **Enhanced State Management docs**: Added explanation of how all states and phases are updated via scripts with completion validation before phase transitions

## What's Changed [0.2.2] - 2026-05-18

### Fixed

- **Ctrl+Z/Ctrl+C crash during `opensuper init`**: Wrapped inquirer prompts in try/catch to handle `ExitPromptError`, showing `Cancelled.` and exiting cleanly instead of printing a raw stack trace
- **Duplicate Superpowers installation**: `opensuper init` now detects Superpowers installed via Claude Code plugin system (`~/.claude/plugins/cache/`), skipping redundant `npx skills add` when Superpowers plugin is already present

## What's Changed [0.2.1] - 2026-05-18

### Fixed

- **CI pnpm version**: Added `packageManager` field for pnpm/action-setup v4
- **Shell scripts**: Fixed `SCRIPT_DIR` typo, renamed `maven_compiles` → `build_passes` (language-agnostic), fixed `check_nonempty` path bug, fixed `cmd_set` sed delimiter for path values, corrected shellcheck directive placement
- **Node version**: Bumped minimum to Node 20 (vitest v4 coverage requires `node:inspector/promises`)

## What's Changed [0.2.0] - 2026-05-18

OpenSuper 0.2.0 is a comprehensive optimization release: skill reliability, CLI completeness, and engineering quality.

### Skill Reliability

- **SKILL.md two-zone structure**: All 8 skills split into "Decision Core" (phase detection, upgrade criteria, error handling) and "Reference Appendix" (field reference, scripts, best practices)
- **Quantified upgrade criteria**: Hotfix/tweak now define explicit thresholds for upgrading to full workflow (file count, cross-module coordination, architecture changes, etc.)
- **Script location caching**: All skills use `${VAR:-$(find ...)}` env-var cache pattern, avoiding repeated `find` calls
- **`manifest.json` fixed**: Added missing `opensuper-state.sh` and `opensuper-archive.sh` entries
- **`opensuper-state.sh init` fixed**: Now writes `workflow` field to `.opensuper.yaml`, fixing `check design` which always failed

### CLI Commands

- **`opensuper status`**: Show active changes with phase, task progress, workflow mode, design doc, and plan (`--json` supported)
- **`opensuper doctor`**: Diagnose installation health — OpenSpec CLI, working directories, skill completeness per platform, script presence, `.opensuper.yaml` validity (`--json` supported)
- **`opensuper update`**: Update opensuper skill files to latest version from npm package (`--language`, `--scope` supported)
- **`--json` on all commands**: `init`, `status`, `doctor`, `update` all accept structured output

### Engineering

- **Test suite**: 54 unit tests (5 suites) with 93.8% statement / 100% function coverage; 26 bats shell tests
- **GitHub Actions CI**: Build + lint + format + test (Node 18/20/22) + shellcheck + bats on push/PR
- **ESLint + Prettier**: Code quality tooling with `pnpm lint` / `pnpm format`
- **Code organization**: Monolithic `init.ts` (620 lines) split into 5 focused core modules + 4 command modules
- **Command injection hardening**: Platform/tool ID validation before shell command construction
- **Per-file error handling**: Copy loop continues past individual file failures

## What's Changed [0.1.8] - 2026-05-17

### Added

- **`opensuper-state.sh` script**: Unified state management with 5 subcommands — `init` (create .opensuper.yaml), `set` (update with enum validation), `get` (read field), `check` (entry verification), `scale` (verification mode assessment)
- **`check` subcommand**: Scripted entry verification replacing text checklists in all 8 skills
- **`scale` subcommand**: Scripted scale assessment replacing prose decision rules in opensuper-verify

### Changed

- **All `.opensuper.yaml` writes go through `opensuper-state.sh`**: No more raw `sed -i` — enum validation on every field write
- **All skill Step 0 checklists replaced with `check` subcommand**: Single command replaces text-based entry verification
- **`opensuper-guard.sh` and `opensuper-archive.sh` use state.sh internally**: All state mutations through unified interface
- **Removed write-verification blocks**: hotfix and tweak presets no longer have manual verification loops

## What's Changed [0.1.7] - 2026-05-16

### Added

- **`opensuper-archive.sh` script**: One-command archive automation — validates entry state, syncs delta specs to main specs (overwrite), annotates design doc and plan frontmatter, moves change to archive directory, updates `archived: true`. Supports `--dry-run` for preview
- **`--apply` mode for `opensuper-guard.sh`**: Opt-in flag that auto-updates `.opensuper.yaml` state fields after all guard checks pass. No manual state editing required during phase transitions
- **Idempotent frontmatter annotation**: `annotate_frontmatter()` skips existing `archived-with:` lines, safe to re-run

### Changed

- **Removed manual state editing**: All phase transitions (design → build → verify → archive) now use `guard --apply` instead of manual `.opensuper.yaml` field updates and write-verification loops
- **Removed write-verification blocks**: Eliminated all `【写入验证】` / `【Write verification】` patterns from opensuper-open, opensuper-design, opensuper-build, opensuper-verify, and opensuper-archive skills
- **Removed `## ADDED`/`## MODIFIED`/`## REMOVED` delta format**: Delta specs are now complete specs; archive overwrites main spec instead of merging fragments
- **Removed step 2b from opensuper-open**: Incremental modification of existing capabilities is just a new `/opensuper-open` — brainstorming reads existing specs as context naturally
- **Simplified archive skill**: Steps 1b–5 replaced with single `opensuper-archive.sh` call
- **Updated `opensuper/SKILL.md`**: Script location section now documents both `--apply` mode and archive script

### Removed

- Few-shot YAML examples for `isolation`, `build_mode`, `verify_mode` fields (redundant with agent judgment)
- `openspec-archive-change` skill dependency from opensuper-archive (archive script handles all steps)

## What's Changed [0.1.6] - 2026-05-16

### Added

- **Workspace Isolation Selection**: `opensuper-build` now prompts users to choose between creating a branch or a worktree before execution begins (Step 3: Workspace Isolation)
- **`isolation` field in `.opensuper.yaml`**: New required field (`branch` or `worktree`) to record the user's workspace isolation choice
- **`isolation` enum validation**: `opensuper-yaml-validate.sh` now validates `isolation` as a required field with allowed values `branch`/`worktree`

### Changed

- `opensuper-build` step numbering: Step 3 (Select Execution Method) → Step 4, Step 4 (Spec Incremental Updates) → Step 5
- Hotfix and tweak presets default to `isolation: branch` without prompting
- `opensuper-yaml-validate.sh` `REQUIRED_FIELDS` and `KNOWN_KEYS` updated to include `isolation`

## What's Changed [0.1.5] - 2026-05-15

### Added

- **Bilingual OpenSuper skills**: `opensuper init` now prompts for language selection (English / 中文) and deploys the corresponding SKILL.md files
- **Language-aware asset structure**: English skills in `assets/skills/`, Chinese skills in `assets/skills-zh/`
- **`languages` field in manifest.json**: Maps language IDs to asset directories for future extensibility

### Changed

- All 8 OpenSuper SKILL.md files in `assets/skills/` are now English (Chinese originals preserved in `assets/skills-zh/`)
- `copyOpenSuperSkillsForPlatform` accepts `languageSkillsDir` parameter; script files always sourced from default `skills/` directory
- `--yes` mode defaults to English language selection

## What's Changed [0.1.4] - 2026-05-15

### Fixed

- **Superpowers redundant project-level install**: `opensuper init` now checks the global directories (`~/{platform}/skills/`) of all user-selected platforms before installing Superpowers. If Superpowers is already installed globally for any selected platform, the project-level install is skipped
- **Unwanted `.agents/` directory creation**: `opensuper init` now passes `--agent` flag to `skills add`, targeting only the platforms the user selected. This prevents the skills CLI from auto-detecting and installing to all platforms, which previously created an unnecessary `.agents/` directory
- **OpenSpec global detection**: Same global-directory fallback logic applied to OpenSpec detection, avoiding redundant OpenSpec installs when already present globally for selected platforms

### Changed

- `hasSkills()` accepts `selectedPlatforms` parameter to scope global detection to user-chosen platforms only
- `installSuperpowersForPlatform()` replaced with `installSuperpowersForPlatforms()` that accepts platform IDs and maps them to skills CLI agent names via `SKILLS_AGENT_MAP`

## What's Changed [0.1.3] - 2026-05-15

### Added

- **State File Separation**: OpenSuper workflow state now stored in independent `.opensuper.yaml` file instead of `.openspec.yaml` subtree
- **Three-Layer Reliability Defense**:
  - Entry verification for all phases with `[HARD STOP]` diagnostics
  - Write-then-verify pattern for all state mutations
  - Schema validator script (`opensuper-yaml-validate.sh`) with field, enum, and path validation
- **Path Traversal Protection**: Input validation for change names to prevent directory traversal attacks
- **Guard Script Integration**: Automatic schema validation during phase transitions

### Changed

- Updated all 9 OpenSuper skills to use `.opensuper.yaml` instead of `.openspec.yaml` opensuper: subtree
- Improved error messages with specific field values instead of generic placeholders
- Enhanced project structure documentation

### Security

- Fixed path traversal vulnerability through unvalidated change name inputs
- Schema validation now catches typos and invalid enum values at entry point
