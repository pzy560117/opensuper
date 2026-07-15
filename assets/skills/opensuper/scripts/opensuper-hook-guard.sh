#!/bin/bash
# opensuper-hook-guard.sh — PreToolUse hook for opensuper phase enforcement
#
# Blocks file writes (Write/Edit) when the active opensuper change is in
# a phase that does not allow source code modifications (open/design/archive).
#
# Usage (called by harness, not directly):
#   PreToolUse matcher "Write|Edit" → this script
#   Stdin:  JSON  {"tool_name":"Write|Edit","tool_input":{"file_path":"..."}}
#   Exit 0  = allow
#   Exit 2  = blocked (stderr message shown to user)
#
# Cross-platform: macOS / Linux / Windows Git Bash
# shellcheck disable=SC2329

set -euo pipefail

# ── Extract target file path ──────────────────────────────────────

TARGET=""

# Method 1: FILE_PATH environment variable (set by some harnesses)
if [ -n "${FILE_PATH:-}" ]; then
  TARGET="$FILE_PATH"
fi

# Method 2: Parse stdin JSON
if [ -z "$TARGET" ]; then
  INPUT=""
  if [ ! -t 0 ]; then
    INPUT=$(cat 2>/dev/null || true)
  fi
  if [ -n "$INPUT" ]; then
    # Extract file_path value — works for both Write and Edit tool inputs
    TARGET=$(printf '%s' "$INPUT" \
      | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' 2>/dev/null \
      | head -1 \
      | sed 's/^"file_path"[[:space:]]*:[[:space:]]*"//' \
      | sed 's/"$//' \
      || true)
  fi
fi

# No target found — allow (not a file-path-bearing operation)
if [ -z "$TARGET" ]; then
  echo "[opensuper-HOOK] allowed: no file path in tool input" >&2
  exit 0
fi

# Normalize to forward slashes, collapse doubles from JSON escaping (\\ → //)
TARGET=$(printf '%s' "$TARGET" | sed 's|\\|/|g' | sed 's|///*|/|g')

# ── Resolve to project-relative path ─────────────────────────────

# Normalize helper: forward slashes only
norm() { printf '%s' "$1" | sed 's|\\|/|g'; }

RELPATH=$(norm "$TARGET")
CWD_UNIX=$(norm "$(pwd)")
CWD_PHYS=$(norm "$(pwd -P 2>/dev/null || pwd)")
CWD_WIN=$(norm "$(pwd -W 2>/dev/null || true)")

# If already relative, use as-is
case "$RELPATH" in
  /*|[A-Za-z]:/*)
    # Absolute — try stripping CWD prefixes
    # Try: TARGET as-is vs CWD logical
    if [ "${RELPATH#"$CWD_UNIX"/}" != "$RELPATH" ]; then
      RELPATH="${RELPATH#"$CWD_UNIX"/}"
    # Try: TARGET as-is vs CWD physical (macOS /var → /private/var)
    elif [ "${RELPATH#"$CWD_PHYS"/}" != "$RELPATH" ]; then
      RELPATH="${RELPATH#"$CWD_PHYS"/}"
    # Try: native Windows CWD (Git Bash pwd -W)
    elif [ -n "$CWD_WIN" ] && [ "${RELPATH#"$CWD_WIN"/}" != "$RELPATH" ]; then
      RELPATH="${RELPATH#"$CWD_WIN"/}"
    fi
    ;;
esac

# Reject unresolved parent traversal before any phase-independent whitelist.
case "/$RELPATH/" in
  */../*)
    echo "[opensuper-HOOK] BLOCKED: unsafe path traversal in $RELPATH" >&2
    exit 2
    ;;
esac

# Resolve every existing target parent before applying logical-path whitelists.
# This prevents a workspace symlink from redirecting an allowed path into source code.
if [ -L "$TARGET" ]; then
  echo "[opensuper-HOOK] BLOCKED: symbolic-link targets are not writable: $TARGET" >&2
  exit 2
fi
if [ -e "$TARGET" ]; then
  _LINK_COUNT=$(stat -c '%h' "$TARGET" 2>/dev/null || stat -f '%l' "$TARGET" 2>/dev/null || true)
  case "$_LINK_COUNT" in
    ''|*[!0-9]*)
      echo "[opensuper-HOOK] BLOCKED: cannot verify target link count: $TARGET" >&2
      exit 2
      ;;
  esac
  if [ "$_LINK_COUNT" -gt 1 ]; then
    echo "[opensuper-HOOK] BLOCKED: hard-link targets are not writable: $TARGET" >&2
    exit 2
  fi
fi

_PDIR=$(cd "$(dirname "$TARGET")" 2>/dev/null && pwd -P 2>/dev/null || true)
if [ -n "$_PDIR" ]; then
  _TRESOLVED=$(norm "${_PDIR}/$(basename "$TARGET")")
  if [ "${_TRESOLVED#"$CWD_UNIX"/}" != "$_TRESOLVED" ]; then
    RELPATH="${_TRESOLVED#"$CWD_UNIX"/}"
  elif [ "${_TRESOLVED#"$CWD_PHYS"/}" != "$_TRESOLVED" ]; then
    RELPATH="${_TRESOLVED#"$CWD_PHYS"/}"
  elif [ -n "$CWD_WIN" ] && [ "${_TRESOLVED#"$CWD_WIN"/}" != "$_TRESOLVED" ]; then
    RELPATH="${_TRESOLVED#"$CWD_WIN"/}"
  else
    echo "[opensuper-HOOK] BLOCKED: target resolves outside project: $_TRESOLVED" >&2
    exit 2
  fi
fi

# ── Phase-independent workspace paths ────────────────────────────

case "$RELPATH" in
  .opensuper/*|*/.opensuper/*|.superpowers/*|*/.superpowers/*)
    echo "[opensuper-HOOK] allowed: $RELPATH (whitelist: workflow workspace)" >&2
    exit 0
    ;;
  .claude/*)
    echo "[opensuper-HOOK] allowed: $RELPATH (whitelist: claude config)" >&2
    exit 0
    ;;
  .opensuper.yaml|opensuper.yaml|.opensuper.yml|opensuper.yml)
    echo "[opensuper-HOOK] allowed: $RELPATH (whitelist: opensuper config)" >&2
    exit 0
    ;;
  CLAUDE.md|CHANGELOG.md|README.md|*.md)
    case "$RELPATH" in
      */*) ;;
      *)
        echo "[opensuper-HOOK] allowed: $RELPATH (whitelist: root markdown)" >&2
        exit 0
        ;;
    esac
    ;;
