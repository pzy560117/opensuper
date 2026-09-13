import json
from pathlib import Path

from scaffold.python.validation.core import load_test_context, write_test_results


def _package_root(context: dict) -> Path:
    raw = context.get("skill_package_path")
    if not raw:
        return Path(".")
    path = Path(raw)
    return path if path.is_absolute() else Path(".") / path


def _protocol_route(protocol: dict) -> list[str]:
    return [
        str(node.get("id"))
        for node in protocol.get("nodes") or []
        if isinstance(node, dict) and node.get("id") and not node.get("disabled")
    ]


def main():
    context = load_test_context()
    package = _package_root(context)
    expected_nodes = context.get("route_conformance_expected_node_order") or []
    generated_node_skills = context.get("generated_node_skills") or []
    passed = []
    failed = []

    if not expected_nodes:
        failed.append("routeConformance expectedNodeOrder missing")
    else:
        passed.append(f"routeConformance declares {len(expected_nodes)} node(s)")

    protocol_path = package / "reference" / "workflow-protocol.json"
    if not protocol_path.exists():
        failed.append("reference/workflow-protocol.json missing")
        protocol_route = []
    else:
        try:
            protocol_route = _protocol_route(json.loads(protocol_path.read_text(encoding="utf-8")))
            passed.append("workflow-protocol.json parseable")
        except json.JSONDecodeError as exc:
            failed.append(f"workflow-protocol.json invalid: {exc}")
            protocol_route = []

    if expected_nodes and protocol_route == expected_nodes:
        passed.append("workflow protocol route matches expectedNodeOrder")
    elif expected_nodes:
        failed.append(
            f"workflow protocol route mismatch: expected {expected_nodes}, got {protocol_route}"
        )

    eval_manifest = package / "opensuper" / "eval.yaml"
    if not eval_manifest.exists():
        failed.append("opensuper/eval.yaml missing")
    else:
        text = eval_manifest.read_text(encoding="utf-8")
        missing = [
            item
            for item in ["workflow-route-conformance", *expected_nodes, *generated_node_skills]
            if item not in text
        ]
        if missing:
            failed.append(f"opensuper/eval.yaml missing route entries: {', '.join(missing)}")
        else:
            passed.append("opensuper/eval.yaml lists route conformance task and Nodes")

    missing_node_skills = [
        node_skill
        for node_skill in generated_node_skills
        if not (package.parent / node_skill / "SKILL.md").exists()
    ]
    if missing_node_skills:
        failed.append(f"internal Node Skill missing: {', '.join(missing_node_skills)}")
    elif generated_node_skills:
        passed.append("internal Node Skills present")

    write_test_results({"passed": passed, "failed": failed})


if __name__ == "__main__":
    main()
