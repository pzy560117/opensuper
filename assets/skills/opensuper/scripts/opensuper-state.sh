#!/bin/bash
# opensuper State — unified interface for .opensuper.yaml state management
# Usage: opensuper-state.sh <subcommand> <change-name> [args...]
#
# Subcommands:
#   init <change-name> <workflow>  — Initialize .opensuper.yaml with workflow defaults
#   get <change-name> <field>       — Read a field value from .opensuper.yaml
#   set <change-name> <field> <val> — Update a field value
#   transition <change-name> <event> — Apply a validated state transition
#   check <change-name> <phase>    — Verify entry requirements for a phase
#   check <change-name> <phase> --recover — Output structured recovery context for compaction resume
#   scale <change-name>             — Assess and set verification mode based on metrics
#   task-checkoff <file> <task-text> — Verify one unique task is checked
#
# Workflows: full, hotfix, tweak
# Phases for check: open, design, build, verify, archive

set -euo pipefail

opensuper_BASH="${opensuper_BASH:-${BASH:-bash}}"

# --- Color output helpers ---

red() { echo -e "\033[31m$1\033[0m" >&2; }
green() { echo -e "\033[32m$1\033[0m" >&2; }
yellow() { echo -e "\033[33m$1\033[0m" >&2; }

# --- Script location ---

# shellcheck disable=SC2034
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- Input validation ---

validate_change_name() {
  local name="$1"
  # Reject empty names
  if [ -z "$name" ]; then
    red "ERROR: Change name cannot be empty" >&2
    exit 1
  fi
  # Only allow alphanumeric, hyphens, and underscores
  if [[ ! "$name" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    red "ERROR: Invalid change name: '$name'" >&2
    red "Valid characters: a-z, A-Z, 0-9, -, _" >&2
    exit 1
  fi
  # Reject path traversal attempts
  if [[ "$name" =~ \.\. ]]; then
    red "ERROR: Change name cannot contain '..' (path traversal not allowed)" >&2
    exit 1
  fi
}

validate_enum() {
  local value="$1"
  shift
  local valid_values=("$@")

  for valid in "${valid_values[@]}"; do
    if [ "$value" = "$valid" ]; then
      return 0
    fi
  done

  red "ERROR: Invalid value: '$value'" >&2
  red "Valid values: ${valid_values[*]}" >&2
  exit 1
}

validate_path_field() {
  local value="$1"
  local field="$2"
  # null and empty are acceptable (means "not set")
  if [ -z "$value" ] || [ "$value" = "null" ]; then
    return 0
  fi
  # Reject absolute paths and home-directory references
  case "$value" in
    /*|~*|[A-Za-z]:*|\\*)
      red "ERROR: $field must be a relative path within the repo: '$value'" >&2
      exit 1
      ;;
  esac
  if [[ "$value" =~ \.\. ]]; then
    red "ERROR: $field cannot contain '..' (path traversal not allowed): '$value'" >&2
    exit 1
  fi
}

validate_opentest_result_path() {
  local value="$1"
  if [ -z "$value" ]; then
    red "ERROR: opentest_strict_result cannot be empty" >&2
    exit 1
  fi
  if [ "$value" = "null" ]; then
    return 0
  fi

  validate_path_field "$value" "opentest_strict_result"
  case "$value" in
    .|./*|*/./*|*/.|*//*|*/|*\\*)
      red "ERROR: opentest_strict_result must be a canonical project-relative path: '$value'" >&2
      exit 1
      ;;
  esac
}

# --- Helper functions ---

yaml_field() {
  local field="$1"
  local yaml_file="$2"
  if [ -f "$yaml_file" ]; then
    local value
    value=$(grep "^${field}:" "$yaml_file" 2>/dev/null | sed "s/^${field}: *//" || true)
    value=$(strip_inline_comment "$value")
    strip_wrapping_quotes "$value"
  fi
}

strip_inline_comment() {
  local value="$1"
  printf '%s\n' "$value" | awk -v squote="'" '
    {
      out = ""
      quote = ""
      for (i = 1; i <= length($0); i++) {
        c = substr($0, i, 1)
        if (quote == "") {
          if (c == "\"" || c == squote) {
            quote = c
          } else if (c == "#" && (i == 1 || substr($0, i - 1, 1) ~ /[[:space:]]/)) {
            sub(/[[:space:]]+$/, "", out)
            print out
            next
          }
        } else if (c == quote) {
          quote = ""
        }
        out = out c
      }
      print out
    }
  '
}

strip_wrapping_quotes() {
  local value="$1"
  case "$value" in
    \"*\")
      printf '%s\n' "${value:1:${#value}-2}"
      ;;
    \'*\')
      printf '%s\n' "${value:1:${#value}-2}"
      ;;
    *)
      printf '%s\n' "$value"
      ;;
  esac
}

replace_yaml_field() {
  local yaml_file="$1"
  local field="$2"
  local value="$3"
  local tmp_file

  tmp_file=$(mktemp)
  chmod 600 "$tmp_file"
  # Replace the target field, then deduplicate all fields keeping only the
  # last occurrence of each key. Prevents stale earlier values from
  # persisting when a field is set multiple times.
  awk -v field="$field" -v value="$value" '
    index($0, field ":") == 1 { $0 = field ": " value }
    { buf[NR] = $0; keys[NR] = $0; sub(/:.*$/, "", keys[NR]); n = NR }
    END {
      for (i = 1; i <= n; i++) last[keys[i]] = i
      for (i = 1; i <= n; i++) if (last[keys[i]] == i) print buf[i]
    }
  ' "$yaml_file" > "$tmp_file"
  mv "$tmp_file" "$yaml_file"
}

write_yaml_field() {
  local yaml_file="$1"
  local field="$2"
  local value="$3"

  if grep -q "^${field}:" "$yaml_file"; then
    replace_yaml_field "$yaml_file" "$field" "$value"
  else
    echo "${field}: ${value}" >> "$yaml_file"
  fi
}

file_nonempty() {
  [ -f "$1" ] && [ -s "$1" ]
}

change_dir_for() {
  local change_name="$1"
  if [ -d "openspec/changes/$change_name" ]; then
    echo "openspec/changes/$change_name"
  elif [ -d "openspec/changes/archive/$change_name" ]; then
    echo "openspec/changes/archive/$change_name"
  else
    echo "openspec/changes/$change_name"
  fi
}

yaml_file_for() {
  local change_name="$1"
  local change_dir
  change_dir=$(change_dir_for "$change_name")
  echo "$change_dir/.opensuper.yaml"
}

project_context_compression() {
  local value="off"
  local source="default"
  if [ -n "${opensuper_CONTEXT_COMPRESSION:-}" ]; then
    value="$opensuper_CONTEXT_COMPRESSION"
    source="opensuper_CONTEXT_COMPRESSION"
  elif [ -f ".opensuper/config.yaml" ]; then
    value=$(yaml_field "context_compression" ".opensuper/config.yaml")
    value="${value:-off}"
    source=".opensuper/config.yaml"
  fi

  case "$value" in
    off|beta)
      printf '%s\n' "$value"
      ;;
    *)
      red "ERROR: Invalid context_compression from ${source}: '$value'" >&2
      red "Valid values: off, beta" >&2
      exit 1
      ;;
  esac
}

