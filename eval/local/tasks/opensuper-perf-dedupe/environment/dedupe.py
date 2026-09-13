"""dedupe-tool: remove duplicates from a sequence while preserving order.

The current implementation is O(n²) — it scans the whole output list for each
element. This is correct but far too slow for large inputs (10k+ items).
"""

from __future__ import annotations

from typing import Hashable, List, Sequence


def dedupe(items: Sequence[Hashable]) -> List[Hashable]:
    """Remove duplicates, preserving first-occurrence order.

    BUG (performance): O(n²) because `in result` is a linear scan. For a list
    of 10,000 items this takes several seconds; it should be near-instant.
    """
    result: List[Hashable] = []
    for item in items:
        if item not in result:  # <-- O(n) scan, making the whole thing O(n²)
            result.append(item)
    return result
