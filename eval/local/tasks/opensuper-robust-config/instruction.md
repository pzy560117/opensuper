You are working on a Python project called "config-loader" - a simple INI-style configuration parser.

Your task: Use the opensuper workflow to **add structured error handling** to `load_config()`.

## The problem

`load_config()` in `config_loader.py` is brittle. On malformed input it either crashes with a cryptic exception or silently misbehaves (overwrites duplicate sections, skips bad lines, drops keys outside sections).

The goal is to make invalid input raise a **clear `ConfigError`** (already defined as the base exception) with an informative message mentioning the line number or nature of the problem.

## Cases to handle (see TestErrorHandling)

1. **Key before any section**: `key = value` before `[section]` → raise ConfigError
2. **Duplicate section**: `[s]` appearing twice → raise ConfigError
3. **Malformed line**: a line that is neither blank/comment/section/key=value → raise ConfigError
4. **Empty section name**: `[]` → raise ConfigError
5. **Informative messages**: error text should mention "line" or "invalid"/"malformed"

## Constraints

- The happy-path tests in `TestHappyPath` must keep passing.
- Raise `ConfigError` (or subclasses) — don't let raw `KeyError`/`ValueError` escape.

## What to do

1. Run tests: `python -m pytest test_config_loader.py -v` (5 error-handling tests fail)
2. Follow the opensuper workflow (Open → Design → Build → Verify → Archive).
3. Confirm all 9 tests pass.

Start by detecting the current phase and following the opensuper workflow. When you reach a decision point that asks for confirmation, assume "yes, proceed with the recommended option".
