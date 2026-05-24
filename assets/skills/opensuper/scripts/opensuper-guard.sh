#!/bin/bash
# OpenSuper Phase Guard — validates exit conditions before phase transitions
# Usage: opensuper-guard.sh <change-name> <current-phase> [--apply]
# Phases: open, design, build, verify, archive
# Exit 0 = all checks pass, exit 1 = blocked (reasons printed to stderr)
# shellcheck disable=SC2329  # Functions called indirectly via check() dispatch

set -euo pipefail

red() { echo -e "\033[31m$1\033[0m" >&2; }
green() { echo -e "\033[32m$1\033[0m" >&2; }
warn() { echo -e "\033[33m$1\033[0m" >&2; }

# Input validation - prevent path traversal
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

validate_change_name "$1"

CHANGE="$1"
PHASE="$2"
APPLY=0
SCRIPT_DIR="$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")" 2>/dev/null || dirname "$0")"
if [[ "${3:-}" == "--apply" ]]; then
  APPLY=1
fi
CHANGE_DIR="openspec/changes/$CHANGE"
if [ "$PHASE" = "archive" ] && [ ! -d "$CHANGE_DIR" ] && [ -d "openspec/changes/archive/$CHANGE" ]; then
  CHANGE_DIR="openspec/changes/archive/$CHANGE"
fi

BLOCK=0
check() {
  local desc="$1"
  shift
  local output
  if output=$("$@" 2>&1); then
    green "  [PASS] $desc"
  else
    red "  [FAIL] $desc"
    if [ -n "$output" ]; then
      while IFS= read -r line; do
        red "    $line"
      done <<< "$output"
    fi
    BLOCK=1
  fi
}

# --- Helper functions ---

tasks_all_done() {
  local tasks="$CHANGE_DIR/tasks.md"
  if [ ! -f "$tasks" ]; then
    echo "tasks.md is missing at $tasks" >&2
    echo "Next: restore or create tasks.md for this change before leaving build." >&2
    return 1
  fi
  if ! grep -q '\- \[x\]' "$tasks"; then
    echo "tasks.md has no completed tasks." >&2
    echo "Next: complete implementation tasks and mark them with '- [x]'." >&2
    return 1
  fi
  if grep -q '\- \[ \]' "$tasks"; then
    echo "Unfinished tasks:" >&2
    grep -n '\- \[ \]' "$tasks" >&2 || true
    echo "Next: complete or explicitly remove unfinished tasks, then mark tasks.md with '- [x]'." >&2
    return 1
  fi
  return 0
}

tasks_has_any() {
  local tasks="$CHANGE_DIR/tasks.md"
  [ -f "$tasks" ] && grep -q '\- \[' "$tasks"
}

yaml_field_value() {
  local field="$1"
  local yaml="$CHANGE_DIR/.opensuper.yaml"
  if [ -f "$yaml" ]; then
    local value
    value=$(grep "^${field}:" "$yaml" 2>/dev/null | sed "s/^${field}: *//" || true)
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

project_config_value() {
  local field="$1"
  local value

  value=$(yaml_field_value "$field" 2>/dev/null || true)
  if [ -n "$value" ] && [ "$value" != "null" ]; then
    echo "$value"
    return 0
  fi

  for config in ".opensuper.yaml" "opensuper.yaml" ".opensuper.yml" "opensuper.yml"; do
    if [ -f "$config" ]; then
      value=$(grep "^${field}:" "$config" 2>/dev/null | sed "s/^${field}: *//" || true)
      value=$(strip_wrapping_quotes "$value")
      if [ -n "$value" ] && [ "$value" != "null" ]; then
        echo "$value"
        return 0
      fi
    fi
  done
}

file_nonempty() {
  [ -f "$1" ] && [ -s "$1" ]
}

is_windows_bash() {
  case "$(uname -s 2>/dev/null || true)" in
    MINGW*|MSYS*|CYGWIN*) return 0 ;;
    *) return 1 ;;
  esac
}

run_command_string() {
  local command="$1"
  echo "+ $command" >&2
  bash -lc "$command"
}

