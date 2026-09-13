"""Evaluation profile registry for local and LangSmith suites."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from scaffold.python.tasks import InteractionConfig, Task
from scaffold.python.validation.core import ValidatorFn
from scaffold.python.validation.generic_rubric import (
    GENERIC_RUBRIC_DIMENSIONS,
    generic_rubric_validator,
)
from scaffold.python.validation.authoring_rubric import (
    AUTHORING_RUBRIC_DIMENSIONS,
    authoring_skill_rubric_validator,
)

GENERIC_PROFILE = "generic"
OPENSUPER_WORKFLOW_PROFILE = "opensuper-workflow"
AUTHORING_SKILL_PROFILE = "authoring-skill"

OPENSUPER_SIMULATOR_PROMPT = (
    "You are simulating a developer user in an automated eval. The AI assistant "
    "below is running the OpenSuper development workflow and has paused to ask you "
    "something. Read its message and reply with a SHORT (1-3 sentences) response "
    "that approves reasonable plans, picks sensible defaults, and only asks for "
    "clarification when the requested outcome is unclear."
)

GENERIC_SIMULATOR_PROMPT = (
    "You are simulating a concise developer user in an automated eval. Answer "
    "the assistant's question in 1-3 sentences, choose reasonable defaults, and "
    "keep the task moving."
)


@dataclass(frozen=True)
class ProfileSpec:
    name: str
    rubric_dimensions: tuple[str, ...]
    default_interaction: InteractionConfig
    rubric: ValidatorFn


def _build_profiles() -> dict[str, ProfileSpec]:
    from scaffold.python.validation.rubric import RUBRIC_DIMENSIONS, opensuper_rubric_validator

    return {
        GENERIC_PROFILE: ProfileSpec(
            name=GENERIC_PROFILE,
            rubric_dimensions=GENERIC_RUBRIC_DIMENSIONS,
            default_interaction=InteractionConfig(
                mode="none",
                max_turns=12,
                simulator_prompt=GENERIC_SIMULATOR_PROMPT,
            ),
            rubric=generic_rubric_validator,
        ),
        OPENSUPER_WORKFLOW_PROFILE: ProfileSpec(
            name=OPENSUPER_WORKFLOW_PROFILE,
            rubric_dimensions=tuple(RUBRIC_DIMENSIONS),
            default_interaction=InteractionConfig(
                mode="auto_user",
                max_turns=12,
                simulator_prompt=OPENSUPER_SIMULATOR_PROMPT,
            ),
            rubric=opensuper_rubric_validator,
        ),
        AUTHORING_SKILL_PROFILE: ProfileSpec(
            name=AUTHORING_SKILL_PROFILE,
            rubric_dimensions=AUTHORING_RUBRIC_DIMENSIONS,
            default_interaction=InteractionConfig(
                mode="auto_user",
                max_turns=8,
                simulator_prompt=GENERIC_SIMULATOR_PROMPT,
            ),
            rubric=authoring_skill_rubric_validator,
        ),
    }


def list_profiles() -> list[str]:
    return sorted(_build_profiles())


def get_profile(name: str) -> ProfileSpec:
    profiles = _build_profiles()
    if name not in profiles:
        raise KeyError(f"Profile not found: {name}. Available: {list_profiles()}")
    return profiles[name]


def resolve_profile_name(
    task: Task,
    override: str | None = None,
    target_profile: str | None = None,
) -> str:
    if override:
        get_profile(override)
        return override
    if target_profile:
        get_profile(target_profile)
        return target_profile
    if task.config.evaluation.profile:
        get_profile(task.config.evaluation.profile)
        return task.config.evaluation.profile
    return GENERIC_PROFILE


def run_profile_rubric(
    profile_name: str,
    test_dir: Path,
    outputs: dict[str, Any],
) -> tuple[list[str], list[str]]:
    profile = get_profile(profile_name)
    return profile.rubric(test_dir, outputs)


def all_rubric_dimensions() -> tuple[str, ...]:
    seen: list[str] = []
    for profile in _build_profiles().values():
        for dim in profile.rubric_dimensions:
            if dim not in seen:
                seen.append(dim)
    return tuple(seen)
