You are working on a Python project called "text-processor" - a text analysis utility library.

Your task: Use the opensuper workflow to **refactor** the duplicated counting logic.

## The problem

`text_processor.py` has three near-identical functions — `count_words`, `count_lines`, `count_chars` — each repeating the same "split + iterate + tally" pattern with only the splitting strategy differing. This violates DRY.

The goal is to introduce a **single dispatcher**:

```python
def count(text: str, unit: str) -> int:
    """Count words/lines/chars. unit must be 'words', 'lines', or 'chars'."""
    ...
```

Then rewrite `count_words`, `count_lines`, `count_chars` as **thin wrappers** that delegate to `count()`. The public API (function names, signatures, return values) must stay identical.

## Constraints

- **Behavior must not change**: every test in `test_text_processor.py` must still pass.
- `analyze()` must continue to work unchanged.
- `count()` should raise `ValueError` for an unknown unit.

## What to do

1. First, run the existing tests to confirm they pass: `python -m pytest test_text_processor.py -v`
2. Follow the opensuper workflow phases (Open → Design → Build → Verify → Archive).
3. After refactoring, run the tests again to prove behavior is preserved.

Start by detecting the current phase and following the opensuper workflow. When you reach a decision point that asks for confirmation, assume "yes, proceed with the recommended option".