preflight() {

  if [ ! -d "$CHANGE_DIR" ]; then
    red "FATAL: change directory not found: $CHANGE_DIR"
    exit 1
  fi
  if [ ! -f "$CHANGE_DIR/.opensuper.yaml" ]; then
    red "FATAL: .opensuper.yaml not found in $CHANGE_DIR"
    exit 1
  fi

  # Schema validation
  local validate_script
  validate_script="$SCRIPT_DIR/opensuper-yaml-validate.sh"
  if [ -f "$validate_script" ]; then
    if ! bash "$validate_script" "$CHANGE" 2>/dev/null; then
      bash "$validate_script" "$CHANGE"
      red "FATAL: .opensuper.yaml schema validation failed"
      exit 1
    fi
  fi
}

build_passes() {
  if [ "${OPENSUPER_SKIP_BUILD:-0}" = "1" ]; then
    return 0
  fi
  local configured_build
  configured_build=$(project_config_value "build_command" 2>/dev/null || true)
  if [ -n "$configured_build" ]; then
    run_command_string "$configured_build"
    return $?
  fi
  if [ -f "package.json" ] && grep -q '"build"' "package.json"; then
    npm run build
    return $?
  fi
  if [ -f "pom.xml" ]; then
    if [ -x "./mvnw" ]; then
      ./mvnw compile -q
    elif is_windows_bash && command -v mvn.cmd >/dev/null 2>&1; then
      mvn.cmd compile -q
    else
      mvn compile -q
    fi
    return $?
  fi
  if [ -f "Cargo.toml" ]; then
    cargo build
    return $?
  fi
  return 1
}

verification_command_passes() {
  if [ "${OPENSUPER_SKIP_BUILD:-0}" = "1" ]; then
    return 0
  fi
  local configured_verify
  configured_verify=$(project_config_value "verify_command" 2>/dev/null || true)
  if [ -n "$configured_verify" ]; then
    run_command_string "$configured_verify"
    return $?
  fi
  build_passes
}

isolation_selected() {
  local isolation
  isolation=$(yaml_field_value "isolation" 2>/dev/null || true)
  case "$isolation" in
    branch|worktree) return 0 ;;
    *)
      echo "isolation must be branch or worktree, got '${isolation:-null}'" >&2
      echo "Next: ask the user to choose branch or worktree, create the chosen isolation, then run:" >&2
      echo "  bash \"\$OPENSUPER_STATE\" set $CHANGE isolation <branch|worktree>" >&2
      return 1
      ;;
  esac
}

build_mode_selected() {
  local build_mode
  build_mode=$(yaml_field_value "build_mode" 2>/dev/null || true)
  case "$build_mode" in
    subagent-driven-development|executing-plans|direct) return 0 ;;
    *)
      echo "build_mode must be selected before leaving build, got '${build_mode:-null}'" >&2
      echo "Next: ask the user to choose an implementation mode, then run:" >&2
      echo "  bash \"\$OPENSUPER_STATE\" set $CHANGE build_mode <subagent-driven-development|executing-plans>" >&2
      return 1
      ;;
  esac
}

build_mode_allowed_for_workflow() {
  local workflow build_mode direct_override
  workflow=$(yaml_field_value "workflow" 2>/dev/null || true)
  build_mode=$(yaml_field_value "build_mode" 2>/dev/null || true)
  direct_override=$(yaml_field_value "direct_override" 2>/dev/null || true)

  if [ "$build_mode" != "direct" ]; then
    return 0
  fi
  case "$workflow" in
    hotfix|tweak) return 0 ;;
    *)
      if [ "$direct_override" = "true" ]; then
        return 0
      fi
      echo "build_mode=direct is only allowed for hotfix/tweak unless direct_override: true is recorded" >&2
      echo "Next: switch build_mode to executing-plans or subagent-driven-development, or stop and ask the user for an explicit direct override." >&2
      return 1
      ;;
  esac
}

verify_result_is_pass() {
  local result
  result=$(yaml_field_value "verify_result" 2>/dev/null || true)
  [ "$result" = "pass" ]
}

verification_report_exists() {
  local report
  report=$(yaml_field_value "verification_report" 2>/dev/null || true)
  [ -n "$report" ] && [ "$report" != "null" ] && [ -f "$report" ]
}

branch_status_handled() {
  local status
  status=$(yaml_field_value "branch_status" 2>/dev/null || true)
  [ "$status" = "handled" ]
}

