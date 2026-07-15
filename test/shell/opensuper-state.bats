#!/usr/bin/env bats

setup() {
  export TEST_TMPDIR="$(mktemp -d)"
  export SCRIPT_SOURCE="$BATS_TEST_DIRNAME/../../assets/skills/opensuper/scripts/opensuper-state.sh"
  export SCRIPT_PATH="$TEST_TMPDIR/opensuper-state.sh"
  export GUARD_PATH="$TEST_TMPDIR/opensuper-guard.sh"
  export HANDOFF_PATH="$TEST_TMPDIR/opensuper-handoff.sh"
  cd "$TEST_TMPDIR"
  tr -d '\r' < "$SCRIPT_SOURCE" > "$SCRIPT_PATH"
  tr -d '\r' < "$BATS_TEST_DIRNAME/../../assets/skills/opensuper/scripts/opensuper-guard.sh" > "$GUARD_PATH"
  tr -d '\r' < "$BATS_TEST_DIRNAME/../../assets/skills/opensuper/scripts/opensuper-handoff.sh" > "$HANDOFF_PATH"
  tr -d '\r' < "$BATS_TEST_DIRNAME/../../assets/skills/opensuper/scripts/opensuper-yaml-validate.sh" > "$TEST_TMPDIR/opensuper-yaml-validate.sh"
  mkdir -p openspec/changes
}

teardown() {
  rm -rf "$TEST_TMPDIR"
}

# --- init subcommand ---

@test "init creates .opensuper.yaml with full workflow defaults" {
  run bash "$SCRIPT_PATH" init my-change full
  [ "$status" -eq 0 ]
  [ -f "openspec/changes/my-change/.opensuper.yaml" ]
  grep -q "phase: open" "openspec/changes/my-change/.opensuper.yaml"
  grep -q "verify_mode: null" "openspec/changes/my-change/.opensuper.yaml"
  grep -q "verification_report: null" "openspec/changes/my-change/.opensuper.yaml"
  grep -q "branch_status: pending" "openspec/changes/my-change/.opensuper.yaml"
  grep -q "opentest_gate: null" "openspec/changes/my-change/.opensuper.yaml"
  grep -q "opentest_strict_result: null" "openspec/changes/my-change/.opensuper.yaml"
  grep -q "archive_confirmation: pending" "openspec/changes/my-change/.opensuper.yaml"
}

@test "init creates .opensuper.yaml with hotfix workflow defaults" {
  run bash "$SCRIPT_PATH" init hotfix-123 hotfix
  [ "$status" -eq 0 ]
  grep -q "phase: open" "openspec/changes/hotfix-123/.opensuper.yaml"
  grep -q "build_mode: direct" "openspec/changes/hotfix-123/.opensuper.yaml"
}

@test "init creates .opensuper.yaml with tweak workflow defaults" {
  run bash "$SCRIPT_PATH" init tweak-abc tweak
  [ "$status" -eq 0 ]
  grep -q "phase: open" "openspec/changes/tweak-abc/.opensuper.yaml"
  grep -q "isolation: branch" "openspec/changes/tweak-abc/.opensuper.yaml"
}

@test "init rejects duplicate .opensuper.yaml" {
  bash "$SCRIPT_PATH" init my-change full
  run bash "$SCRIPT_PATH" init my-change full
  [ "$status" -ne 0 ]
}

@test "init rejects invalid workflow" {
  run bash "$SCRIPT_PATH" init my-change invalid
  [ "$status" -ne 0 ]
}

@test "init rejects empty change name" {
  run bash "$SCRIPT_PATH" init "" full
  [ "$status" -ne 0 ]
}

@test "init rejects change name with special characters" {
  run bash "$SCRIPT_PATH" init "my change" full
  [ "$status" -ne 0 ]
}

@test "init rejects path traversal" {
  run bash "$SCRIPT_PATH" init ".." full
  [ "$status" -ne 0 ]
}

# --- get subcommand ---

@test "get retrieves field value" {
  bash "$SCRIPT_PATH" init my-change full
  run bash "$SCRIPT_PATH" get my-change phase
  [ "$status" -eq 0 ]
  [ "$output" = "open" ]
}

@test "get fails for missing change" {
  run bash "$SCRIPT_PATH" get nonexistent phase
  [ "$status" -ne 0 ]
}

# --- set subcommand ---

@test "set blocks direct phase updates unless repair override is explicit" {
  bash "$SCRIPT_PATH" init my-change full
  run bash "$SCRIPT_PATH" set my-change phase build
  [ "$status" -ne 0 ]
  [[ "$output" == *"OPENSUPER_FORCE_PHASE=1"* ]]

  run env opensuper_INTERNAL_PHASE=1 bash "$SCRIPT_PATH" set my-change phase archive
  [ "$status" -ne 0 ]

  run bash "$SCRIPT_PATH" get my-change phase
  [ "$output" = "open" ]

  run env OPENSUPER_FORCE_PHASE=1 bash "$SCRIPT_PATH" set my-change phase build
  [ "$status" -eq 0 ]

  run bash "$SCRIPT_PATH" get my-change phase
  [ "$output" = "build" ]
}

