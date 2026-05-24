#!/bin/bash
# OpenSuper State — unified interface for .opensuper.yaml state management
# Usage: opensuper-state.sh <subcommand> <change-name> [args...]
#
# Subcommands:
#   init <change-name> <workflow>  — Initialize .opensuper.yaml with workflow defaults
#   get <change-name> <field>       — Read a field value from .opensuper.yaml
#   set <change-name> <field> <val> — Update a field value
#   transition <change-name> <event> — Apply a validated state transition
#   check <change-name> <phase>    — Verify entry requirements for a phase
#   scale <change-name>             — Assess and set verification mode based on metrics
#
# Workflows: full, hotfix, tweak
# Phases for check: open, design, build, verify, archive

set -euo pipefail

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

# --- Helper functions ---

yaml_field() {
  local field="$1"
  local yaml_file="$2"
  if [ -f "$yaml_file" ]; then
    local value
    value=$(grep "^${field}:" "$yaml_file" 2>/dev/null | sed "s/^${field}: *//" || true)
    strip_wrapping_quotes "$value"
  fi
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
  awk -v field="$field" -v value="$value" '
    index($0, field ":") == 1 { print field ": " value; next }
    { print }
  ' "$yaml_file" > "$tmp_file"
  mv "$tmp_file" "$yaml_file"
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
  local phase build_mode isolation verify_mode
  phase="open"

  case "$workflow" in
    full)
      build_mode="null"
      isolation="null"
      verify_mode="null"
      ;;
    hotfix|tweak)
      build_mode="direct"
      isolation="branch"
      verify_mode="light"
      ;;
  esac

  # Write .opensuper.yaml
  cat > "$yaml_file" <<EOF
workflow: $workflow
phase: $phase
build_mode: $build_mode
isolation: $isolation
verify_mode: $verify_mode
design_doc: null
plan: null
verify_result: pending
verification_report: null
branch_status: pending
verified_at: null
archived: false
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
    workflow|phase|build_mode|isolation|verify_mode|verify_result|verification_report|branch_status|archived|design_doc|plan|verified_at|direct_override|build_command|verify_command)
      # Valid field
      ;;
    *)
      red "ERROR: Unknown field: '$field'" >&2
      red "Valid fields: workflow, phase, design_doc, plan, build_mode, isolation, verify_mode, verify_result, verification_report, branch_status, verified_at, archived, direct_override, build_command, verify_command" >&2
      exit 1
      ;;
  esac

  # Validate enum values
  case "$field" in
    workflow)
      validate_enum "$value" "full" "hotfix" "tweak"
      ;;
    phase)
      validate_enum "$value" "open" "design" "build" "verify" "archive"
      ;;
    build_mode)
      validate_enum "$value" "subagent-driven-development" "executing-plans" "direct"
      ;;
    isolation)
      validate_enum "$value" "branch" "worktree"
      ;;
    verify_mode)
      validate_enum "$value" "light" "full"
      ;;
    verify_result)
      validate_enum "$value" "pending" "pass" "fail"
      ;;
    branch_status)
      validate_enum "$value" "pending" "handled"
      ;;
    archived)
      validate_enum "$value" "true" "false"
      ;;
    direct_override)
      validate_enum "$value" "true" "false"
      ;;
    design_doc|plan|verification_report|verified_at|build_command|verify_command)
      # No validation for path fields, date fields, or project command strings
      ;;
  esac

  # Write or update the field
  if grep -q "^${field}:" "$yaml_file"; then
    replace_yaml_field "$yaml_file" "$field" "$value"
  else
    # Field doesn't exist, append it
    echo "${field}: ${value}" >> "$yaml_file"
  fi

  green "[SET] ${field}=${value}"
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

require_build_decisions() {
  local change_name="$1"
  local workflow build_mode isolation direct_override
  workflow=$(cmd_get "$change_name" "workflow")
  build_mode=$(cmd_get "$change_name" "build_mode")
  isolation=$(cmd_get "$change_name" "isolation")
  direct_override=$(cmd_get "$change_name" "direct_override" 2>/dev/null || true)

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
}