project_auto_transition_default() {
  local value="true"
  local source="default"
  if [ -n "${opensuper_AUTO_TRANSITION:-}" ]; then
    value="$opensuper_AUTO_TRANSITION"
    source="opensuper_AUTO_TRANSITION"
  elif [ -f ".opensuper/config.yaml" ]; then
    local raw
    raw=$(yaml_field "auto_transition" ".opensuper/config.yaml" 2>/dev/null || true)
    if [ -n "$raw" ]; then
      value="$raw"
      source=".opensuper/config.yaml"
    fi
  fi

  case "$value" in
    true|false)
      printf '%s\n' "$value"
      ;;
    *)
      red "ERROR: Invalid auto_transition from ${source}: '$value'" >&2
      red "Valid values: true, false" >&2
      exit 1
      ;;
  esac
}

# --- Subcommands ---

cmd_init() {
  local change_name="$1"
  local workflow="$2"

  validate_change_name "$change_name"
  validate_enum "$workflow" "full" "hotfix" "tweak"

  local change_dir yaml_file
  change_dir=$(change_dir_for "$change_name")
  yaml_file=$(yaml_file_for "$change_name")

  # Check if .opensuper.yaml already exists
  if [ -f "$yaml_file" ]; then
    red "ERROR: .opensuper.yaml already exists at $yaml_file"
    exit 1
  fi

  # Create change directory if it doesn't exist
  mkdir -p "$change_dir"

  # Set workflow-appropriate defaults
  local phase build_mode isolation verify_mode context_compression auto_transition
  phase="open"
  context_compression=$(project_context_compression)
  auto_transition="$(project_auto_transition_default)"

  case "$workflow" in
    full)
      build_mode="null"
      tdd_mode="null"
      isolation="null"
      verify_mode="null"
      ;;
    hotfix|tweak)
      build_mode="direct"
      tdd_mode="direct"
      isolation="branch"
      verify_mode="light"
      ;;
  esac

  # Write .opensuper.yaml
  # Record current HEAD as base_ref for scale assessment fallback
  local base_ref="null"
  if git rev-parse --verify HEAD >/dev/null 2>&1; then
    base_ref=$(git rev-parse HEAD 2>/dev/null || echo "null")
  fi

  cat > "$yaml_file" <<EOF
workflow: $workflow
phase: $phase
context_compression: $context_compression
build_mode: $build_mode
build_pause: null
subagent_dispatch: null
tdd_mode: $tdd_mode
isolation: $isolation
verify_mode: $verify_mode
auto_transition: $auto_transition
base_ref: $base_ref
design_doc: null
plan: null
verify_result: pending
verification_report: null
branch_status: pending
opentest_gate: null
opentest_strict_result: null
created_at: $(date -u +%Y-%m-%d)
verified_at: null
archived: false
archive_confirmation: pending
EOF

  green "Initialized: $yaml_file (workflow=$workflow)"
}

cmd_get() {
  local change_name="$1"
  local field="$2"

  validate_change_name "$change_name"

  local yaml_file
  yaml_file=$(yaml_file_for "$change_name")

  # Check if .opensuper.yaml exists
  if [ ! -f "$yaml_file" ]; then
    red "ERROR: .opensuper.yaml not found at $yaml_file"
    exit 1
  fi

  # Read and output the field value
  local value
  value=$(yaml_field "$field" "$yaml_file")
  if [ "$field" = "auto_transition" ] && { [ -z "$value" ] || [ "$value" = "null" ]; }; then
    value="$(project_auto_transition_default)"
  fi
  echo "${value:-}"
}

