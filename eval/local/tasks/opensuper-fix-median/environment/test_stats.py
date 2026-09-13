"""Tests for stats-lib.

The median tests for even-length input currently FAIL — that is the bug to fix.
All other tests pass.
"""

import pytest

from stats import mean, median, mode, stdev


class TestMean:
    def test_basic(self):
        assert mean([1, 2, 3, 4]) == 2.5

    def test_single(self):
        assert mean([42]) == 42

    def test_empty_raises(self):
        with pytest.raises(ValueError):
            mean([])


class TestMedian:
    def test_odd(self):
        assert median([3, 1, 2]) == 2

    def test_single(self):
        assert median([7]) == 7

    def test_even(self):
        # This test currently FAILS due to the bug.
        assert median([1, 2, 3, 4]) == 2.5

    def test_even_unsorted(self):
        # This test currently FAILS due to the bug.
        assert median([4, 1, 3, 2]) == 2.5

    def test_negative(self):
        assert median([-5, -1, -3]) == -3

    def test_empty_raises(self):
        with pytest.raises(ValueError):
            median([])


class TestMode:
    def test_basic(self):
        assert mode([1, 2, 2, 3]) == 2

    def test_all_same(self):
        assert mode([5, 5, 5]) == 5

    def test_tie_raises(self):
        with pytest.raises(ValueError):
            mode([1, 2])


class TestStdev:
    def test_basic(self):
        assert stdev([2, 4, 4, 4, 5, 5, 7, 9]) == 2.0

    def test_single_zero(self):
        assert stdev([3]) == 0.0

    def test_empty_raises(self):
        with pytest.raises(ValueError):
            stdev([])
