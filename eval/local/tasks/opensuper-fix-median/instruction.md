You are working on a Python project called "stats-lib" - a small statistics calculation library.

Your task: Use the opensuper workflow to **fix a bug** in the `median()` function.

## The bug

`median()` returns the wrong result for even-length lists. For example, `median([1, 2, 3, 4])` returns `2` but should return `2.5` (the average of the two middle values).

The existing tests in `test_stats.py` make this explicit — two tests in `TestMedian` currently fail:
- `test_even`: `median([1, 2, 3, 4])` should be `2.5`
- `test_even_unsorted`: `median([4, 1, 3, 2])` should be `2.5`

All other tests pass and must continue to pass.

## What to do

1. First, run the existing tests to confirm the failure: `python -m pytest test_stats.py -v`
2. Follow the opensuper workflow phases:
   - **Open**: Create a proposal describing the bug and fix scope
   - **Design**: Investigate the root cause and design the fix
   - **Build**: Implement the fix in `stats.py`
   - **Verify**: Run the full test suite to confirm all tests pass (including previously-failing ones) and no regressions
   - **Archive**: Archive the completed change

Start by detecting the current phase and following the opensuper workflow. When you reach a decision point that asks for confirmation, assume "yes, proceed with the recommended option".
