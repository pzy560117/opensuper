# OpenSuper Skill Evaluation

Benchmarks for evaluating the OpenSuper skill workflow.

## Structure

```text
scaffold/             # Shared Python runner, Docker helpers, loaders, validators
local/                # Local suite: task corpus, treatments, skills, tests, logs
langsmith/            # LangSmith suite entrypoint and logs
```

The LangSmith suite intentionally reuses `local/tasks`, `local/treatments`, and
`local/skills` through environment path overrides. Keep shared runtime code in
`scaffold/`; add suite-specific behavior under `local/` or `langsmith/`.

## Running Local Eval

```bash
uv run pytest local/tests/tasks/test_tasks.py --task=opensuper-hotfix --treatment=OPENSUPER_FULL_040_BETA -v
uv run pytest local/tests/tasks/test_tasks.py --task=opensuper-full-workflow --treatment=CONTROL,OPENSUPER_FULL_040_BETA -v
uv run pytest local/tests/tasks/test_tasks.py -v
```

Local logs are written to `local/logs/experiments/`.

## Running LangSmith Eval

```bash
uv run pytest langsmith/tests/tasks/test_tasks.py --task=opensuper-hotfix --treatment=OPENSUPER_FULL_040_BETA -v
```

LangSmith runs require `LANGSMITH_API_KEY` and write local reports to
`langsmith/logs/experiments/`.

## Adding Tasks

For the default corpus, add tasks under `local/tasks/` and update
`local/tasks/index.yaml`. Add task-specific prompt, Docker environment, and
validation script together.

If a task should be LangSmith-only, create a dedicated `langsmith/tasks/` corpus
and set `BENCH_TASKS_DIR` in `langsmith/tests/conftest.py` accordingly.