cmd_set() {
  local change_name="$1"
  local field="$2"
  local value="$3"

  validate_change_name "$change_name"

  local yaml_file
  yaml_file=$(yaml_file_for "$change_name")

  # Check if .opensuper.yaml exists
  if [ ! -f "$yaml_file" ]; then
    red "ERROR: .opensuper.yaml not found at $yaml_file"
    exit 1
  fi

  # Validate field name
  case "$field" in
    phase)
      if [ "${OPENSUPER_FORCE_PHASE:-0}" = "1" ]; then
        yellow "WARNING: OPENSUPER_FORCE_PHASE=1 is a repair-only override; phase transition checks were bypassed." >&2
      else
        red "ERROR: Direct phase updates are blocked to preserve state machine constraints." >&2
        red "Use: opensuper-state.sh transition <change-name> <event>" >&2
        red "Repair only: set OPENSUPER_FORCE_PHASE=1 for an explicit manual state repair." >&2
        exit 1
      fi
      ;;
    workflow|context_compression|build_mode|build_pause|subagent_dispatch|tdd_mode|isolation|verify_mode|auto_transition|verify_result|verification_report|branch_status|opentest_gate|opentest_strict_result|archived|archive_confirmation|design_doc|plan|verified_at|created_at|direct_override|build_command|verify_command|handoff_context|handoff_hash|base_ref)
      # Valid field
      ;;
    *)
      red "ERROR: Unknown field: '$field'" >&2
      red "Valid fields:" >&2
      red "  workflow, phase, context_compression, design_doc, plan, build_mode, build_pause, subagent_dispatch, tdd_mode, isolation," >&2
      red "  verify_mode, auto_transition, verify_result, verification_report, branch_status," >&2
      red "  opentest_gate, opentest_strict_result," >&2
      red "  verified_at, created_at, archived, archive_confirmation, base_ref, direct_override," >&2
      red "  build_command, verify_command, handoff_context, handoff_hash" >&2
      exit 1
      ;;
  esac

  # Validate enum values
  case "$field" in
    workflow)
      validate_enum "$value" "full" "hotfix" "tweak"
      ;;
    context_compression)
      validate_enum "$value" "off" "beta"
      ;;
    phase)
      validate_enum "$value" "open" "design" "build" "verify" "archive"
      ;;
    build_mode)
      validate_enum "$value" "subagent-driven-development" "executing-plans" "direct"
      ;;
    build_pause)
      validate_enum "$value" "null" "plan-ready"
      ;;
    subagent_dispatch)
      validate_enum "$value" "null" "confirmed"
      ;;
    tdd_mode)
      validate_enum "$value" "tdd" "direct"
      ;;
    isolation)
      validate_enum "$value" "branch" "worktree"
      ;;
    verify_mode)
      validate_enum "$value" "light" "full"
      ;;
    auto_transition)
      validate_enum "$value" "true" "false"
      ;;
    verify_result)
      validate_enum "$value" "pending" "pass" "fail"
      ;;
    branch_status)
      validate_enum "$value" "pending" "handled"
      ;;
    opentest_gate)
      validate_enum "$value" "required" "not-applicable" "null"
      ;;
    opentest_strict_result)
      validate_opentest_result_path "$value"
      ;;
    archived)
      red "ERROR: Direct archived updates are blocked." >&2
      red "Use: opensuper-state.sh transition <change-name> archived" >&2
      exit 1
      ;;
    archive_confirmation)
      red "ERROR: Direct archive_confirmation updates are blocked." >&2
      red "Use: opensuper-state.sh transition <change-name> archive-confirm" >&2
      exit 1
      ;;
    direct_override)
      validate_enum "$value" "true" "false"
      ;;
    design_doc|plan|verification_report|handoff_context|handoff_hash)
      validate_path_field "$value" "$field"
      ;;
    verified_at|created_at|build_command|verify_command)
      # No validation for date fields or project command strings
      ;;
  esac

  write_yaml_field "$yaml_file" "$field" "$value"

  green "[SET] ${field}=${value}"
}

write_transition_field() {
  local change_name="$1"
  local field="$2"
  local value="$3"
  local yaml_file

  validate_change_name "$change_name"
  yaml_file=$(yaml_file_for "$change_name")
  if [ ! -f "$yaml_file" ]; then
    red "ERROR: .opensuper.yaml not found at $yaml_file"
    exit 1
  fi

  write_yaml_field "$yaml_file" "$field" "$value"
  green "[SET] ${field}=${value}"
}

set_phase_from_transition() {
  local change_name="$1"
  local phase="$2"
  validate_enum "$phase" "open" "design" "build" "verify" "archive"
  write_transition_field "$change_name" phase "$phase"
}

set_archive_confirmation_from_transition() {
  local change_name="$1"
  local confirmation="$2"
  validate_enum "$confirmation" "pending" "confirmed"
  write_transition_field "$change_name" archive_confirmation "$confirmation"
}

require_phase() {
  local change_name="$1"
  local expected="$2"
  local actual
  actual=$(cmd_get "$change_name" "phase")
  if [ "$actual" != "$expected" ]; then
    red "ERROR: Cannot transition '$change_name': expected phase ${expected}, got ${actual}" >&2
    exit 1
  fi
}

require_verification_evidence() {
  local change_name="$1"
  local report branch_status
  report=$(cmd_get "$change_name" "verification_report")
  branch_status=$(cmd_get "$change_name" "branch_status")

  if [ -z "$report" ] || [ "$report" = "null" ] || [ ! -f "$report" ]; then
    red "ERROR: Cannot transition '$change_name': verification_report must point to an existing report file" >&2
    exit 1
  fi

  if [ "$branch_status" != "handled" ]; then
    red "ERROR: Cannot transition '$change_name': branch_status must be handled" >&2
    exit 1
  fi
}

require_opentest_gate() {
  local change_name="$1"
  local gate_script="$SCRIPT_DIR/opensuper-opentest-gate.sh"
  if [ ! -f "$gate_script" ]; then
    red "ERROR: OpenTest gate script not found: $gate_script" >&2
    exit 1
  fi
  "$opensuper_BASH" "$gate_script" "$change_name"
}

require_exit_guard() {
  local change_name="$1"
  local phase="$2"
  local guard_script="$SCRIPT_DIR/opensuper-guard.sh"
  if [ ! -f "$guard_script" ]; then
    red "ERROR: Phase guard script not found: $guard_script" >&2
    exit 1
  fi
  opensuper_GUARD_SOURCE_ONLY=0 "$opensuper_BASH" "$guard_script" "$change_name" "$phase"
}

require_build_decisions() {
  local change_name="$1"
  local workflow build_mode isolation direct_override subagent_dispatch tdd_mode
  workflow=$(cmd_get "$change_name" "workflow")
  build_mode=$(cmd_get "$change_name" "build_mode")
  isolation=$(cmd_get "$change_name" "isolation")
  direct_override=$(cmd_get "$change_name" "direct_override" 2>/dev/null || true)
  subagent_dispatch=$(cmd_get "$change_name" "subagent_dispatch" 2>/dev/null || true)
  tdd_mode=$(cmd_get "$change_name" "tdd_mode" 2>/dev/null || true)

  case "$isolation" in
    branch|worktree) ;;
    *)
      red "ERROR: Cannot transition '$change_name': isolation must be branch or worktree, got '${isolation:-null}'" >&2
      exit 1
      ;;
  esac

  case "$build_mode" in
    subagent-driven-development|executing-plans|direct) ;;
    *)
      red "ERROR: Cannot transition '$change_name': build_mode must be selected before leaving build, got '${build_mode:-null}'" >&2
      exit 1
      ;;
  esac

  if [ "$build_mode" = "direct" ] && [ "$workflow" != "hotfix" ] && [ "$workflow" != "tweak" ] && [ "$direct_override" != "true" ]; then
    red "ERROR: Cannot transition '$change_name': build_mode=direct is only allowed for hotfix/tweak unless direct_override=true" >&2
    exit 1
  fi

  if [ "$build_mode" = "subagent-driven-development" ] && [ "$subagent_dispatch" != "confirmed" ]; then
    red "ERROR: Cannot transition '$change_name': subagent_dispatch must be confirmed before using build_mode=subagent-driven-development" >&2
    exit 1
  fi

  if [ "$workflow" = "full" ] && { [ "$tdd_mode" = "null" ] || [ -z "$tdd_mode" ]; }; then
    red "ERROR: Cannot transition '$change_name': tdd_mode must be selected before leaving build (full workflow)" >&2
    exit 1
  fi
}

