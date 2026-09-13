---
name: opensuper
description: 'OpenSuper workflow entry. Use when the user invokes /opensuper or asks to use OpenSuper without choosing Native or Classic; load Native or Classic from project configuration.'
---

# OpenSuper Entry

`/opensuper` selects Native or Classic from project configuration, then passes the request to that workflow's Skill.

Once this Skill is loaded, immediately follow the steps below. The user has already chosen OpenSuper: continue their request without reconsidering whether to use it or merely explaining why you would not proceed.

1. Run the OpenSuper CLI installed on PATH in the current project:

   ```text
   opensuper workflow resolve . --activate --json
   ```

   If the project has no `.opensuper/config.yaml`, this command saves the global defaults in the project and creates the configured artifact directories. Later changes to global defaults do not overwrite this project's saved configuration.

   On `command not found`, `executable not found`, or `ENOENT`, stop and report an incomplete OpenSuper CLI installation. Do not search for Skill files, scan platform configuration directories, or invoke an internal bundle directly.

   If the CLI starts but exits nonzero, cannot parse the configuration, or returns invalid JSON or fields, preserve the original error and stop. Do not choose another entry yourself.

2. Parse the JSON. Only accept `schema: opensuper.workflow-resolution.v1` and one of the two `skill` values below.
3. Immediately use the Skill tool to load the entry named by `skill`. Load exactly one entry:
   - `/opensuper-native` → **Execute immediately:** Use the Skill tool to load the `opensuper-native` skill. Do not skip this step.
   - `/opensuper-classic` → **Execute immediately:** Use the Skill tool to load the `opensuper-classic` skill. Do not skip this step.

   Pass the user's original request unchanged to that Skill.

After workflow selection, the selected Skill locates the change's workspace and current phase, then loads task context, personal memory, and project knowledge; use `opensuper memory context` when needed.

Load context as needed. First use `opensuper task ... --json` to obtain a Context Manifest containing only summaries, reasons for recommending each item, and stable IDs. Add `--expand-context "<id>"` when the step needs the full text, source, or verification method.

After using an item and establishing its outcome, report the actual result with its returned application ID: `--application "<application-id>" --outcome used-successfully|ignored|overridden|corrected|contributed-to-failure`. Do not report successful use of an item that was not used.

Do not switch workflows based on task size, file count, active changes, or model judgment. Native and Classic manage their own changes, state, and artifacts.
