"""config-loader: load and query simple INI-style configuration files.

The current implementation is brittle: it crashes or silently misbehaves on
malformed input. The task is to add structured error handling so invalid input
raises a clear, typed exception instead of a cryptic crash.
"""

from __future__ import annotations

from typing import Any


class ConfigError(Exception):
    """Base exception for all config-loading errors."""


def load_config(text: str) -> dict[str, dict[str, str]]:
    """Parse an INI-style config string into {section: {key: value}}.

    Format:
        [section]
        key = value
        # comment lines start with #

    BUG: malformed input causes unhandled exceptions or silently corrupt data.
    It should instead raise ConfigError subclasses with clear messages.
    """
    config: dict[str, dict[str, str]] = {}
    current_section: str | None = None

    for lineno, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("[") and stripped.endswith("]"):
            current_section = stripped[1:-1]
            if current_section in config:
                # BUG: silently overwrites instead of raising
                pass
            config[current_section] = {}
            continue
        if "=" not in stripped:
            # BUG: silently skips invalid lines instead of raising
            continue
        if current_section is None:
            # BUG: crashes later with KeyError or silently drops
            continue
        key, _, value = stripped.partition("=")
        config[current_section][key.strip()] = value.strip()

    return config


def get(config: dict[str, dict[str, str]], section: str, key: str, default: Any = None) -> Any:
    """Get a value from a loaded config, or `default` if missing."""
    return config.get(section, {}).get(key, default)
