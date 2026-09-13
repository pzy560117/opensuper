"""stats-lib: a small statistics calculation library.

Provides mean, median, mode, and standard deviation. There is a known bug in
`median()` for even-length inputs that needs fixing.
"""

from __future__ import annotations

from collections import Counter
from typing import Sequence


def mean(values: Sequence[float]) -> float:
    """Arithmetic mean. Raises ValueError on empty input."""
    if not values:
        raise ValueError("mean() requires at least one value")
    return sum(values) / len(values)


def median(values: Sequence[float]) -> float:
    """Median (middle value for odd length, average of two middles for even).

    BUG: for even-length inputs this returns the lower middle only instead of
    averaging the two middle values.
    """
    if not values:
        raise ValueError("median() requires at least one value")
    ordered = sorted(values)
    n = len(ordered)
    mid = n // 2
    if n % 2 == 1:
        return ordered[mid]
    # BUG: should be (ordered[mid - 1] + ordered[mid]) / 2
    return ordered[mid - 1]


def mode(values: Sequence[float]) -> float:
    """Most common value. Raises ValueError on empty input or ties."""
    if not values:
        raise ValueError("mode() requires at least one value")
    counts = Counter(values)
    top = counts.most_common(2)
    if len(top) > 1 and top[0][1] == top[1][1]:
        raise ValueError("mode() is ambiguous: multiple values share the top count")
    return top[0][0]


def stdev(values: Sequence[float]) -> float:
    """Population standard deviation. Raises ValueError on empty input."""
    if not values:
        raise ValueError("stdev() requires at least one value")
    avg = mean(values)
    variance = sum((x - avg) ** 2 for x in values) / len(values)
    return variance ** 0.5