esac

# ── Find the active change that owns this write ───────────────────

TARGET_CHANGE=""
case "$RELPATH" in
  openspec/changes/*/*)
    TARGET_CHANGE="${RELPATH#openspec/changes/}"
    TARGET_CHANGE="${TARGET_CHANGE%%/*}"
    ;;
esac

YAML_FILE=""
TARGET_YAML_FILE=""
ACTIVE_COUNT=0
ACTIVE_NAMES=""
DOCS_ELIGIBLE_COUNT=0
ACTIVE_PHASES=""
if [ -d "openspec/changes" ]; then
  for dir in openspec/changes/*/; do
    [ -d "$dir" ] || continue
    # Skip archived changes
    case "$dir" in
      */archive/*) continue ;;
    esac
    if [ -f "${dir}.opensuper.yaml" ]; then
      CHANGE_NAME=$(basename "$dir")
      CHANGE_PHASE=$(grep "^phase:" "${dir}.opensuper.yaml" 2>/dev/null \
        | awk '{print $2}' \
        | tr -d '[:space:][:cntrl:]' \
        || true)
      ACTIVE_COUNT=$((ACTIVE_COUNT + 1))
      ACTIVE_NAMES="${ACTIVE_NAMES}${ACTIVE_NAMES:+, }${CHANGE_NAME}"
      ACTIVE_PHASES="${ACTIVE_PHASES}${ACTIVE_PHASES:+, }${CHANGE_NAME}:${CHANGE_PHASE:-missing}"
      case "$CHANGE_PHASE" in
        design|build|verify) DOCS_ELIGIBLE_COUNT=$((DOCS_ELIGIBLE_COUNT + 1)) ;;
      esac
      if [ "$ACTIVE_COUNT" -eq 1 ]; then
        YAML_FILE="${dir}.opensuper.yaml"
      fi
      if [ -n "$TARGET_CHANGE" ] && [ "$CHANGE_NAME" = "$TARGET_CHANGE" ]; then
        TARGET_YAML_FILE="${dir}.opensuper.yaml"
      fi
    fi
  done
fi

# Shared Superpowers artifacts are not change-owned paths. Allow them when at
# least one active workflow is in an artifact-writing phase, while still
# blocking them when every active workflow is in open/archive.
case "$RELPATH" in
  docs/superpowers/*)
    if [ "$DOCS_ELIGIBLE_COUNT" -gt 0 ]; then
      echo "[opensuper-HOOK] allowed: $RELPATH (eligible active phase; $ACTIVE_PHASES)" >&2
      exit 0
    elif [ "$ACTIVE_COUNT" -gt 1 ]; then
      echo "[opensuper-HOOK] BLOCKED: docs/superpowers writes require an active design, build, or verify phase" >&2
      echo "  Active changes: $ACTIVE_PHASES" >&2
      exit 2
    fi
    ;;
esac

if [ -n "$TARGET_YAML_FILE" ]; then
  YAML_FILE="$TARGET_YAML_FILE"
elif [ "$ACTIVE_COUNT" -eq 0 ]; then
  echo "[opensuper-HOOK] allowed: no active opensuper change" >&2
  exit 0
elif [ -n "$TARGET_CHANGE" ]; then
  echo "[opensuper-HOOK] BLOCKED: target change '$TARGET_CHANGE' is not active" >&2
  echo "  Active changes: $ACTIVE_NAMES" >&2
  exit 2
elif [ "$ACTIVE_COUNT" -gt 1 ]; then
  echo "[opensuper-HOOK] BLOCKED: multiple active opensuper changes; cannot determine owner for $RELPATH" >&2
  echo "  Active changes: $ACTIVE_NAMES" >&2
  echo "  Write inside openspec/changes/<name>/... or leave exactly one active change." >&2
  exit 2
fi

# ── Read current phase ───────────────────────────────────────────

PHASE=$(grep "^phase:" "$YAML_FILE" 2>/dev/null \
  | awk '{print $2}' \
  | tr -d '[:space:][:cntrl:]' \
  || true)

case "$PHASE" in
  open|design|build|verify|archive) ;;
  *)
    echo "[opensuper-HOOK] BLOCKED: invalid or missing phase in $YAML_FILE" >&2
    exit 2
    ;;
esac

# ── Whitelist: phase-aware allowed paths ─────────────────────────

case "$RELPATH" in
  openspec/*)
    # OpenSpec artifacts — phase-aware sub-check
    case "$PHASE" in
      open)
        # open: allow proposal, design, tasks, yaml, handoff, specs
        case "$RELPATH" in
          */proposal.md|*/design.md|*/tasks.md|*/.openspec.yaml|*/.opensuper.yaml|*/.opensuper/*|*/specs/*)
            echo "[opensuper-HOOK] allowed: $RELPATH (phase: open, openspec artifacts)" >&2
            exit 0
            ;;
        esac
        ;;
      design)
        # design: allow handoff, delta spec (Spec Patch), proposal/design/tasks (minor refinements), .opensuper.yaml
        case "$RELPATH" in
          */proposal.md|*/design.md|*/tasks.md|*/.opensuper/*|*/specs/*|*/.opensuper.yaml|*/.openspec.yaml)
            echo "[opensuper-HOOK] allowed: $RELPATH (phase: design, handoff/spec)" >&2
            exit 0
            ;;
        esac
        ;;
      build)
        # build: allow delta spec (incremental update), tasks, .opensuper.yaml
        case "$RELPATH" in
          */specs/*|*/tasks.md|*/.opensuper.yaml|*/.openspec.yaml)
            echo "[opensuper-HOOK] allowed: $RELPATH (phase: build, spec/tasks)" >&2
            exit 0
            ;;
        esac
        ;;
      verify)
        # verify: allow tasks (post-check), .opensuper.yaml
        case "$RELPATH" in
          */tasks.md|*/.opensuper.yaml|*/.openspec.yaml)
            echo "[opensuper-HOOK] allowed: $RELPATH (phase: verify, tasks/state)" >&2
            exit 0
            ;;
        esac
        ;;
      archive)
        # archive: allow .opensuper.yaml state updates only
        case "$RELPATH" in
          */.opensuper.yaml|*/.openspec.yaml)
            echo "[opensuper-HOOK] allowed: $RELPATH (phase: archive, state)" >&2
            exit 0
            ;;
        esac
        ;;
    esac
    ;;
  docs/superpowers/*)
    # Superpowers artifacts — phase-aware sub-check
    case "$PHASE" in
      design)
        echo "[opensuper-HOOK] allowed: $RELPATH (phase: design, superpowers)" >&2
        exit 0
        ;;
      build)
        echo "[opensuper-HOOK] allowed: $RELPATH (phase: build, superpowers)" >&2
        exit 0
        ;;
      verify)
        echo "[opensuper-HOOK] allowed: $RELPATH (phase: verify, superpowers)" >&2
        exit 0
        ;;
    esac
    # open/archive: block docs/superpowers writes
    ;;
esac

# ── Phase-based enforcement ──────────────────────────────────────

case "$PHASE" in
  build|verify)
    # Code writes allowed in build and verify
    echo "[opensuper-HOOK] allowed: $RELPATH (phase: $PHASE)" >&2
    exit 0
    ;;
  open|design|archive)
    echo "" >&2
    echo "╔══════════════════════════════════════════╗" >&2
    echo "║     opensuper PHASE GUARD — WRITE BLOCKED    ║" >&2
    echo "╚══════════════════════════════════════════╝" >&2
    echo "" >&2
    echo "  当前阶段: $PHASE" >&2
    echo "  目标文件: $RELPATH" >&2
    echo "" >&2
    case "$PHASE" in
      open)
        echo "  ❌ open 阶段不允许写源代码" >&2
        echo "  ✅ 允许: 创建 proposal/design/tasks, 运行 guard" >&2
        echo "  💡 完成需求澄清和 artifact 创建后运行 guard --apply" >&2
        ;;
      design)
        echo "  ❌ design 阶段不允许写源代码" >&2
        echo "  ✅ 允许: brainstorming, 创建 Design Doc, 运行 guard" >&2
        echo "  💡 完成 Design Doc 后运行 opensuper-guard design --apply 进入 build" >&2
        ;;
      archive)
        echo "  ❌ archive 阶段不允许写源代码" >&2
        echo "  ✅ 允许: 确认归档, 运行归档脚本" >&2
        ;;
    esac
    echo "" >&2
    exit 2
    ;;
esac

echo "[opensuper-HOOK] allowed: $RELPATH (phase: $PHASE)" >&2
exit 0
