"""Tests for dedupe-tool. All pass currently; the issue is performance, not correctness."""

import time

import pytest

from dedupe import dedupe


class TestCorrectness:
    def test_basic(self):
        assert dedupe([1, 2, 2, 3, 3, 3]) == [1, 2, 3]

    def test_preserves_order(self):
        assert dedupe([3, 1, 3, 2, 1]) == [3, 1, 2]

    def test_empty(self):
        assert dedupe([]) == []

    def test_all_same(self):
        assert dedupe([5, 5, 5, 5]) == [5]

    def test_no_duplicates(self):
        assert dedupe([1, 2, 3]) == [1, 2, 3]

    def test_strings(self):
        assert dedupe(["a", "b", "a", "c"]) == ["a", "b", "c"]


class TestPerformance:
    def test_large_input_is_fast(self):
        """A 30k-element list should dedupe in well under 1 second.

        The current O(n^2) implementation takes ~2s on a fast machine and
        longer in a Docker container; an O(n) implementation is near-instant.
        """
        data = list(range(15000)) * 2  # 30k items, 15k unique
        start = time.perf_counter()
        result = dedupe(data)
        elapsed = time.perf_counter() - start

        assert result == list(range(15000)), "correctness broke"
        assert elapsed < 1.0, f"too slow: {elapsed:.2f}s (O(n²)? expected O(n))"
