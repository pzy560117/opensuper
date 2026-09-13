import json
import re
from pathlib import Path

import yaml

from scaffold.python.validation.core import load_test_context, write_test_results


HASH_RE = re.compile(r"^[a-f0-9]{64}$")


def _package_root(context: dict) -> Path:
    raw = context.get("skill_package_path")
    if not raw:
        return Path(".")
    path = Path(raw)
    return path if path.is_absolute() else Path(".") / path


def _contains_evidence(actual: list[dict], expected: dict) -> bool:
    return any(
        item.get("node") == expected.get("node")
        and item.get("check") == expected.get("check")
        and (
            "enforcement" not in expected
            or expected.get("enforcement") is None
            or item.get("enforcement") == expected.get("enforcement")
        )
        for item in actual
        if isinstance(item, dict)
    )


def _read_required_text(
    package: Path,
    relative_path: str,
    passed: list[str],
    failed: list[str],
) -> str:
    path = package / relative_path
    if not path.exists():
        failed.append(f"{relative_path} missing")
        return ""
    passed.append(f"{relative_path} present")
    return path.read_text(encoding="utf-8")


def _require_markers(
    text: str,
    relative_path: str,
    markers: list[tuple[str, str]],
    passed: list[str],
    failed: list[str],
) -> None:
    if not text:
        return
    missing = [label for label, marker in markers if marker not in text]
    if missing:
        failed.append(f"{relative_path} missing contract markers: {', '.join(missing)}")
    else:
        passed.append(f"{relative_path} declares required contract markers")


def _check_workflow_protocol(package: Path, passed: list[str], failed: list[str]) -> None:
    protocol_text = _read_required_text(package, "reference/workflow-protocol.json", passed, failed)
    if not protocol_text:
        return
    try:
        protocol = json.loads(protocol_text)
    except json.JSONDecodeError as exc:
        failed.append(f"reference/workflow-protocol.json invalid: {exc}")
        return

    if protocol.get("kind") == "opensuper-five-phase-overlay":
        passed.append("workflow protocol kind is opensuper-five-phase-overlay")
    else:
        failed.append(
            "workflow protocol kind mismatch: expected opensuper-five-phase-overlay, "
            f"got {protocol.get('kind')}"
        )

    nodes = protocol.get("nodes")
    if isinstance(nodes, list) and nodes:
        passed.append(f"workflow protocol declares {len(nodes)} node(s)")
    else:
        failed.append("workflow protocol nodes missing or empty")


def _check_runtime_scripts(package: Path, passed: list[str], failed: list[str]) -> None:
    state = _read_required_text(package, "scripts/workflow-state.mjs", passed, failed)
    _require_markers(
        state,
        "scripts/workflow-state.mjs",
        [
            ("activeOpenSuperChanges", "activeOpenSuperChanges"),
            ("resolveOpenSuperOverlayChange", "resolveOpenSuperOverlayChange"),
            ("sidecar workflow-evidence", "workflow-evidence"),
            ("overlay protocol branch", "isOpenSuperOverlay(protocol)"),
            ("init rejection branch", "command === 'init'"),
            ("/opensuper-open guidance", "/opensuper-open"),
        ],
        passed,
        failed,
    )

    guard = _read_required_text(package, "scripts/workflow-guard.mjs", passed, failed)
    _require_markers(
        guard,
        "scripts/workflow-guard.mjs",
        [
            ("overlay evidence reader", "readOverlayEvidence"),
            ("sidecar workflow-evidence", "workflow-evidence"),
            ("augmentation enforcement", "missing augmentation evidence"),
            ("unchanged OpenSuper state message", "OPENSUPER STATE: unchanged"),
        ],
        passed,
        failed,
    )

    handoff = _read_required_text(package, "scripts/workflow-handoff.mjs", passed, failed)
    _require_markers(
        handoff,
        "scripts/workflow-handoff.mjs",
        [
            ("workflow protocol input", "workflow-protocol.json"),
            ("workflow output field", "workflow: protocol.name"),
            ("protocol nodes output", "protocol.nodes.map"),
            ("required skill calls", "requiredSkillCalls"),
            ("augmentations", "augmentations"),
            ("output schemas", "outputSchemas"),
        ],
        passed,
        failed,
    )


