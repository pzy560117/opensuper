from scaffold.python.attribution import classify_failures


def test_classify_failures_marks_missing_skill_without_invocation_as_harness():
    failures = classify_failures(
        ["Required skill not invoked: opensuper"],
        {"skills_invoked": []},
        "generic",
    )

    assert failures == [
        {
            "bucket": "harness",
            "check": "Required skill not invoked: opensuper",
            "reason": "target Skill was never invoked, so workflow quality is not observable",
        }
    ]


def test_classify_failures_marks_state_failures_as_workflow():
    failures = classify_failures(
        ["Expected .opensuper.yaml state transition to advance"],
        {"skills_invoked": ["opensuper"]},
        "opensuper-workflow",
    )

    assert failures[0]["bucket"] == "workflow"
    assert "state or guard" in failures[0]["reason"]


def test_classify_failures_marks_validator_path_issues_as_task():
    failures = classify_failures(
        ["validator artifact path not found in archive"],
        {"skills_invoked": ["opensuper"]},
        "authoring-skill",
    )

    assert failures[0]["bucket"] == "task"


def test_classify_failures_defaults_to_model_when_workflow_observable():
    failures = classify_failures(
        ["Expected package to contain summary section"],
        {"skills_invoked": ["opensuper-any"]},
        "authoring-skill",
    )

    assert failures[0]["bucket"] == "model"
