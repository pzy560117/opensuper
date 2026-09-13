from pathlib import Path

from scaffold.python.validation.core import load_test_context, write_test_results


def _package_root() -> Path:
    context = load_test_context()
    raw = context.get("skill_package_path")
    if raw:
        path = Path(raw)
        return path if path.is_absolute() else Path(".") / path
    return Path(".")


def main():
    passed = []
    failed = []
    package = _package_root()

    if (package / "SKILL.md").exists():
        passed.append("SKILL.md present")
    else:
        failed.append("SKILL.md missing")

    reference = package / "reference"
    if (reference / "resolved-skills.json").exists():
        passed.append("resolved-skills.json present")
    else:
        failed.append("resolved-skills.json missing")

    for name in ("workflow-protocol.json", "authoring-lanes.json", "skill-review.md"):
        if (reference / name).exists():
            passed.append(f"{name} present")
        else:
            failed.append(f"{name} missing")

    engine_root = package / "opensuper"
    if engine_root.exists():
        expected = ("skill.yaml", "guardrails.yaml", "checks.yaml", "eval.yaml")
        missing = [name for name in expected if not (engine_root / name).exists()]
        if missing:
            failed.append(f"Engine package incomplete at {engine_root}: missing {', '.join(missing)}")
        elif (engine_root / "evals.yaml").exists():
            failed.append(f"Legacy evals.yaml present at {engine_root}")
        else:
            passed.append("Engine package files present")
    else:
        passed.append("Engine disabled")

    write_test_results({"passed": passed, "failed": failed})


if __name__ == "__main__":
    main()
