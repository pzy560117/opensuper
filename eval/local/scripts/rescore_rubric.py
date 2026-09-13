"""Recompute rubric scores from saved artifacts + events without re-running claude.

Used after fixing rubric heuristics (e.g. archive-path handling) to regenerate
report scores for experiments whose test_dir has already been cleaned up.
Reads the saved events JSON + the artifacts/ snapshot and re-emits a corrected
report JSON.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from scaffold.python.paths import get_logs_dir
from scaffold.python.validation.rubric import RUBRIC_DIMENSIONS, opensuper_rubric_validator

RUBRIC_RE = re.compile(r"\[RUBRIC\]\s+(\S+):\s*([0-9.]+)")


def _scores_from_checks(checks: list[str]) -> dict[str, float]:
    scores: dict[str, float] = {}
    for c in checks:
        m = RUBRIC_RE.search(c)
        if m:
            try:
                scores[m.group(1)] = float(m.group(2))
            except ValueError:
                pass
    return scores


def recompute_experiment(experiment_dir: Path) -> int:
    events_dir = experiment_dir / "events"
    artifacts_root = experiment_dir / "artifacts"
    reports_dir = experiment_dir / "reports"

    if not reports_dir.exists():
        print(f"No reports in {experiment_dir}", file=sys.stderr)
        return 1

    for report_file in sorted(reports_dir.glob("*.json")):
        report = json.loads(report_file.read_text())
        treatment = report.get("name", "unknown")
        rep = report.get("rep", 1)

        # Locate the matching events + artifacts snapshot.
        events_file = None
        for cand in events_dir.glob("*.json"):
            data = json.loads(cand.read_text())
            # events files are named <treatment>_rep<N>.json but treatment may be
            # the full task-treatment id; match by the run_id instead.
            if data.get("run_id") == report.get("run_id") or treatment.replace("/", "_") in cand.stem:
                events_file = cand
                break
        # Fallback: filename pattern <treatment_lower>_rep<N>
        if events_file is None:
            stem = f"{treatment.lower().replace('/', '_')}_rep{rep}"
            cand = events_dir / f"{stem}.json"
            if cand.exists():
                events_file = cand

        # Locate artifacts dir (claude/ snapshot = the reconstructed test_dir).
        artifacts_claude = None
        for adir in (artifacts_root).iterdir() if artifacts_root.exists() else []:
            if adir.is_dir() and treatment.lower().replace("/", "_") in adir.name.lower():
                artifacts_claude = adir / "claude"
                break

        events = {}
        if events_file and events_file.exists():
            events = json.loads(events_file.read_text())

        if not artifacts_claude or not artifacts_claude.exists():
            print(f"[skip] {treatment}: no artifacts snapshot to rescore", file=sys.stderr)
            continue

        # Rebuild outputs from the original passed/failed (non-rubric) + fresh rubric.
        baseline_passed = [c for c in report.get("checks_passed", []) if "[RUBRIC]" not in c]
        baseline_failed = report.get("checks_failed", [])
        outputs = {
            "events": events,
            "completion": {"passed": baseline_passed, "failed": baseline_failed},
        }
        rubric_passed, _ = opensuper_rubric_validator(artifacts_claude, outputs)

        # Replace rubric checks in the report.
        report["checks_passed"] = baseline_passed + rubric_passed
        report_file.write_text(json.dumps(report, indent=2))
        new_scores = _scores_from_checks(rubric_passed)
        print(f"[ok] {treatment}: {', '.join(f'{d}={new_scores.get(d, 0):.2f}' for d in RUBRIC_DIMENSIONS)}")

    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("experiment", help="Experiment id or 'latest'")
    args = parser.parse_args(argv)

    logs = get_logs_dir()
    if args.experiment == "latest":
        dirs = sorted([d for d in (logs / "experiments").iterdir() if d.is_dir()], key=lambda p: p.stat().st_mtime)
        if not dirs:
            print("No experiments", file=sys.stderr)
            return 1
        experiment_dir = dirs[-1]
    else:
        experiment_dir = logs / "experiments" / args.experiment
        if not experiment_dir.exists():
            print(f"Not found: {experiment_dir}", file=sys.stderr)
            return 1

    return recompute_experiment(experiment_dir)


if __name__ == "__main__":
    raise SystemExit(main())
