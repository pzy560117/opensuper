"""Validation script for the opensuper-fix-median task.

Runs inside Docker. Checks the opensuper workflow was followed AND the median bug
is fixed (even-length lists) with no regressions.
"""

import json
import subprocess
import sys
from pathlib import Path

from opensuper_checks import (
    run_opensuper_checks,
    write_results,
    _passed,
    _failed,
    WORKSPACE,
)


def _subprocess_output(result: subprocess.CompletedProcess) -> str:
    output = "\n".join(
        part.strip()
        for part in (result.stdout or "", result.stderr or "")
        if part and part.strip()
    )
    return output[-600:]


def check_median_fix() -> dict:
    """median() returns 2.5 for [1,2,3,4] and all existing tests pass."""
    # Import the (presumably fixed) stats module and check the even case.
    result = subprocess.run(
        [sys.executable, "-c", "from stats import median; print(median([1,2,3,4]))"],
        capture_output=True, text=True, cwd=str(WORKSPACE),
    )
    if result.returncode != 0:
        return _failed("median_fix", f"import/run error: {result.stderr.strip()[:150]}")
    val = result.stdout.strip()
    if val != "2.5":
        return _failed("median_fix", f"median([1,2,3,4]) == {val}, expected 2.5")

    # Run the full existing test suite — all must pass now.
    test_result = subprocess.run(
        [sys.executable, "-m", "pytest", "test_stats.py", "-q"],
        capture_output=True, text=True, cwd=str(WORKSPACE),
    )
    if test_result.returncode != 0:
        return _failed("median_fix", f"existing tests still failing:\n{_subprocess_output(test_result)}")
    return _passed("median_fix", "median([1,2,3,4])==2.5, all tests pass")


def run_all() -> list[dict]:
    results = run_opensuper_checks()
    results.append(check_median_fix())
    return results


if __name__ == "__main__":
    write_results(run_all())
