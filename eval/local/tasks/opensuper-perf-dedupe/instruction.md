You are working on a Python project called "dedupe-tool" - a utility for removing duplicates from sequences.

Your task: Use the opensuper workflow to **optimize** the `dedupe()` function from O(n²) to O(n).

## The problem

`dedupe()` in `dedupe.py` is correct but uses `if item not in result` where `result` is a list — a linear scan that makes the whole function O(n²). For a 10,000-element input this takes several seconds.

The performance test `TestPerformance::test_large_input_is_fast` currently FAILS because of this.

## Goal

Rewrite `dedupe()` to run in **O(n)** time while preserving:
1. **Correctness** — same output for all inputs (first-occurrence order preserved)
2. **The signature** — `dedupe(items: Sequence[Hashable]) -> List[Hashable]`

The standard approach is to track seen items in a `set` (O(1) lookup) alongside the result list. Consider whether `dict.fromkeys()` (which preserves insertion order in Python 3.7+) is appropriate, and document the tradeoff in your design.

## What to do

1. Run the tests to confirm the perf test fails: `python -m pytest test_dedupe.py -v`
2. Follow the opensuper workflow (Open → Design → Build → Verify → Archive).
3. After optimizing, confirm ALL tests pass including the performance test.

Start by detecting the current phase and following the opensuper workflow. When you reach a decision point that asks for confirmation, assume "yes, proceed with the recommended option".
