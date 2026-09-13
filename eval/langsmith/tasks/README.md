# LangSmith Tasks

这个套件当前通过 `BENCH_TASKS_DIR` 复用 `../../local/tasks`。

如果需要不同的任务集，可以在这里添加 LangSmith 专用任务，然后更新 `tests/conftest.py`，让 `BENCH_TASKS_DIR` 指向该目录。