cmd_transition() {
  local change_name="$1"
  local event="$2"

  validate_change_name "$change_name"
  validate_enum "$event" "open-complete" "design-complete" "build-complete" "verify-pass" "verify-fail" "archived"

  case "$event" in
    open-complete)
      require_phase "$change_name" "open"
      local workflow
      workflow=$(cmd_get "$change_name" "workflow")
      if [ "$workflow" = "full" ]; then
        cmd_set "$change_name" phase design
      else
        cmd_set "$change_name" phase build
      fi
      ;;
    design-complete)
      require_phase "$change_name" "design"
      cmd_set "$change_name" phase build
      ;;
    build-complete)
      require_phase "$change_name" "build"
      require_build_decisions "$change_name"
      cmd_set "$change_name" phase verify
      cmd_set "$change_name" verify_result pending
      cmd_set "$change_name" verification_report null
      cmd_set "$change_name" branch_status pending
      ;;
    verify-pass)
      require_phase "$change_name" "verify"
      require_verification_evidence "$change_name"
      cmd_set "$change_name" verify_result pass
      cmd_set "$change_name" phase archive
      cmd_set "$change_name" verified_at "$(date +%Y-%m-%d)"
      ;;
    verify-fail)
      require_phase "$change_name" "verify"
      cmd_set "$change_name" verify_result fail
      cmd_set "$change_name" phase build
      cmd_set "$change_name" branch_status pending
      ;;
    archived)
      require_phase "$change_name" "archive"
      cmd_set "$change_name" archived true
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

  # 3. Changed files: prefer plan base-ref, fall back to worktree diff
  local changed_files=0
  if git rev-parse --git-dir > /dev/null 2>&1; then
    local plan_file base_ref
    plan_file=$(cmd_get "$change_name" "plan" 2>/dev/null || true)
    if [ -n "$plan_file" ] && [ "$plan_file" != "null" ] && [ -f "$plan_file" ]; then
      base_ref=$(grep '^base-ref:' "$plan_file" 2>/dev/null | head -1 | sed 's/^base-ref: *//')
    fi

    if [ -n "${base_ref:-}" ] && git rev-parse --verify "$base_ref" >/dev/null 2>&1; then
      changed_files=$(git diff --name-only "$base_ref"...HEAD 2>/dev/null | wc -l | tr -d ' ')
    else
      changed_files=$(git diff --name-only HEAD 2>/dev/null | wc -l | tr -d ' ')
    fi
  fi

  # Decision rules
  local result="light"
  if [ "$task_count" -gt 3 ] || [ "$delta_spec_count" -gt 1 ] || [ "$changed_files" -gt 5 ]; then
    result="full"
  fi

  # Output assessment to stderr
  echo "=== Scale Assessment: $change_name ===" >&2
  echo "  Tasks: $task_count (threshold: 3)" >&2
  echo "  Delta specs: $delta_spec_count capabilities (threshold: 1)" >&2
  echo "  Changed files: $changed_files (threshold: 5)" >&2
  echo "  → Result: $result" >&2

  # Update verify_mode in .opensuper.yaml
  replace_yaml_field "$yaml_file" "verify_mode" "$result"

  green "[SCALE] verify_mode=$result"
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
      red "Events: open-complete, design-complete, build-complete, verify-pass, verify-fail, archived" >&2
      exit 1
    fi
    cmd_transition "$@"
    ;;
  check)
    if [ $# -lt 2 ]; then
      red "Usage: opensuper-state.sh check <change-name> <phase>" >&2
      red "Phases: open, design, build, verify, archive" >&2
      exit 1
    fi
    cmd_check "$@"
    ;;
  scale)
    if [ $# -lt 1 ]; then
      red "Usage: opensuper-state.sh scale <change-name>" >&2
      exit 1
    fi
    cmd_scale "$@"
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
    echo "" >&2
    echo "Workflows: full, hotfix, tweak" >&2
    echo "Phases for check: open, design, build, verify, archive" >&2
    exit 1
    ;;
esac
