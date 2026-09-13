"""Python chart backend for paper-style eval report figures."""

from __future__ import annotations

import json
import sys
from typing import Any

from scaffold.python.report_outputs import _render_paper_figures_inline


def render_from_payload(payload: dict[str, Any]) -> str:
    return _render_paper_figures_inline(payload, backend="python")


def main() -> int:
    payload = json.loads(sys.stdin.read() or "{}")
    if not isinstance(payload, dict):
        raise ValueError("chart payload must be an object")
    sys.stdout.write(render_from_payload(payload))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
