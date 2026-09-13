"""Validation for the opensuper-refactor-counter task.

Checks: opensuper workflow followed + a count() dispatcher exists + behavior
preserved (all existing tests pass) + wrappers delegate (no duplicated loops).
"""

import re
import subprocess
import sys

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


def check_count_dispatcher() -> dict:
    """A count(text, unit) dispatcher exists and wrappers delegate to it."""
    src_path = WORKSPACE / "text_processor.py"
    if not src_path.exists():
        return _failed("count_dispatcher", "text_processor.py not found")
    src = src_path.read_text(errors="ignore")

    # Dispatcher must exist.
    if not re.search(r"^def count\(\s*(?:text|s)\s*:\s*str\s*,\s*unit\s*:\s*str", src, re.MULTILINE):
        return _failed("count_dispatcher", "no count(text, unit) dispatcher found")

    # Wrappers must delegate (contain a count( call), not their own tally loop.
    for wrapper in ("count_words", "count_lines", "count_chars"):
        # Find the function body.
        m = re.search(rf"def {wrapper}\([^)]*\)\s*(?:->\s*[^:]+)?:(.*?)(?=\ndef |\Z)", src, re.DOTALL)
        if not m:
            return _failed("count_dispatcher", f"wrapper {wrapper} missing")
        body = m.group(1)
        if "count(" not in body:
            return _failed("count_dispatcher", f"{wrapper} does not delegate to count()")
        # A raw for-loop tallying a counter inside the wrapper means it wasn't refactored.
        if re.search(r"\bcount\s*\+=\s*1", body) or re.search(r"for\s+\w+\s+in\s+\w+\.split", body):
            return _failed("count_dispatcher", f"{wrapper} still has inline tally logic")

    return _passed("count_dispatcher", "count() dispatcher + 3 delegating wrappers")


def check_behavior_preserved() -> dict:
    """All existing tests still pass after refactoring."""
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "test_text_processor.py", "-q"],
        capture_output=True, text=True, cwd=str(WORKSPACE),
    )
    if result.returncode != 0:
        return _failed("behavior_preserved", f"tests failing:\n{_subprocess_output(result)}")
    return _passed("behavior_preserved", "all existing tests pass")


def run_all() -> list[dict]:
    results = run_opensuper_checks()
    results.append(check_count_dispatcher())
    results.append(check_behavior_preserved())
    return results


if __name__ == "__main__":
    write_results(run_all())