archived_is_true() {
  local val
  val=$(yaml_field_value "archived" 2>/dev/null || true)
  [ "$val" = "true" ]
}

# --- Phase-specific checks ---

guard_open() {
  echo "=== Guard: open → next ===" >&2

  check "proposal.md exists and non-empty" file_nonempty "$CHANGE_DIR/proposal.md"
  check "design.md exists and non-empty" file_nonempty "$CHANGE_DIR/design.md"
  check "tasks.md exists and non-empty" file_nonempty "$CHANGE_DIR/tasks.md"
  check "tasks.md has at least one task" tasks_has_any
}

guard_design() {
  echo "=== Guard: design → build ===" >&2

  local design_doc
  design_doc=$(yaml_field_value "design_doc" 2>/dev/null || true)

  check "proposal.md exists" file_nonempty "$CHANGE_DIR/proposal.md"
  check "tasks.md exists" file_nonempty "$CHANGE_DIR/tasks.md"

  if [ -n "$design_doc" ] && [ "$design_doc" != "null" ]; then
    check "Design Doc ($design_doc) exists" file_nonempty "$design_doc"
  else
    warn "  [WARN] No design_doc recorded in .opensuper.yaml"
  fi
}

guard_build() {
  echo "=== Guard: build → verify ===" >&2

  check "isolation selected" isolation_selected
  check "build_mode selected" build_mode_selected
  check "build_mode allowed for workflow" build_mode_allowed_for_workflow
  check "tasks.md all tasks checked" tasks_all_done
  check "proposal.md exists" file_nonempty "$CHANGE_DIR/proposal.md"
  check "Build passes" build_passes
}

guard_verify() {
  echo "=== Guard: verify → archive ===" >&2

  check "tasks.md all tasks checked" tasks_all_done
  check "Build passes" verification_command_passes
  check "verification_report exists" verification_report_exists
  check "branch_status=handled" branch_status_handled
}

guard_archive() {
  echo "=== Guard: archive completeness ===" >&2

  check "archived is true" archived_is_true
  check "proposal.md exists" file_nonempty "$CHANGE_DIR/proposal.md"
  check "tasks.md all tasks checked" tasks_all_done
}

apply_state_update() {
  local state_sh="$SCRIPT_DIR/opensuper-state.sh"
  local p="$1"

  if [ -f "$state_sh" ]; then
    case "$p" in
      open)   bash "$state_sh" transition "$CHANGE" open-complete ;;
      design) bash "$state_sh" transition "$CHANGE" design-complete ;;
      build)  bash "$state_sh" transition "$CHANGE" build-complete ;;
      verify) bash "$state_sh" transition "$CHANGE" verify-pass ;;
    esac
  else
    red "FATAL: opensuper-state.sh not found; cannot apply state transition"
    exit 1
  fi
}

# --- Main ---

case "$PHASE" in
  open)     preflight ; guard_open ;;
  design)   preflight ; guard_design ;;
  build)    preflight ; guard_build ;;
  verify)   preflight ; guard_verify ;;
  archive)  preflight ; guard_archive ;;
  *)
    red "Unknown phase: $PHASE"
    echo "Valid phases: open, design, build, verify, archive" >&2
    exit 1
    ;;
esac

if [ "$BLOCK" -eq 1 ]; then
  echo "" >&2
  red "BLOCKED — fix failing checks before proceeding to next phase"
  exit 1
else
  echo "" >&2
  green "ALL CHECKS PASSED — ready for next phase"
  if [ "$APPLY" -eq 1 ]; then
    apply_state_update "$PHASE"
    case "$PHASE" in
      open)
        new_phase=$(grep "^phase:" "$CHANGE_DIR/.opensuper.yaml" | sed 's/^phase: *//' | tr -d '"' | tr -d "'")
        green "  [APPLY] .opensuper.yaml updated: phase=$new_phase"
        ;;
      design) green "  [APPLY] .opensuper.yaml updated: phase=build" ;;
      build)  green "  [APPLY] .opensuper.yaml updated: phase=verify, verify_result=pending" ;;
      verify) green "  [APPLY] .opensuper.yaml updated: phase=archive, verify_result=pass" ;;
    esac
  fi
  exit 0
fi
