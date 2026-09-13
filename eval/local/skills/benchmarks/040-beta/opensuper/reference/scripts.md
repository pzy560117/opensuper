# 脚本定位与命令

规范路径：`opensuper/reference/scripts.md`

本文件是 OpenSuper 脚本定位和 state/guard/handoff/archive 命令面的单一事实来源。每会话加载一次，然后复用缓存的环境变量。

## 引导（每会话运行一次）

OpenSuper 脚本随 skill 包分发在 `opensuper/scripts/` 下。**不硬编码路径** — 定位一次，缓存到环境变量。子 Skill 可以直接引用本节，只有需要完全自包含执行时才内联此块；修改时以本文件为单一事实源：

```bash
OPENSUPER_ENV="${OPENSUPER_ENV:-$(find . "$HOME"/.*/skills "$HOME/.config" "$HOME/.gemini" -path '*/opensuper/scripts/opensuper-env.mjs' -type f -print -quit 2>/dev/null)}"
if [ -z "$OPENSUPER_ENV" ]; then
  echo "ERROR: opensuper-env.mjs not found. Ensure the opensuper skill is installed." >&2
  return 1
fi
OPENSUPER_SCRIPTS_DIR="$(node "$OPENSUPER_ENV")"
OPENSUPER_STATE="$OPENSUPER_SCRIPTS_DIR/opensuper-state.mjs"
OPENSUPER_GUARD="$OPENSUPER_SCRIPTS_DIR/opensuper-guard.mjs"
OPENSUPER_HANDOFF="$OPENSUPER_SCRIPTS_DIR/opensuper-handoff.mjs"
OPENSUPER_ARCHIVE="$OPENSUPER_SCRIPTS_DIR/opensuper-archive.mjs"
OPENSUPER_INTENT="$OPENSUPER_SCRIPTS_DIR/opensuper-intent.mjs"

# 脚本定位失败时停止流程
if [ -z "$OPENSUPER_SCRIPTS_DIR" ]; then
  echo "ERROR: OpenSuper scripts not found. Ensure the opensuper skill is installed." >&2
  return 1
fi
```

加载 opensuper 后，agent 应执行以上变量赋值一次，后续全程复用 `$OPENSUPER_GUARD`、`$OPENSUPER_STATE`、`$OPENSUPER_HANDOFF`、`$OPENSUPER_ARCHIVE`、`$OPENSUPER_INTENT`。

## 自动状态更新

guard 支持 `--apply` 参数，验证通过后自动更新 `.opensuper.yaml` 状态字段：

```bash
node "$OPENSUPER_GUARD" <change-name> <phase> --apply
```

`--apply` 内部委托给 `opensuper-state transition`。需要直接表达状态事件时使用：

```bash
node "$OPENSUPER_STATE" transition <change-name> open-complete
node "$OPENSUPER_STATE" transition <change-name> design-complete
node "$OPENSUPER_STATE" transition <change-name> build-complete
node "$OPENSUPER_STATE" transition <change-name> verify-pass
node "$OPENSUPER_STATE" transition <change-name> verify-fail
```

归档完成由 `node "$OPENSUPER_ARCHIVE" <change-name>` 负责；OpenSpec 会把 change 移到带日期前缀的归档目录，不要手动 transition 一个 `<archive-name>`。

## 解析下一步

阶段守卫推进 phase 后，用 `next` 子命令解析是否自动调用下一个 skill：

```bash
node "$OPENSUPER_STATE" next <change-name>
```

输出 `NEXT: auto|manual|done` + `SKILL: <skill-name>`（`done` 时省略）+ `HINT`（仅 `manual` 时）。`auto_transition: false` 时输出 `manual`，只暂停下一 skill 调用，不影响已发生的 phase 推进。

## 归档脚本

一键完成归档全部步骤：

```bash
node "$OPENSUPER_ARCHIVE" <change-name>
```
