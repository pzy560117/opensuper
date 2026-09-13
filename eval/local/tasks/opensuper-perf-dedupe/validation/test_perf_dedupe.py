"""Validation for the opensuper-perf-dedupe task.

Checks: opensuper workflow followed + all tests pass (correctness + performance).
"""

import subprocess
import sys

from opensuper_checks import (
    run_opensuper_checks,
    write_results,
    _passed,
    _failed,
    WORKSPACE,
)


def check_dedupe_optimized() -> dict:
    """All dedupe tests pass, including the performance test."""
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "test_dedupe.py", "-v", "-q"],
        capture_output=True, text=True, cwd=str(WORKSPACE),
    )
    if result.returncode != 0:
        # Distinguish perf failure from correctness failure.
        out = result.stdout + result.stderr
        if "too slow" in out or "O(n" in out:
            return _failed("dedupe_optimized", f"still O(n²): {out[-300:]}")
        return _failed("dedupe_optimized", f"tests failing:\n{out[-400:]}")
    return _passed("dedupe_optimized", "correctness + performance tests pass")


def run_all() -> list[dict]:
    results = run_opensuper_checks()
    results.append(check_dedupe_optimized())
    return results


if __name__ == "__main__":
    write_results(run_all())
