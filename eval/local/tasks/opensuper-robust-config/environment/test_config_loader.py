"""Tests for config-loader.

The error-handling tests currently FAIL (the brittle implementation crashes or
silently misbehaves). The happy-path tests pass.
"""

import pytest

from config_loader import ConfigError, load_config, get


VALID_CONFIG = """\
# Application settings
[server]
host = localhost
port = 8080

[database]
url = postgres://localhost/app
pool = 10
"""


class TestHappyPath:
    def test_parse_basic(self):
        cfg = load_config(VALID_CONFIG)
        assert cfg["server"]["host"] == "localhost"
        assert cfg["server"]["port"] == "8080"
        assert cfg["database"]["pool"] == "10"

    def test_comments_ignored(self):
        cfg = load_config("# comment\n[s]\nk = v\n")
        assert cfg == {"s": {"k": "v"}}

    def test_empty(self):
        assert load_config("") == {}

    def test_get_with_default(self):
        cfg = load_config("[s]\nk = v\n")
        assert get(cfg, "s", "k") == "v"
        assert get(cfg, "s", "missing", "fb") == "fb"
        assert get(cfg, "nope", "k", "fb") == "fb"


class TestErrorHandling:
    def test_key_without_section_raises(self):
        """A key=value line before any [section] must raise ConfigError."""
        with pytest.raises(ConfigError):
            load_config("key = value\n[section]\n")

    def test_duplicate_section_raises(self):
        """The same [section] appearing twice must raise ConfigError."""
        with pytest.raises(ConfigError):
            load_config("[s]\nk=v\n[s]\nk2=v2\n")

    def test_malformed_line_raises(self):
        """A line that is neither blank, comment, section, nor key=value must raise."""
        with pytest.raises(ConfigError):
            load_config("[s]\njust some text\n")

    def test_empty_section_name_raises(self):
        """An empty section header [] must raise ConfigError."""
        with pytest.raises(ConfigError):
            load_config("[]\nk=v\n")

    def test_error_messages_are_informative(self):
        """ConfigError messages should mention the line number or nature of the error."""
        with pytest.raises(ConfigError) as exc_info:
            load_config("[s]\nbroken line here\n")
        msg = str(exc_info.value).lower()
        assert "line" in msg or "invalid" in msg or "malformed" in msg, \
            f"error message not informative: {exc_info.value}"