def main():
    context = load_test_context()
    package = _package_root(context)
    passed = []
    failed = []

    _check_workflow_protocol(package, passed, failed)
    _check_runtime_scripts(package, passed, failed)

    manifest_path = package / "opensuper" / "eval.yaml"
    if not manifest_path.exists():
        failed.append("opensuper/eval.yaml missing")
        write_test_results({"passed": passed, "failed": failed})
        return

    try:
        manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8")) or {}
        passed.append("opensuper/eval.yaml parseable")
    except yaml.YAMLError as exc:
        failed.append(f"opensuper/eval.yaml invalid: {exc}")
        write_test_results({"passed": passed, "failed": failed})
        return

    metadata = manifest.get("metadata") or {}
    evaluation = manifest.get("evaluation") or {}

    draft_hash = metadata.get("draftHash") or metadata.get("draft_hash")
    expected_draft_hash = context.get("draft_hash")
    if expected_draft_hash and draft_hash != expected_draft_hash:
        failed.append("metadata.draftHash does not match manifest parser context")
    elif isinstance(draft_hash, str) and HASH_RE.match(draft_hash):
        passed.append("metadata.draftHash is stable sha256 hex")
    else:
        failed.append("metadata.draftHash missing or not 64 hex characters")

    recommended = evaluation.get("recommendedTasks") or []
    required_tasks = [
        "workflow-overlay-contract",
        "opensuper-full-workflow",
        "opensuper-fix-median",
    ]
    missing_tasks = [task for task in required_tasks if task not in recommended]
    if missing_tasks:
        failed.append(f"recommendedTasks missing: {', '.join(missing_tasks)}")
    else:
        passed.append("recommendedTasks includes overlay contract suite")

    baseline_treatments = evaluation.get("baselineTreatments") or []
    expected_baselines = context.get("baseline_treatments") or ["CONTROL", "OPENSUPER_FULL_040_BETA"]
    if baseline_treatments == expected_baselines:
        passed.append("baselineTreatments match expected overlay baselines")
    else:
        failed.append(
            f"baselineTreatments mismatch: expected {expected_baselines}, got {baseline_treatments}"
        )

    gates = evaluation.get("qualityGates") or {}
    expected_gates = context.get("quality_gates") or {
        "minWeightedScore": 0.8,
        "minPassAt1": 0.6,
        "maxInstabilityGap": 0.4,
    }
    if all(gates.get(key) == value for key, value in expected_gates.items()):
        passed.append("qualityGates declare required minimums")
    else:
        failed.append(f"qualityGates mismatch: expected {expected_gates}, got {gates}")

    required_schemas = evaluation.get("requiredOutputSchemas") or []
    expected_schemas = context.get("required_output_schemas") or []
    missing_schemas = [schema for schema in expected_schemas if schema not in required_schemas]
    if missing_schemas:
        failed.append(f"requiredOutputSchemas missing: {', '.join(missing_schemas)}")
    elif not required_schemas:
        failed.append("requiredOutputSchemas empty")
    elif isinstance(required_schemas, list):
        passed.append("requiredOutputSchemas present")
    else:
        failed.append("requiredOutputSchemas is not a list")

    expected_evidence = evaluation.get("expectedEvidence") or []
    context_evidence = context.get("expected_evidence") or []
    missing_evidence = [
        item for item in context_evidence if not _contains_evidence(expected_evidence, item)
    ]
    if missing_evidence:
        failed.append(f"expectedEvidence missing checks: {missing_evidence}")
    elif not expected_evidence:
        failed.append("expectedEvidence empty")
    elif isinstance(expected_evidence, list):
        passed.append("expectedEvidence present")
    else:
        failed.append("expectedEvidence is not a list")

    write_test_results({"passed": passed, "failed": failed})


if __name__ == "__main__":
    main()
