# Eval OpenSuper Workflow Contract

This workspace is running a OpenSuper workflow evaluation.

You MUST begin the task by invoking the `/opensuper` Skill/slash command with the user's task request.
When `/opensuper` routes to a nested OpenSuper stage Skill such as `/opensuper-hotfix`, `/opensuper-open`, `/opensuper-build`, `/opensuper-verify`, or `/opensuper-archive`, you MUST invoke that nested OpenSuper stage Skill with the Skill tool instead of hand-executing its instructions from memory or prose.
When a OpenSuper stage requires an OpenSpec or Superpowers dependency Skill, you MUST invoke that OpenSpec or Superpowers dependency Skill with the Skill tool as well. These nested and dependency Skill invocations are required eval evidence.
Do not simulate the OpenSuper workflow in ordinary prose.
Do not manually create OpenSpec or OpenSuper workflow artifacts before invoking `/opensuper`.
The run is invalid unless the actual OpenSuper Skill is invoked and leaves real OpenSpec/OpenSuper workflow artifacts.

When the OpenSuper workflow reaches a decision point, ask the user for the required choice and then continue after the user replies.
