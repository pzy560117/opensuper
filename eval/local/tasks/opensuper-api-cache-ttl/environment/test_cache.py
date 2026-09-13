"""Tests for cache-lib.

The TTL tests currently FAIL because TTL is not yet implemented.
The basic tests all pass and must continue to pass (backward compatibility).
"""

import time

import pytest

from cache import Cache


class TestBasic:
    def test_set_get(self):
        c = Cache()
        c.set("k", "v")
        assert c.get("k") == "v"

    def test_get_missing_default(self):
        c = Cache()
        assert c.get("nope") is None
        assert c.get("nope", "fallback") == "fallback"

    def test_overwrite(self):
        c = Cache()
        c.set("k", 1)
        c.set("k", 2)
        assert c.get("k") == 2

    def test_delete(self):
        c = Cache()
        c.set("k", "v")
        assert c.delete("k") is True
        assert c.delete("k") is False
        assert c.get("k") is None

    def test_clear(self):
        c = Cache()
        c.set("a", 1)
        c.set("b", 2)
        c.clear()
        assert len(c) == 0

    def test_contains(self):
        c = Cache()
        c.set("k", "v")
        assert "k" in c
        assert "x" not in c


class TestTTL:
    def test_set_with_ttl_expires(self):
        """A key set with a TTL should return the default after expiry."""
        c = Cache()
        c.set("temp", "value", ttl=0.1)
        assert c.get("temp") == "value"  # immediately available
        time.sleep(0.2)
        assert c.get("temp") is None  # expired

    def test_no_ttl_does_not_expire(self):
        """A key set without TTL must not expire (backward compat)."""
        c = Cache()
        c.set("perm", "value")
        time.sleep(0.1)
        assert c.get("perm") == "value"

    def test_ttl_overwrite_without_ttl(self):
        """Overwriting a TTL key without TTL should remove the expiry."""
        c = Cache()
        c.set("k", 1, ttl=0.05)
        c.set("k", 2)  # no ttl -> permanent
        time.sleep(0.1)
        assert c.get("k") == 2

    def test_ttl_zero_means_no_expiry(self):
        """ttl=0 (or omitted) means the key never expires."""
        c = Cache()
        c.set("k", "v", ttl=0)
        time.sleep(0.05)
        assert c.get("k") == "v"
