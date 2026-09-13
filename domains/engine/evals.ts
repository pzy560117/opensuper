import type { EvalResult, RunState } from './types.js';
import type { RuntimeEvalDefinition } from '../skill/types.js';

export function evaluateRuntime(
  definitions: RuntimeEvalDefinition[],
  scope: RuntimeEvalDefinition['scope'],
  state: RunState,
  artifacts: Record<string, string>,
): EvalResult[] {
  return definitions
    .filter((definition) => definition.scope === scope)
    .map((definition) => {
      if (definition.type === 'artifact_exists') {
        const value = definition.artifact ? artifacts[definition.artifact] : undefined;
        return {
          evalId: definition.id,
          passed: Boolean(value),
          evidence: value
            ? `artifact ${definition.artifact} -> ${value}`
            : `artifact ${definition.artifact ?? '(missing)'} not found`,
        };
      }
      const value = definition.field
        ? (state as unknown as Record<string, unknown>)[definition.field]
        : undefined;
      return {
        evalId: definition.id,
        passed: String(value) === definition.equals,
        evidence: `state.${definition.field ?? '(missing)'} = ${String(value)}`,
      };
    });
}
