"""Validation for the opensuper-api-cache-ttl task.

Checks: opensuper workflow followed + set() accepts ttl + TTL tests pass + backward compat.
"""

import inspect
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


def check_ttl_implementation() -> dict:
    """set() has a ttl param and all tests pass (TTL + backward compat)."""
    # set() must accept a ttl parameter.
    sig_result = subprocess.run(
        [sys.executable, "-c",
         "import inspect,cache; sig=inspect.signature(cache.Cache.set); print(list(sig.parameters))"],
        capture_output=True, text=True, cwd=str(WORKSPACE),
    )
    if sig_result.returncode != 0:
        return _failed("ttl_implementation", f"cannot inspect cache.Cache.set: {sig_result.stderr[:150]}")
    if "ttl" not in sig_result.stdout:
        return _failed("ttl_implementation", "Cache.set() has no 'ttl' parameter")

    # All tests must pass (TTL + backward compat).
    test_result = subprocess.run(
        [sys.executable, "-m", "pytest", "test_cache.py", "-q"],
        capture_output=True, text=True, cwd=str(WORKSPACE),
    )
    if test_result.returncode != 0:
        return _failed("ttl_implementation", f"tests failing:\n{_subprocess_output(test_result)}")
    return _passed("ttl_implementation", "set(ttl=...) works, all 10 tests pass")


def run_all() -> list[dict]:
    results = run_opensuper_checks()
    results.append(check_ttl_implementation())
    return results


if __name__ == "__main__":
    write_results(run_all())
