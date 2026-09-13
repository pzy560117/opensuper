"""Generate paper-style SVG figures for the eval report style demo.

The demo intentionally avoids third-party plotting dependencies so the checked-in
sample can be regenerated in a fresh checkout. The renderer keeps the output
shape close to common ML-paper figures: white background, thin axes, compact
labels, and semantic color only where it carries data meaning.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


CURRENT = "#1F5F8B"
BASELINE = "#9F3D2F"
GOOD = "#28745C"
BAD = "#A33A32"
INK = "#1B1A18"
MUTED = "#66615A"
GRID = "#D8D2C7"
PAPER = "#FFFFFF"
PAPER_FONT = "'Times New Roman', SimSun, 'Songti SC', 'Noto Serif CJK SC', serif"
MONO_FONT = "'Times New Roman', SimSun, 'Songti SC', 'Noto Serif CJK SC', serif"


@dataclass(frozen=True)
class RubricDatum:
    key: str
    zh: str
    en: str
    delta: float


@dataclass(frozen=True)
class TreatmentDatum:
    key: str
    zh: str
    en: str
    tokens_m: float
    cost: float
    rubric: float


@dataclass(frozen=True)
class TaskDatum:
    key: str
    zh: str
    en: str
    current_passed: bool
    baseline_passed: bool


RUBRIC_DATA = [
    RubricDatum("main_flow", "主流程完成", "Main flow", 0.42),
    RubricDatum("gate_guard", "阶段检查", "Gate guard", 0.58),
    RubricDatum("skill_invocation", "Skill 触发", "Skill invocation", 0.36),
    RubricDatum("spec_drift", "需求漂移", "Spec drift", 0.00),
    RubricDatum("completion", "完成度", "Completion", 0.23),
    RubricDatum("efficiency", "效率", "Efficiency", -0.23),
    RubricDatum("decision_point_compliance", "决策点遵循", "Decision points", -0.24),
    RubricDatum("artifact_quality", "产物质量", "Artifact quality", 0.30),
]

TREATMENT_DATA = [
    TreatmentDatum("current", "当前 workflow", "Current workflow", 11.446603, 7.5947, 0.72),
    TreatmentDatum("baseline", "0.3.9 基线", "0.3.9 baseline", 5.550281, 3.9688, 0.54),
]

TASK_DATA = [
    TaskDatum("api-cache-ttl", "API 缓存 TTL", "API cache TTL", True, False),
    TaskDatum("fix-median", "修复 median", "Fix median", True, False),
    TaskDatum("full-workflow", "完整流程", "Full workflow", True, True),
    TaskDatum("perf-dedupe", "性能去重", "Perf dedupe", True, False),
    TaskDatum("refactor-counter", "重构 counter", "Refactor counter", True, True),
    TaskDatum("robust-config", "健壮配置", "Robust config", False, False),
]


def generate_charts(output_dir: Path) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for lang in ("zh", "en"):
        chart_specs = {
            f"rubric_delta.{lang}.svg": _rubric_delta_svg(lang),
            f"quality_cost.{lang}.svg": _quality_cost_svg(lang),
            f"task_outcomes.{lang}.svg": _task_outcomes_svg(lang),
        }
        for filename, svg in chart_specs.items():
            path = output_dir / filename
            path.write_text(svg, encoding="utf-8")
            written.append(path)
    return written


def _rubric_delta_svg(lang: str) -> str:
    zh = lang == "zh"
    title = (
        "图 1. Rubric 维度相对 0.3.9 的变化"
        if zh
        else "Figure 1. Rubric dimension deltas relative to 0.3.9"
    )
    subtitle = (
        "横轴为当前 workflow 减去 0.3.9 基线；右侧为提升，左侧为退步。"
        if zh
        else "X-axis shows current workflow minus 0.3.9 baseline; right is better."
    )
    x0, y0, width, row_gap = 330, 84, 410, 38
    x_min, x_max = -0.3, 0.65
    scale = width / (x_max - x_min)
    zero_x = x0 + (0 - x_min) * scale

    parts = _svg_header(920, 460, title, subtitle)
    for tick in (-0.2, 0.0, 0.2, 0.4, 0.6):
        x = x0 + (tick - x_min) * scale
        klass = "axis" if tick == 0 else "grid"
        parts.append(
            f'<line class="{klass}" x1="{x:.1f}" y1="70" '
            f'x2="{x:.1f}" y2="390" />'
        )
        parts.append(
            f'<text class="tick" x="{x:.1f}" y="420" '
            f'text-anchor="middle">{tick:+.1f}</text>'
        )

    for idx, item in enumerate(RUBRIC_DATA):
        y = y0 + idx * row_gap
        label = item.zh if zh else item.en
        x = x0 + (item.delta - x_min) * scale
        color = CURRENT if item.delta >= 0 else BASELINE
        parts.append(f'<text class="label" x="44" y="{y + 4}">{_escape(label)}</text>')
        parts.append(
            f'<line x1="{zero_x:.1f}" y1="{y}" x2="{x:.1f}" y2="{y}" '
            f'stroke="{color}" stroke-width="3" />'
        )
        parts.append(f'<circle cx="{x:.1f}" cy="{y}" r="5.2" fill="{color}" />')
        parts.append(
            f'<text class="value" x="840" y="{y + 4}" '
            f'text-anchor="end">{item.delta:+.2f}</text>'
        )

    parts.append(_svg_footer())
    return "\n".join(parts)


def _quality_cost_svg(lang: str) -> str:
    zh = lang == "zh"
    title = "图 2. 质量-成本前沿" if zh else "Figure 2. Quality-cost frontier"
    subtitle = (
        "纵轴为 Rubric 平均分，横轴为总 token；点越靠左上越理想。"
        if zh
        else "Y-axis is rubric average, x-axis is total tokens; upper-left is better."
    )
    left, top, width, height = 86, 72, 620, 300
    parts = _svg_header(820, 460, title, subtitle)

    for x_tick in (0, 4, 8, 12):
        x = left + (x_tick / 12) * width
        parts.append(
            f'<line class="grid" x1="{x:.1f}" y1="{top}" '
            f'x2="{x:.1f}" y2="{top + height}" />'
        )
        parts.append(
            f'<text class="tick" x="{x:.1f}" y="402" '
            f'text-anchor="middle">{x_tick}M</text>'
        )
    for y_tick in (0.3, 0.5, 0.7, 0.9):
        y = top + (0.9 - y_tick) / 0.6 * height
        parts.append(
            f'<line class="grid" x1="{left}" y1="{y:.1f}" '
            f'x2="{left + width}" y2="{y:.1f}" />'
        )
        parts.append(
            f'<text class="tick" x="60" y="{y + 4:.1f}" '
            f'text-anchor="end">{y_tick:.1f}</text>'
        )

    parts.append(
        f'<line class="axis" x1="{left}" y1="{top + height}" '
        f'x2="{left + width}" y2="{top + height}" />'
    )
    parts.append(f'<line class="axis" x1="{left}" y1="{top}" x2="{left}" y2="{top + height}" />')

    points = []
    for item in TREATMENT_DATA:
        x = left + (item.tokens_m / 12) * width
        y = top + (0.9 - item.rubric) / 0.6 * height
        points.append((x, y, item))

    parts.append(
        f'<line x1="{points[1][0]:.1f}" y1="{points[1][1]:.1f}" '
        f'x2="{points[0][0]:.1f}" y2="{points[0][1]:.1f}" '
        'stroke="#9B9488" stroke-width="1.5" stroke-dasharray="5 5" />'
    )
    for x, y, item in points:
        color = CURRENT if item.key == "current" else BASELINE
        label = item.zh if zh else item.en
        parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="8" fill="{color}" />')
        if item.key == "current":
            text_x = x - 14
            anchor = "end"
        else:
            text_x = x + 14
            anchor = "start"
        parts.append(
            f'<text class="value" x="{text_x:.1f}" y="{y - 10:.1f}" '
            f'text-anchor="{anchor}">{_escape(label)}</text>'
        )
        parts.append(
            f'<text class="tick" x="{text_x:.1f}" y="{y + 9:.1f}" '
            f'text-anchor="{anchor}">{item.rubric:.2f} / ${item.cost:.2f}</text>'
        )

    x_axis = "总 token" if zh else "Total tokens"
    y_axis = "Rubric 平均分" if zh else "Rubric average"
    parts.append(
        f'<text class="label" x="{left + width / 2:.1f}" y="438" '
        f'text-anchor="middle">{x_axis}</text>'
    )
    y_axis_y = top + height / 2
    parts.append(
        f'<text class="label" x="24" y="{y_axis_y:.1f}" '
        f'transform="rotate(-90 24 {y_axis_y:.1f})" '
        f'text-anchor="middle">{y_axis}</text>'
    )
    parts.append(_svg_footer())
    return "\n".join(parts)


def _task_outcomes_svg(lang: str) -> str:
    zh = lang == "zh"
    title = "图 3. 任务通过矩阵" if zh else "Figure 3. Task outcome matrix"
    subtitle = (
        "绿色表示通过，红色表示失败；矩阵保留任务粒度，适合放在论文附录。"
        if zh
        else "Green means pass and red means fail; task-level granularity fits an appendix figure."
    )
    left, top, cell_w, cell_h, gap = 250, 108, 142, 34, 9
    column_header_y = 86
    parts = _svg_header(640, 430, title, subtitle)
    col_labels = (
        ("当前 workflow", "0.3.9 基线")
        if zh
        else ("Current workflow", "0.3.9 baseline")
    )
    for i, label in enumerate(col_labels):
        x = left + i * (cell_w + 28) + cell_w / 2
        parts.append(
            f'<text class="label" x="{x:.1f}" y="{column_header_y}" '
            f'text-anchor="middle">{_escape(label)}</text>'
        )

    for row, item in enumerate(TASK_DATA):
        y = top + row * (cell_h + gap)
        label = item.zh if zh else item.en
        parts.append(f'<text class="label" x="42" y="{y + 22}" >{_escape(label)}</text>')
        for col, passed in enumerate((item.current_passed, item.baseline_passed)):
            x = left + col * (cell_w + 28)
            color = GOOD if passed else BAD
            status = "通过" if zh and passed else "失败" if zh else "PASS" if passed else "FAIL"
            parts.append(
                f'<rect x="{x}" y="{y}" width="{cell_w}" height="{cell_h}" '
                f'rx="2" fill="{color}" />'
            )
            parts.append(
                f'<text x="{x + cell_w / 2:.1f}" y="{y + 22}" '
                f'text-anchor="middle" fill="#FFFFFF" font-family="{PAPER_FONT}" '
                f'font-size="12" font-weight="700">{status}</text>'
            )

    parts.append(_svg_footer())
    return "\n".join(parts)


def _svg_header(width: int, height: int, title: str, subtitle: str) -> list[str]:
    return [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'role="img" aria-label="{_escape(title)}">',
        "<style>",
        f"text {{ font-family: {PAPER_FONT}; }}",
        ".title { fill: #1B1A18; font-size: 18px; font-weight: 700; }",
        ".subtitle, .tick { fill: #66615A; font-size: 12px; }",
        ".label { fill: #1B1A18; font-size: 13px; }",
        f".value {{ fill: #1B1A18; font-size: 12px; font-family: {MONO_FONT}; }}",
        f".grid {{ stroke: {GRID}; stroke-width: 1; shape-rendering: crispEdges; }}",
        f".axis {{ stroke: {INK}; stroke-width: 1; shape-rendering: crispEdges; }}",
        "</style>",
        f'<rect width="{width}" height="{height}" fill="{PAPER}" />',
        f'<text class="title" x="32" y="32">{_escape(title)}</text>',
        f'<text class="subtitle" x="32" y="54">{_escape(subtitle)}</text>',
    ]


def _svg_footer() -> str:
    return "</svg>"


def _escape(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def main(argv: Iterable[str] | None = None) -> int:
    args = list(argv or [])
    output_dir = (
        Path(args[0])
        if args
        else Path(__file__).resolve().parents[1] / "report-style-demo-assets"
    )
    written = generate_charts(output_dir)
    for path in written:
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
