"""External data handler - stub for opensuper skill benchmarks.

The original project uses this for LangSmith trace uploads and dataset management.
For opensuper-skill-eval, we keep the interface but remove LangSmith dependencies.
"""

from pathlib import Path
from typing import Any


def run_handler(handler_name: str, **kwargs) -> Any:
    """Run a named handler. No-op for opensuper benchmarks."""
    return None


def run_task_handlers(handlers: list, data_dir: Path, langsmith_env: str, run_id: str) -> dict:
    """Run task data handlers. Returns empty trace map for opensuper benchmarks."""
    return {}
