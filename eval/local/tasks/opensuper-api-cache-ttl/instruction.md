You are working on a Python project called "cache-lib" - a simple in-memory key-value cache.

Your task: Use the opensuper workflow to **add TTL (time-to-live) support** to the `Cache` class.

## The requirement

Add an optional `ttl` parameter to `set()`:

```python
def set(self, key: str, value: Any, ttl: Optional[float] = None) -> None:
    """Store a value. If ttl is given (seconds), the key expires after that long.
    ttl=0 or None means the key never expires."""
```

After a key's TTL elapses, `get()` must return the default (as if the key were absent). The existing behavior (no TTL) must not change.

## Design decisions to make (use brainstorming)

- **Lazy vs active eviction**: check expiry on `get()` (lazy, simple) vs a background sweep (active, complex). Lazy is recommended for this scope.
- **Overwrite semantics**: setting a key again without TTL should clear any prior expiry.
- **`__contains__` / `__len__`**: should expired keys count? (Expired keys should not appear present.)

## Tests

`test_cache.py` has a `TestTTL` class with 4 tests that currently FAIL. Plus 6 basic tests that must keep passing.

## What to do

1. Run tests to confirm: `python -m pytest test_cache.py -v`
2. Follow the opensuper workflow (Open → Design → Build → Verify → Archive).
3. Confirm all 10 tests pass after implementation.

Start by detecting the current phase and following the opensuper workflow. When you reach a decision point that asks for confirmation, assume "yes, proceed with the recommended option".
