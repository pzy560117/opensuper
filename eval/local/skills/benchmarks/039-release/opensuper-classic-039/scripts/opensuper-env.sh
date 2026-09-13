#!/bin/bash
# OpenSuper script locator — source this file to export paths to bundled scripts.
#
# Usage:
#   . /path/to/opensuper/scripts/opensuper-env.sh
#
# This file is sourced by workflow snippets. Do not set global shell options here.

_opensuper_env_source="${BASH_SOURCE[0]:-$0}"
_opensuper_script_dir="$(cd "$(dirname "$_opensuper_env_source")" && pwd -P)"
_opensuper_env_sourced=0
(return 0 2>/dev/null) && _opensuper_env_sourced=1

export OPENSUPER_GUARD="${OPENSUPER_GUARD:-${_opensuper_script_dir}/opensuper-guard.sh}"
export OPENSUPER_STATE="${OPENSUPER_STATE:-${_opensuper_script_dir}/opensuper-state.sh}"
export OPENSUPER_HANDOFF="${OPENSUPER_HANDOFF:-${_opensuper_script_dir}/opensuper-handoff.sh}"
export OPENSUPER_ARCHIVE="${OPENSUPER_ARCHIVE:-${_opensuper_script_dir}/opensuper-archive.sh}"
export OPENSUPER_YAML_VALIDATE="${OPENSUPER_YAML_VALIDATE:-${_opensuper_script_dir}/opensuper-yaml-validate.sh}"

_opensuper_bash_is_usable() {
  local _opensuper_bash_candidate="$1"
  if [ -z "$_opensuper_bash_candidate" ]; then
    return 1
  fi
  case "$_opensuper_bash_candidate" in
    */Windows/System32/bash.exe|*/windows/system32/bash.exe|*\\Windows\\System32\\bash.exe|*\\windows\\system32\\bash.exe)
      return 1
      ;;
  esac
  "$_opensuper_bash_candidate" -lc 'printf opensuper-bash-ok' >/dev/null 2>&1
}

_opensuper_resolve_bash() {
  local _opensuper_bash_candidate

  if _opensuper_bash_is_usable "${OPENSUPER_BASH:-}"; then
    printf '%s\n' "$OPENSUPER_BASH"
    return 0
  fi

  if _opensuper_bash_is_usable "${BASH:-}"; then
    printf '%s\n' "$BASH"
    return 0
  fi

  _opensuper_bash_candidate="$(command -v sh 2>/dev/null | awk '{ sub(/\/sh(\.exe)?$/, "/bash.exe"); print }')"
  if _opensuper_bash_is_usable "$_opensuper_bash_candidate"; then
    printf '%s\n' "$_opensuper_bash_candidate"
    return 0
  fi

  _opensuper_bash_candidate="$(command -v bash 2>/dev/null || true)"
  if _opensuper_bash_is_usable "$_opensuper_bash_candidate"; then
    printf '%s\n' "$_opensuper_bash_candidate"
    return 0
  fi

  return 1
}

OPENSUPER_BASH="$(_opensuper_resolve_bash || true)"
export OPENSUPER_BASH

_opensuper_env_fail() {
  echo "ERROR: OpenSuper scripts not found. Ensure the opensuper skill is installed completely." >&2
  echo "Expected path pattern: */opensuper/scripts/opensuper-*.sh under project or platform skill directories" >&2
}

_opensuper_bash_fail() {
  echo "ERROR: usable bash not found. Install Git Bash or set OPENSUPER_BASH to a working bash executable." >&2
  echo "Windows WSL launcher bash.exe is not supported for OpenSuper scripts." >&2
}

_opensuper_env_abort() {
  local _opensuper_env_was_sourced="$_opensuper_env_sourced"
  unset _opensuper_env_source _opensuper_script_dir _opensuper_script _opensuper_env_missing _opensuper_env_sourced
  unset _opensuper_bash_candidate
  unset -f _opensuper_env_fail _opensuper_bash_fail _opensuper_bash_is_usable _opensuper_resolve_bash
  if [ "$_opensuper_env_was_sourced" -eq 1 ]; then
    unset -f _opensuper_env_abort
    return 1
  fi
  exit 1
}

_opensuper_env_missing=0
if [ -z "$OPENSUPER_BASH" ]; then
  _opensuper_bash_fail
  _opensuper_env_missing=1
fi
for _opensuper_script in \
  "$OPENSUPER_GUARD" \
  "$OPENSUPER_STATE" \
  "$OPENSUPER_HANDOFF" \
  "$OPENSUPER_ARCHIVE" \
  "$OPENSUPER_YAML_VALIDATE"; do
  if [ ! -f "$_opensuper_script" ]; then
    _opensuper_env_fail
    _opensuper_env_missing=1
    break
  fi
done

if [ "$_opensuper_env_missing" -ne 0 ]; then
  _opensuper_env_abort
else
  unset _opensuper_env_source _opensuper_script_dir _opensuper_script _opensuper_env_missing _opensuper_env_sourced
  unset _opensuper_bash_candidate
  unset -f _opensuper_env_fail _opensuper_bash_fail _opensuper_bash_is_usable _opensuper_resolve_bash _opensuper_env_abort
fi