cmd_transition() {
  local change_name="$1"
  local event="$2"

  validate_change_name "$change_name"
  validate_enum "$event" "open-complete" "design-complete" "build-complete" "verify-pass" "verify-fail" "archive-reopen" "archive-confirm" "archived"

  case "$event" in
    open-complete)
      require_phase "$change_name" "open"
      require_exit_guard "$change_name" "open"
      local workflow
      workflow=$(cmd_get "$change_name" "workflow")
      if [ "$workflow" = "full" ]; then
        set_phase_from_transition "$change_name" design
      else
        set_phase_from_transition "$change_name" build
      fi
      ;;
    design-complete)
      require_phase "$change_name" "design"
      require_exit_guard "$change_name" "design"
      set_phase_from_transition "$change_name" build
      ;;
    build-complete)
      require_phase "$change_name" "build"
      require_build_decisions "$change_name"
      local current_verify_result
      current_verify_result=$(cmd_get "$change_name" "verify_result")
      set_phase_from_transition "$change_name" verify
      cmd_set "$change_name" verify_result pending
      # Preserve verification evidence on re-verify (verify-fail → build → build-complete)
      # so the fix can reference the original failure report
      if [ "$current_verify_result" != "fail" ]; then
        cmd_set "$change_name" verification_report null
        cmd_set "$change_name" branch_status pending
      fi
      ;;
    verify-pass)
      require_phase "$change_name" "verify"
      require_verification_evidence "$change_name"
      require_opentest_gate "$change_name"
      cmd_set "$change_name" verify_result pass
      set_archive_confirmation_from_transition "$change_name" pending
      set_phase_from_transition "$change_name" archive
      cmd_set "$change_name" verified_at "$(date -u +%Y-%m-%d)"
      ;;
    verify-fail)
      require_phase "$change_name" "verify"
      cmd_set "$change_name" verify_result fail
      set_phase_from_transition "$change_name" build
      # Preserve branch_status so re-verify doesn't require re-handling branches
      ;;
    archive-reopen)
      require_phase "$change_name" "archive"
      local archived
      archived=$(cmd_get "$change_name" "archived")
      if [ "$archived" = "true" ]; then
        red "ERROR: Cannot transition '$change_name': already archived" >&2
        exit 1
      fi
      cmd_set "$change_name" verify_result pending
      set_archive_confirmation_from_transition "$change_name" pending
      set_phase_from_transition "$change_name" verify
      cmd_set "$change_name" verified_at null
      ;;
    archive-confirm)
      require_phase "$change_name" "archive"
      local archived
      archived=$(cmd_get "$change_name" "archived")
      if [ "$archived" = "true" ]; then
        red "ERROR: Cannot confirm archive for '$change_name': already archived" >&2
        exit 1
      fi
      set_archive_confirmation_from_transition "$change_name" confirmed
      ;;
    archived)
      require_phase "$change_name" "archive"
      local archived
      archived=$(cmd_get "$change_name" "archived")
      if [ "$archived" = "true" ]; then
        red "ERROR: Cannot transition '$change_name': already archived" >&2
        exit 1
      fi
      local archive_confirmation
      archive_confirmation=$(cmd_get "$change_name" "archive_confirmation")
      if [ "$archive_confirmation" != "confirmed" ]; then
        red "ERROR: Cannot transition '$change_name' to archived: archive_confirmation must be confirmed" >&2
        exit 1
      fi
      local change_dir
      change_dir=$(change_dir_for "$change_name")
      case "$change_dir" in
        openspec/changes/archive/*) ;;
        *)
          red "ERROR: Cannot transition '$change_name' to archived before the change is moved into openspec/changes/archive/." >&2
          red "Use the opensuper archive workflow instead of marking an active change archived." >&2
          exit 1
          ;;
      esac
      local verify_result
      verify_result=$(cmd_get "$change_name" "verify_result")
      if [ "$verify_result" != "pass" ]; then
        red "ERROR: Cannot transition '$change_name' to archived: verify_result must be pass" >&2
        exit 1
      fi
      require_opentest_gate "$change_name"
      write_transition_field "$change_name" archived true
      ;;
  esac

  green "[TRANSITION] ${event}"
}

# --- Check helpers for entry verification ---

CHECK_BLOCK=0

check_pass() {
  local msg="$1"
  echo "  $(green "[PASS]") $msg"
}

check_fail() {
  local msg="$1"
  echo "  $(red "[FAIL]") $msg"
  CHECK_BLOCK=1
}

check_nonempty() {
  local desc="$1"
  local path="$2"
  if file_nonempty "$path"; then
    check_pass "$desc non-empty"
  else
    check_fail "$desc missing or empty"
  fi
}

check_yaml_is() {
  local field="$1"
  local expected="$2"
  local change_name="$3"
  local actual
  actual=$(cmd_get "$change_name" "$field")
  if [ "$actual" = "$expected" ]; then
    check_pass "${field}=${actual} (expected: ${expected})"
  else
    check_fail "${field}=${actual} (expected: ${expected})"
  fi
}

check_yaml_empty() {
  local field="$1"
  local change_name="$2"
  local value
  value=$(cmd_get "$change_name" "$field")
  if [ -z "$value" ] || [ "$value" = "null" ]; then
    check_pass "${field} is empty/null"
  else
    check_fail "${field}=${value} (expected: empty/null)"
  fi
}

check_file_not_exists() {
  local desc="$1"
  local path="$2"
  if [ ! -f "$path" ]; then
    check_pass "$desc does not exist"
  else
    check_fail "$desc exists (should not exist)"
  fi
}

cmd_check() {
  local change_name="$1"
  local phase="$2"

  validate_change_name "$change_name"
  validate_enum "$phase" "open" "design" "build" "verify" "archive"

  local change_dir="openspec/changes/$change_name"
  local yaml_file="$change_dir/.opensuper.yaml"
  local proposal_file="$change_dir/proposal.md"
  local design_file="$change_dir/design.md"
  local tasks_file="$change_dir/tasks.md"

  echo "=== Entry Check: opensuper-${phase} ==="

  # .opensuper.yaml must exist for all phases (state machine core)
  if [ ! -f "$yaml_file" ]; then
    red "ERROR: .opensuper.yaml not found at $yaml_file"
    exit 1
  fi

  # Phase-specific checks
  case "$phase" in
    open)
      check_pass ".opensuper.yaml exists"
      check_yaml_is "phase" "open" "$change_name"
      ;;
    design)
      check_pass ".opensuper.yaml exists"
      check_yaml_is "phase" "design" "$change_name"
      check_yaml_is "workflow" "full" "$change_name"
      check_yaml_empty "design_doc" "$change_name"
      check_nonempty "proposal.md" "$proposal_file"
      check_nonempty "design.md" "$design_file"
      check_nonempty "tasks.md" "$tasks_file"
      ;;
    build)
      check_pass ".opensuper.yaml exists"
      check_yaml_is "phase" "build" "$change_name"
      # design_doc required for full workflow only
      local workflow
      workflow=$(cmd_get "$change_name" "workflow")
      if [ "$workflow" = "full" ]; then
        local design_doc
        design_doc=$(cmd_get "$change_name" "design_doc")
        if [ -n "$design_doc" ] && [ "$design_doc" != "null" ] && [ -f "$design_doc" ]; then
          check_pass "design_doc=${design_doc} (file exists)"
        else
          check_fail "design_doc=${design_doc} (expected: non-null and file exists)"
        fi
      else
        check_pass "workflow=${workflow} (design_doc not required)"
      fi
      check_nonempty "proposal.md" "$proposal_file"
      check_nonempty "tasks.md" "$tasks_file"
      ;;
    verify)
      check_pass ".opensuper.yaml exists"
      check_yaml_is "phase" "verify" "$change_name"
      # Check verify_result is pending or null
      local verify_result
      verify_result=$(cmd_get "$change_name" "verify_result")
      if [ "$verify_result" = "pending" ] || [ -z "$verify_result" ] || [ "$verify_result" = "null" ]; then
        check_pass "verify_result=${verify_result} (expected: pending or null)"
      else
        check_fail "verify_result=${verify_result} (expected: pending or null)"
      fi
      ;;
    archive)
      check_pass ".opensuper.yaml exists"
      check_yaml_is "phase" "archive" "$change_name"
      check_yaml_is "verify_result" "pass" "$change_name"
      # Check archived is NOT true
      local archived
      archived=$(cmd_get "$change_name" "archived")
      if [ "$archived" != "true" ]; then
        check_pass "archived=${archived} (expected: not true)"
      else
        check_fail "archived=${archived} (expected: not true)"
      fi
      ;;
    *)
      red "ERROR: Unknown phase for check: $phase"
      exit 1
      ;;
  esac

  echo ""
  if [ "$CHECK_BLOCK" -eq 1 ]; then
    red "BLOCKED — fix failing checks before proceeding"
    exit 1
  else
    green "ALL CHECKS PASSED — ready to proceed"
    exit 0
  fi
}

# --- Recovery context for compaction resume ---

field_status() {
  # Args: field_name value [file_path]
  # Prints: "field_name: DONE (value)" or "field_name: PENDING"
  local field="$1"
  local value="$2"
  local file_path="${3:-}"

  if [ -z "$value" ] || [ "$value" = "null" ]; then
    echo "  - ${field}: PENDING"
  elif [ -n "$file_path" ] && [ ! -f "$file_path" ]; then
    echo "  - ${field}: BROKEN (path ${value} does not exist)"
  else
    echo "  - ${field}: DONE (${value})"
  fi
}

cmd_recover() {
  local change_name="$1"

  validate_change_name "$change_name"

  local change_dir="openspec/changes/$change_name"
  local yaml_file="$change_dir/.opensuper.yaml"

  if [ ! -f "$yaml_file" ]; then
    red "ERROR: .opensuper.yaml not found at $yaml_file"
    exit 1
  fi

  local phase workflow
  phase=$(cmd_get "$change_name" "phase")
  workflow=$(cmd_get "$change_name" "workflow")

  echo "=== Recovery Context: ${change_name} ==="
  echo "Phase: ${phase}"
  echo "Workflow: ${workflow}"
  echo ""

  # Read all relevant fields
  local design_doc plan verify_result verify_mode verification_report opentest_gate opentest_strict_result
  local branch_status handoff_context handoff_hash isolation build_mode build_pause subagent_dispatch tdd_mode direct_override
  design_doc=$(cmd_get "$change_name" "design_doc")
  plan=$(cmd_get "$change_name" "plan")
  verify_result=$(cmd_get "$change_name" "verify_result")
  verify_mode=$(cmd_get "$change_name" "verify_mode")
  verification_report=$(cmd_get "$change_name" "verification_report")
  opentest_gate=$(cmd_get "$change_name" "opentest_gate" 2>/dev/null || true)
  opentest_strict_result=$(cmd_get "$change_name" "opentest_strict_result" 2>/dev/null || true)
  branch_status=$(cmd_get "$change_name" "branch_status")
  handoff_context=$(cmd_get "$change_name" "handoff_context")
  handoff_hash=$(cmd_get "$change_name" "handoff_hash")
  isolation=$(cmd_get "$change_name" "isolation")
  build_mode=$(cmd_get "$change_name" "build_mode")
  build_pause=$(cmd_get "$change_name" "build_pause" 2>/dev/null || true)
  subagent_dispatch=$(cmd_get "$change_name" "subagent_dispatch" 2>/dev/null || true)
  tdd_mode=$(cmd_get "$change_name" "tdd_mode" 2>/dev/null || true)
  direct_override=$(cmd_get "$change_name" "direct_override" 2>/dev/null || true)

  echo "State fields:"

  # Phase-specific field reporting
  case "$phase" in
    open)
      echo "  Artifacts:"
      local artifacts_done=0
      for f in proposal.md design.md tasks.md; do
        if file_nonempty "$change_dir/$f"; then
          echo "  - ${f}: DONE"
          artifacts_done=$((artifacts_done + 1))
        else
          echo "  - ${f}: PENDING"
        fi
      done
      echo ""
      if [ "$artifacts_done" -eq 3 ]; then
        echo "Recovery action: All artifacts complete. Run /opensuper-open user confirmation, then guard to transition."
      elif [ "$artifacts_done" -eq 0 ]; then
        echo "Recovery action: No artifacts created yet. Start from /opensuper-open Step 1 (explore and clarify)."
      else
        echo "Recovery action: Some artifacts incomplete. Resume /opensuper-open from the first missing artifact."
      fi
      ;;
    design)
      echo "  Artifacts:"
      for f in proposal.md design.md tasks.md; do
        if file_nonempty "$change_dir/$f"; then
          echo "  - ${f}: DONE"
        else
          echo "  - ${f}: MISSING (unexpected in design phase)"
        fi
      done
      echo ""
      echo "  Design progress:"
      field_status "handoff_context" "$handoff_context" "$handoff_context"
      field_status "handoff_hash" "$handoff_hash"
      field_status "design_doc" "$design_doc" "$design_doc"
      echo ""
      if [ -n "$design_doc" ] && [ "$design_doc" != "null" ] && [ -f "$design_doc" ]; then
        echo "Recovery action: Design Doc already created and linked. Run guard to transition to build."
      elif [ -n "$handoff_context" ] && [ "$handoff_context" != "null" ] && [ -f "$handoff_context" ]; then
        echo "Recovery action: Handoff generated but Design Doc not yet created. Resume from brainstorming confirmation (Step 1c)."
      else
        echo "Recovery action: No handoff generated yet. Start from Step 1a (generate handoff package)."
      fi
      ;;
    build)
      echo "  Build decisions:"
      field_status "isolation" "$isolation"
      field_status "build_mode" "$build_mode"
      field_status "build_pause" "$build_pause"
      field_status "tdd_mode" "$tdd_mode"
      if [ "$build_mode" = "subagent-driven-development" ] || { [ -n "$subagent_dispatch" ] && [ "$subagent_dispatch" != "null" ]; }; then
        field_status "subagent_dispatch" "$subagent_dispatch"
      fi
      if [ "$build_mode" = "direct" ] && [ "$workflow" != "hotfix" ] && [ "$workflow" != "tweak" ]; then
        field_status "direct_override" "$direct_override"
      fi
      echo ""
      echo "  Plan:"
      field_status "plan" "$plan" "$plan"
      echo ""
      # Count completed vs pending tasks
      local tasks_file="$change_dir/tasks.md"
      local total=0 done=0 pending=0
      local plan_total=0 plan_done=0 plan_pending=0
      if [ -f "$tasks_file" ]; then
        total=$(grep -c '^[[:space:]]*- \[' "$tasks_file" 2>/dev/null || true)
        done=$(grep -c '^[[:space:]]*- \[x\]' "$tasks_file" 2>/dev/null || true)
        total="${total:-0}"
        done="${done:-0}"
        pending=$((total - done))
        echo "  Tasks: ${done}/${total} done, ${pending} pending"
      else
        echo "  Tasks: tasks.md MISSING"
      fi
      if [ -n "$plan" ] && [ "$plan" != "null" ] && [ -f "$plan" ]; then
        plan_total=$(grep -c '^[[:space:]]*- \[' "$plan" 2>/dev/null || true)
        plan_done=$(grep -c '^[[:space:]]*- \[x\]' "$plan" 2>/dev/null || true)
        plan_total="${plan_total:-0}"
        plan_done="${plan_done:-0}"
        plan_pending=$((plan_total - plan_done))
        if [ "$plan_total" -gt 0 ]; then
          echo "  Plan tasks: ${plan_done}/${plan_total} done, ${plan_pending} pending"
        fi
      fi
      echo ""
      if [ "$build_pause" = "plan-ready" ] && [ -n "$plan" ] && [ "$plan" != "null" ] && [ -f "$plan" ] && { [ "$isolation" = "null" ] || [ -z "$isolation" ] || [ "$build_mode" = "null" ] || [ -z "$build_mode" ]; }; then
        echo "Recovery action: Plan-ready pause detected. Ask the user whether to continue, then choose isolation and build mode without regenerating the plan."
      elif [ "$build_pause" = "plan-ready" ] && { [ -z "$plan" ] || [ "$plan" = "null" ] || [ ! -f "$plan" ]; }; then
        echo "Recovery action: Plan-ready pause is recorded, but the plan file is missing. Restore the plan file or rerun writing-plans before choosing execution."
      elif [ "$build_pause" = "plan-ready" ]; then
        if [ "$build_mode" = "subagent-driven-development" ] && { [ "$pending" -gt 0 ] || [ "$plan_pending" -gt 0 ]; }; then
          if [ "$subagent_dispatch" = "confirmed" ]; then
            echo "Recovery action: Plan-ready pause is stale because build decisions are already selected. Clear build_pause to null, then inspect the first unchecked task (OpenSpec or plan additions) against recent git history/diff. If implemented, check it off; otherwise dispatch a real background subagent. Do not execute the pending task directly in the main window."
          else
            echo "Recovery action: Plan-ready pause is stale and subagent dispatch is not confirmed. Confirm a real background subagent/Task/multi-agent dispatcher and set subagent_dispatch to confirmed, or set build_mode to executing-plans before continuing."
          fi
        elif [ "$pending" -gt 0 ] || [ "$plan_pending" -gt 0 ]; then
          echo "Recovery action: Plan-ready pause is stale because build decisions are already selected. Clear build_pause to null, then continue from the first unchecked task."
        else
          echo "Recovery action: Plan-ready pause is stale and all tasks are done. Clear build_pause to null, then run guard to transition to verify."
        fi
      elif [ "$isolation" = "null" ] || [ -z "$isolation" ]; then
        echo "Recovery action: Isolation not selected. Use the current platform's user confirmation mechanism to ask user for branch/worktree choice."
      elif [ "$build_mode" = "null" ] || [ -z "$build_mode" ]; then
        echo "Recovery action: Build mode not selected. Use the current platform's user confirmation mechanism to ask user for execution method."
      elif [ -z "$tdd_mode" ] || [ "$tdd_mode" = "null" ]; then
        echo "Recovery action: TDD mode not selected. Use the current platform's user confirmation mechanism to ask user for tdd or direct."
      elif [ ! -f "$tasks_file" ]; then
        echo "Recovery action: tasks.md missing. Verify change directory integrity."
      elif [ "$pending" -gt 0 ]; then
        if [ "$build_mode" = "subagent-driven-development" ]; then
          if [ "$subagent_dispatch" = "confirmed" ]; then
            echo "Recovery action: Read tasks.md and the Superpowers plan (which may include additions beyond OpenSpec), then inspect the first unchecked task against recent git history/diff. If implemented, check it off; otherwise dispatch a real background subagent. Do not execute the pending task directly in the main window."
          else
            echo "Recovery action: Subagent dispatch is not confirmed. Confirm a real background subagent/Task/multi-agent dispatcher and set subagent_dispatch to confirmed, or set build_mode to executing-plans before continuing."
          fi
        else
          echo "Recovery action: Read tasks.md and continue from first unchecked task."
        fi
      elif [ "$plan_pending" -gt 0 ]; then
        if [ "$build_mode" = "subagent-driven-development" ]; then
          if [ "$subagent_dispatch" = "confirmed" ]; then
            echo "Recovery action: Read the Superpowers plan, then inspect the first unchecked Superpowers plan task against recent git history/diff. If implemented, check it off; otherwise dispatch a real background subagent. Do not execute the pending task directly in the main window."
          else
            echo "Recovery action: Subagent dispatch is not confirmed. Confirm a real background subagent/Task/multi-agent dispatcher and set subagent_dispatch to confirmed, or set build_mode to executing-plans before continuing."
          fi
        else
          echo "Recovery action: Read the Superpowers plan and continue from the first unchecked plan task."
        fi
      else
        echo "Recovery action: All tasks done. Run guard to transition to verify."
      fi
      ;;
    verify)
      echo "  Verification:"
      field_status "verify_result" "$verify_result"
      field_status "verify_mode" "$verify_mode"
      field_status "verification_report" "$verification_report" "$verification_report"
      field_status "branch_status" "$branch_status"
      field_status "opentest_gate" "$opentest_gate"
      field_status "opentest_strict_result" "$opentest_strict_result" "$opentest_strict_result"
      echo ""
      if [ "$verify_result" = "pass" ] && [ "$branch_status" = "handled" ]; then
        echo "Recovery action: Verification complete. Run guard to transition to archive."
      elif [ "$verify_result" = "pass" ]; then
        echo "Recovery action: Verification passed but branch not yet handled. Complete branch handling and set branch_status to handled."
      elif [ "$verify_result" = "fail" ]; then
        echo "Recovery action: Verification failed and rolled back to build. Resume from /opensuper-build."
      else
        echo "Recovery action: Verification not yet started or in progress. Run scale assessment then verify."
      fi
      ;;
    archive)
      echo "  Archive:"
      field_status "verify_result" "$verify_result"
      field_status "archived" "$(cmd_get "$change_name" "archived")"
      field_status "opentest_gate" "$opentest_gate"
      field_status "opentest_strict_result" "$opentest_strict_result" "$opentest_strict_result"
      echo ""
      echo "Recovery action: Run /opensuper-archive to complete archiving."
      ;;
    *)
      red "ERROR: Unknown phase: $phase"
      exit 1
      ;;
  esac

  echo ""
  echo "=== End Recovery Context ==="
}

cmd_scale() {
  local change_name="$1"

  validate_change_name "$change_name"

  local change_dir="openspec/changes/$change_name"
  local yaml_file="$change_dir/.opensuper.yaml"

  # Verify .opensuper.yaml exists
  if [ ! -f "$yaml_file" ]; then
    red "ERROR: .opensuper.yaml not found at $yaml_file"
    exit 1
  fi

  # Read metrics
  # 1. Task count: count lines matching `- [` in tasks.md
  local tasks_file="$change_dir/tasks.md"
  local task_count=0
  if [ -f "$tasks_file" ]; then
    task_count=$(grep -c '^\- \[' "$tasks_file" 2>/dev/null || echo "0")
  fi

  # 2. Delta spec count: count files named spec.md under specs/*/spec.md
  local delta_spec_count=0
  if [ -d "$change_dir/specs" ]; then
    delta_spec_count=$(find "$change_dir/specs" -name "spec.md" -type f 2>/dev/null | wc -l | tr -d ' ')
  fi

  # 3. Changed files: prefer plan base-ref, then .opensuper.yaml base_ref, fall back to worktree diff
  local changed_files=0
  if git rev-parse --git-dir > /dev/null 2>&1; then
    local plan_file base_ref=""
    plan_file=$(cmd_get "$change_name" "plan" 2>/dev/null || true)
    if [ -n "$plan_file" ] && [ "$plan_file" != "null" ] && [ -f "$plan_file" ]; then
      base_ref=$(grep '^base-ref:' "$plan_file" 2>/dev/null | head -1 | sed 's/^base-ref: *//' || true)
    fi
    # Fallback to base_ref stored in .opensuper.yaml (set during init)
    if [ -z "$base_ref" ] || [ "$base_ref" = "null" ]; then
      base_ref=$(cmd_get "$change_name" "base_ref" 2>/dev/null || true)
    fi

    if [ -n "${base_ref:-}" ] && [ "$base_ref" != "null" ] && git rev-parse --verify "$base_ref" >/dev/null 2>&1; then
      changed_files=$(git diff --name-only "$base_ref"...HEAD 2>/dev/null | wc -l | tr -d ' ')
    else
      changed_files=$(git diff --name-only HEAD 2>/dev/null | wc -l | tr -d ' ')
    fi
  fi

  # Decision rules
  local result="light"
  if [ "$task_count" -gt 3 ] || [ "$delta_spec_count" -gt 1 ] || [ "$changed_files" -gt 4 ]; then
    result="full"
  fi

  # Output assessment to stderr
  echo "=== Scale Assessment: $change_name ===" >&2
  echo "  Tasks: $task_count (threshold: 3)" >&2
  echo "  Delta specs: $delta_spec_count capabilities (threshold: 1)" >&2
  echo "  Changed files: $changed_files (threshold: 4)" >&2
  echo "  → Result: $result" >&2

  # Update verify_mode in .opensuper.yaml
  replace_yaml_field "$yaml_file" "verify_mode" "$result"

  green "[SCALE] verify_mode=$result"
}

