from pathlib import Path
import re

from local.scripts.generate_report_style_demo_charts import generate_charts


def test_generate_report_style_demo_charts_writes_bilingual_svgs(tmp_path: Path):
    written = generate_charts(tmp_path)

    expected = {
        "rubric_delta.zh.svg",
        "rubric_delta.en.svg",
        "quality_cost.zh.svg",
        "quality_cost.en.svg",
        "task_outcomes.zh.svg",
        "task_outcomes.en.svg",
    }
    assert {path.name for path in written} == expected

    zh_rubric = (tmp_path / "rubric_delta.zh.svg").read_text(encoding="utf-8")
    en_rubric = (tmp_path / "rubric_delta.en.svg").read_text(encoding="utf-8")
    assert "图 1. Rubric 维度相对 0.3.9 的变化" in zh_rubric
    assert "Figure 1. Rubric dimension deltas relative to 0.3.9" in en_rubric
    assert "Times New Roman" in zh_rubric
    assert "SimSun" in zh_rubric

    circle_x_values = [
        float(match)
        for match in re.findall(r"<circle cx=\"([0-9.]+)\" cy=\"[0-9.]+\" r=\"5.2\"", zh_rubric)
    ]
    assert circle_x_values
    assert max(circle_x_values) < 760
    assert '<text class="value" x="840"' in zh_rubric

    zh_outcomes = (tmp_path / "task_outcomes.zh.svg").read_text(encoding="utf-8")
    subtitle_y = int(re.search(r'<text class="subtitle" x="32" y="([0-9]+)"', zh_outcomes).group(1))
    column_header_y_values = [
        int(match)
        for match in re.findall(
            r'<text class="label" x="[0-9.]+" y="([0-9]+)" text-anchor="middle">',
            zh_outcomes,
        )
    ]
    assert column_header_y_values
    assert min(column_header_y_values) - subtitle_y >= 28