@test "set rejects unknown field" {
  bash "$SCRIPT_PATH" init my-change full
  run bash "$SCRIPT_PATH" set my-change invalid_field value
  [ "$status" -ne 0 ]
}

@test "set validates phase enum" {
  bash "$SCRIPT_PATH" init my-change full
  run bash "$SCRIPT_PATH" set my-change phase invalid
  [ "$status" -ne 0 ]
}

@test "set validates verify_mode enum" {
  bash "$SCRIPT_PATH" init my-change full
  run bash "$SCRIPT_PATH" set my-change verify_mode invalid
  [ "$status" -ne 0 ]
}

@test "set blocks direct archived updates" {
  bash "$SCRIPT_PATH" init my-change full
  run bash "$SCRIPT_PATH" set my-change archived maybe
  [ "$status" -ne 0 ]
}

@test "set validates branch_status enum" {
  bash "$SCRIPT_PATH" init my-change full
  run bash "$SCRIPT_PATH" set my-change branch_status maybe
  [ "$status" -ne 0 ]
}

@test "set validates OpenTest gate fields" {
  bash "$SCRIPT_PATH" init my-change full

  run bash "$SCRIPT_PATH" set my-change opentest_gate required
  [ "$status" -eq 0 ]

  run bash "$SCRIPT_PATH" set my-change opentest_strict_result docs/opentest/strict.json
  [ "$status" -eq 0 ]

  run bash "$SCRIPT_PATH" set my-change opentest_gate optional
  [ "$status" -ne 0 ]

  run bash "$SCRIPT_PATH" set my-change opentest_strict_result ../strict.json
  [ "$status" -ne 0 ]
}

@test "set allows free-form design_doc value" {
  bash "$SCRIPT_PATH" init my-change full
  run bash "$SCRIPT_PATH" set my-change design_doc "docs/design.md"
  [ "$status" -eq 0 ]
}

# --- check subcommand ---

@test "check open passes with initialized state" {
  bash "$SCRIPT_PATH" init my-change full
  run bash "$SCRIPT_PATH" check my-change open
  [ "$status" -eq 0 ]
}

@test "check open fails without .opensuper.yaml" {
  mkdir -p openspec/changes/my-change
  run bash "$SCRIPT_PATH" check my-change open
  [ "$status" -ne 0 ]
}

@test "check open fails if phase is not open" {
  bash "$SCRIPT_PATH" init my-change full
  OPENSUPER_FORCE_PHASE=1 bash "$SCRIPT_PATH" set my-change phase design
  run bash "$SCRIPT_PATH" check my-change open
  [ "$status" -ne 0 ]
}

@test "check design passes with correct state" {
  bash "$SCRIPT_PATH" init my-change full
  OPENSUPER_FORCE_PHASE=1 bash "$SCRIPT_PATH" set my-change phase design
  echo "content" > openspec/changes/my-change/proposal.md
  echo "content" > openspec/changes/my-change/design.md
  echo "content" > openspec/changes/my-change/tasks.md
  run bash "$SCRIPT_PATH" check my-change design
  [ "$status" -eq 0 ]
}

@test "check design fails if design_doc is set (not empty)" {
  bash "$SCRIPT_PATH" init my-change full
  OPENSUPER_FORCE_PHASE=1 bash "$SCRIPT_PATH" set my-change phase design
  bash "$SCRIPT_PATH" set my-change design_doc "some-doc.md"
  echo "content" > openspec/changes/my-change/proposal.md
  echo "content" > openspec/changes/my-change/design.md
  echo "content" > openspec/changes/my-change/tasks.md
  run bash "$SCRIPT_PATH" check my-change design
  [ "$status" -ne 0 ]
}

# --- scale subcommand ---

@test "scale defaults to light for small changes" {
  bash "$SCRIPT_PATH" init my-change full
  mkdir -p openspec/changes/my-change
  echo "- [ ] task 1" > openspec/changes/my-change/tasks.md
  run bash "$SCRIPT_PATH" scale my-change
  [ "$status" -eq 0 ]

  run bash "$SCRIPT_PATH" get my-change verify_mode
  [ "$output" = "light" ]
}

# --- transition subcommand ---

@test "open-complete blocks full workflow without OpenSpec artifacts" {
  bash "$SCRIPT_PATH" init my-change full

  run bash "$SCRIPT_PATH" transition my-change open-complete
  [ "$status" -ne 0 ]

  run bash "$SCRIPT_PATH" get my-change phase
  [ "$output" = "open" ]
}

@test "open-complete advances full workflow after the Open artifacts are complete" {
  bash "$SCRIPT_PATH" init my-change full
  echo "proposal" > openspec/changes/my-change/proposal.md
  echo "design" > openspec/changes/my-change/design.md
  echo "- [ ] task" > openspec/changes/my-change/tasks.md

  run bash "$SCRIPT_PATH" transition my-change open-complete
  [ "$status" -eq 0 ]
  [[ "$output" != *"repair-only override"* ]]

  run bash "$SCRIPT_PATH" get my-change phase
  [ "$output" = "design" ]
}

