"""cache-lib: a simple in-memory key-value cache.

Currently supports set/get/delete with no expiration. The task is to add
optional TTL (time-to-live) support while keeping the existing API backward
compatible.
"""

from __future__ import annotations

from typing import Any, Optional


class Cache:
    """A simple in-memory cache. Thread-safety is out of scope."""

    def __init__(self) -> None:
        self._store: dict[str, Any] = {}

    def set(self, key: str, value: Any) -> None:
        """Store a value. Overwrites any existing value (no expiry)."""
        self._store[key] = value

    def get(self, key: str, default: Any = None) -> Any:
        """Retrieve a value, or `default` if the key is absent."""
        return self._store.get(key, default)

    def delete(self, key: str) -> bool:
        """Remove a key. Returns True if it existed, False otherwise."""
        return self._store.pop(key, None) is not None

    def clear(self) -> None:
        """Remove all entries."""
        self._store.clear()

    def __len__(self) -> int:
        return len(self._store)

    def __contains__(self, key: object) -> bool:
        return key in self._store