cmd_task_checkoff() {
  local task_file="$1"
  local task_text="$2"

  validate_path_field "$task_file" "task file"

  if [ -z "$task_text" ]; then
    red "ERROR: Task text cannot be empty" >&2
    exit 1
  fi

  if [ ! -f "$task_file" ]; then
    red "ERROR: Task file not found: $task_file" >&2
    exit 1
  fi

  local counts
  counts=$(TASK_TEXT="$task_text" awk '
    BEGIN {
      task = ENVIRON["TASK_TEXT"]
    }
    {
      sub(/\r$/, "")
      if ($0 == "- [ ] " task || $0 == "- [x] " task || $0 == "- [X] " task) {
        total++
      }
      if ($0 == "- [x] " task || $0 == "- [X] " task) {
        checked++
      }
    }
    END {
      printf "%d %d\n", total + 0, checked + 0
    }
  ' "$task_file")

  local total="${counts%% *}"
  local checked="${counts##* }"

  if [ "$total" -ne 1 ]; then
    red "ERROR: task text must appear exactly once in $task_file (found $total): $task_text" >&2
    exit 1
  fi

  if [ "$checked" -ne 1 ]; then
    red "ERROR: task is not checked in $task_file: $task_text" >&2
    exit 1
  fi

  echo "TASK_CHECKOFF: PASS"
  echo "FILE: $task_file"
  echo "TASK: $task_text"
}

# Resolve the next workflow step after a guard --apply phase advance.
# Reads the (already advanced) phase, workflow, and auto_transition, then emits
# a deterministic next-step contract so skills don't hardcode the next skill name.
#
# Output contract (stdout):
#   NEXT: auto|manual|done
#   SKILL: <skill-name>      (omitted when NEXT=done)
#   HINT: <message>          (only when NEXT=manual)
cmd_next() {
  local change_name="$1"
  validate_change_name "$change_name"

  local change_dir="openspec/changes/$change_name"
  local yaml_file="$change_dir/.opensuper.yaml"
  if [ ! -f "$yaml_file" ]; then
    red "ERROR: .opensuper.yaml not found at $yaml_file" >&2
    exit 1
  fi

  local phase workflow auto_transition archived
  phase=$(cmd_get "$change_name" "phase" 2>/dev/null || true)
  workflow=$(cmd_get "$change_name" "workflow" 2>/dev/null || true)
  auto_transition=$(cmd_get "$change_name" "auto_transition" 2>/dev/null || true)
  archived=$(cmd_get "$change_name" "archived" 2>/dev/null || true)

  # Change-level auto_transition overrides project-level; fall back to project default
  if [ -z "$auto_transition" ] || [ "$auto_transition" = "null" ]; then
    auto_transition="$(project_auto_transition_default)"
  fi

  # Terminal state: archived change has no next step.
  if [ "$archived" = "true" ]; then
    echo "NEXT: done"
    return 0
  fi

  # Map the current (post-advance) phase to the skill that owns it.
  local skill=""
  case "$phase" in
    open)
      skill="opensuper-open"
      ;;
    design)
      skill="opensuper-design"
      ;;
    build)
      case "$workflow" in
        hotfix) skill="opensuper-hotfix" ;;
        tweak)  skill="opensuper-tweak" ;;
        *)      skill="opensuper-build" ;;
      esac
      ;;
    verify)
      skill="opensuper-verify"
      ;;
    archive)
      skill="opensuper-archive"
      ;;
    *)
      red "ERROR: Cannot resolve next step for '$change_name': unknown phase '${phase:-null}'" >&2
      exit 1
      ;;
  esac

  # auto_transition=false pauses the next skill invocation only; phase is already advanced.
  if [ "$auto_transition" = "false" ]; then
    echo "NEXT: manual"
    echo "SKILL: $skill"
    echo "HINT: phase is '$phase'; run /$skill manually to continue"
  else
    echo "NEXT: auto"
    echo "SKILL: $skill"
  fi
}