@test "open-complete keeps preset workflow on its existing artifact contract" {
  bash "$SCRIPT_PATH" init my-change tweak
  echo "proposal" > openspec/changes/my-change/proposal.md
  echo "design" > openspec/changes/my-change/design.md
  echo "- [ ] task" > openspec/changes/my-change/tasks.md

  run bash "$SCRIPT_PATH" transition my-change open-complete
  [ "$status" -eq 0 ]

  run bash "$SCRIPT_PATH" get my-change phase
  [ "$output" = "build" ]
}

@test "design-complete blocks without the existing handoff and Design Doc contract" {
  bash "$SCRIPT_PATH" init my-change full
  OPENSUPER_FORCE_PHASE=1 bash "$SCRIPT_PATH" set my-change phase design
  echo "proposal" > openspec/changes/my-change/proposal.md
  echo "design" > openspec/changes/my-change/design.md
  echo "- [ ] task" > openspec/changes/my-change/tasks.md

  run bash "$SCRIPT_PATH" transition my-change design-complete
  [ "$status" -ne 0 ]
  [[ "$output" == *"handoff_context"* ]]

  run bash "$SCRIPT_PATH" get my-change phase
  [ "$output" = "design" ]
}

@test "design-complete advances only after the existing handoff and Design Doc contract passes" {
  bash "$SCRIPT_PATH" init my-change full
  OPENSUPER_FORCE_PHASE=1 bash "$SCRIPT_PATH" set my-change phase design
  echo "proposal" > openspec/changes/my-change/proposal.md
  echo "design" > openspec/changes/my-change/design.md
  echo "- [ ] task" > openspec/changes/my-change/tasks.md
  mkdir -p openspec/changes/my-change/specs/example
  echo "# Requirements" > openspec/changes/my-change/specs/example/spec.md
  bash "$HANDOFF_PATH" my-change design --write
  mkdir -p docs/superpowers/specs
  printf '%s\n' '---' 'opensuper_change: my-change' 'role: technical-design' 'canonical_spec: openspec' '---' '# Design' > docs/superpowers/specs/my-change.md
  bash "$SCRIPT_PATH" set my-change design_doc docs/superpowers/specs/my-change.md

  run bash "$SCRIPT_PATH" transition my-change design-complete
  [ "$status" -eq 0 ]

  run bash "$SCRIPT_PATH" get my-change phase
  [ "$output" = "build" ]
}

@test "archive confirmation is required before archived and reset on reopen" {
  bash "$SCRIPT_PATH" init my-change full
  OPENSUPER_FORCE_PHASE=1 bash "$SCRIPT_PATH" set my-change phase archive

  run bash "$SCRIPT_PATH" set my-change archive_confirmation confirmed
  [ "$status" -ne 0 ]
  [[ "$output" == *"archive-confirm"* ]]

  run env opensuper_INTERNAL_ARCHIVE_CONFIRMATION=1 bash "$SCRIPT_PATH" set my-change archive_confirmation confirmed
  [ "$status" -ne 0 ]

  run bash "$SCRIPT_PATH" set my-change archived true
  [ "$status" -ne 0 ]

  run bash "$SCRIPT_PATH" get my-change archived
  [ "$output" = "false" ]

  run bash "$SCRIPT_PATH" transition my-change archived
  [ "$status" -ne 0 ]
  [[ "$output" == *"archive_confirmation must be confirmed"* ]]

  run bash "$SCRIPT_PATH" transition my-change archive-confirm
  [ "$status" -eq 0 ]
  run bash "$SCRIPT_PATH" get my-change archive_confirmation
  [ "$output" = "confirmed" ]

  run bash "$SCRIPT_PATH" transition my-change archived
  [ "$status" -ne 0 ]
  [[ "$output" == *"moved into openspec/changes/archive"* ]]

  run bash "$SCRIPT_PATH" get my-change archived
  [ "$output" = "false" ]

  run bash "$SCRIPT_PATH" transition my-change archive-reopen
  [ "$status" -eq 0 ]
  run bash "$SCRIPT_PATH" get my-change archive_confirmation
  [ "$output" = "pending" ]
}

@test "transition usage lists archive-confirm" {
  run bash "$SCRIPT_PATH" transition my-change
  [ "$status" -ne 0 ]
  [[ "$output" == *"archive-confirm"* ]]
}

# --- usage errors ---

@test "unknown subcommand exits with error" {
  run bash "$SCRIPT_PATH" unknown-cmd
  [ "$status" -ne 0 ]
}

@test "init missing args shows usage" {
  run bash "$SCRIPT_PATH" init my-change
  [ "$status" -ne 0 ]
}

@test "get missing args shows usage" {
  run bash "$SCRIPT_PATH" get my-change
  [ "$status" -ne 0 ]
}

@test "set missing args shows usage" {
  run bash "$SCRIPT_PATH" set my-change phase
  [ "$status" -ne 0 ]
}

@test "check missing args shows usage" {
  run bash "$SCRIPT_PATH" check my-change
  [ "$status" -ne 0 ]
}

@test "scale missing args shows usage" {
  run bash "$SCRIPT_PATH" scale
  [ "$status" -ne 0 ]
}