# --- Main ---

SUBCOMMAND="${1:-}"
shift || true

case "$SUBCOMMAND" in
  init)
    if [ $# -lt 2 ]; then
      red "Usage: opensuper-state.sh init <change-name> <workflow>" >&2
      red "Workflows: full, hotfix, tweak" >&2
      exit 1
    fi
    cmd_init "$@"
    ;;
  get)
    if [ $# -lt 2 ]; then
      red "Usage: opensuper-state.sh get <change-name> <field>" >&2
      exit 1
    fi
    cmd_get "$@"
    ;;
  set)
    if [ $# -lt 3 ]; then
      red "Usage: opensuper-state.sh set <change-name> <field> <value>" >&2
      exit 1
    fi
    cmd_set "$@"
    ;;
  transition)
    if [ $# -lt 2 ]; then
      red "Usage: opensuper-state.sh transition <change-name> <event>" >&2
      red "Events: open-complete, design-complete, build-complete, verify-pass, verify-fail, archive-reopen, archive-confirm, archived" >&2
      exit 1
    fi
    cmd_transition "$@"
    ;;
  check)
    if [ $# -lt 2 ]; then
      red "Usage: opensuper-state.sh check <change-name> <phase> [--recover]" >&2
      red "Phases: open, design, build, verify, archive" >&2
      exit 1
    fi
    # Detect --recover flag (3rd argument)
    if [ "${3:-}" = "--recover" ]; then
      cmd_recover "$1"
    else
      cmd_check "$@"
    fi
    ;;
  scale)
    if [ $# -lt 1 ]; then
      red "Usage: opensuper-state.sh scale <change-name>" >&2
      exit 1
    fi
    cmd_scale "$@"
    ;;
  task-checkoff)
    if [ $# -lt 2 ]; then
      red "Usage: opensuper-state.sh task-checkoff <file> <task-text>" >&2
      exit 1
    fi
    cmd_task_checkoff "$@"
    ;;
  next)
    if [ $# -lt 1 ]; then
      red "Usage: opensuper-state.sh next <change-name>" >&2
      exit 1
    fi
    cmd_next "$@"
    ;;
  *)
    red "Unknown subcommand: $SUBCOMMAND" >&2
    echo "" >&2
    echo "Usage: opensuper-state.sh <subcommand> <change-name> [args...]" >&2
    echo "" >&2
    echo "Subcommands:" >&2
    echo "  init <change-name> <workflow>  — Initialize .opensuper.yaml with workflow defaults" >&2
    echo "  get <change-name> <field>       — Read a field value from .opensuper.yaml" >&2
    echo "  set <change-name> <field> <val> — Update a field value in .opensuper.yaml" >&2
    echo "  transition <change-name> <event> — Apply a validated state transition" >&2
    echo "  check <change-name> <phase>    — Verify entry requirements for a phase" >&2
    echo "  scale <change-name>             — Assess and set verification mode based on metrics" >&2
    echo "  task-checkoff <file> <task-text> — Verify one unique task is checked" >&2
    echo "  next <change-name>              — Resolve the next workflow step (auto/manual/done)" >&2
    echo "" >&2
    echo "Workflows: full, hotfix, tweak" >&2
    echo "Phases for check: open, design, build, verify, archive" >&2
    exit 1
    ;;
esac
