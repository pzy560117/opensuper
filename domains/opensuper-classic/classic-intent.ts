export const OPENSUPER_INTENT_SCHEMA_VERSION = 'opensuper.intent.v1' as const;
export const OPENSUPER_INTENT_CONFIDENCE_THRESHOLD = 0.7;

const INTENT_NAMES = [
  'start_change',
  'resume_change',
  'fix_bug',
  'make_tweak',
  'ask_question',
  'unknown',
] as const;
const ENTITY_TYPES = [
  'change_id',
  'workflow',
  'file_path',
  'command',
  'capability',
  'bug_signal',
  'risk_signal',
] as const;
const REQUESTED_ACTIONS = [
  'start',
  'resume',
  'continue',
  'fix',
  'modify',
  'create',
  'verify',
  'archive',
  'question',
  'unknown',
] as const;
const WORKFLOWS = ['full', 'hotfix', 'tweak'] as const;
const SCOPES = ['small', 'medium', 'large', 'unknown'] as const;
const ROUTES = ['full', 'hotfix', 'tweak', 'resume', 'ask_user', 'out_of_scope'] as const;
const NEXT_SKILLS = [
  'opensuper-open',
  'opensuper-hotfix',
  'opensuper-tweak',
  'opensuper-design',
  'opensuper-build',
  'opensuper-verify',
  'opensuper-archive',
] as const;
const EVIDENCE_SOURCES = ['user', 'repo', 'state'] as const;

type ValueOf<T extends readonly string[]> = T[number];

export type OpenSuperIntentName = ValueOf<typeof INTENT_NAMES>;
export type OpenSuperIntentEntityType = ValueOf<typeof ENTITY_TYPES>;
export type OpenSuperIntentRequestedAction = ValueOf<typeof REQUESTED_ACTIONS>;
export type OpenSuperIntentWorkflow = ValueOf<typeof WORKFLOWS>;
export type OpenSuperIntentScope = ValueOf<typeof SCOPES>;
export type OpenSuperIntentRouteName = ValueOf<typeof ROUTES>;
export type OpenSuperIntentNextSkill = ValueOf<typeof NEXT_SKILLS>;
export type OpenSuperIntentEvidenceSource = ValueOf<typeof EVIDENCE_SOURCES>;

export interface OpenSuperIntentFrame {
  schema_version: typeof OPENSUPER_INTENT_SCHEMA_VERSION;
  utterance: string;
  locale: string;
  intent: { name: OpenSuperIntentName; confidence: number };
  entities: Array<{ type: OpenSuperIntentEntityType; value: string; text: string }>;
  slots: {
    requested_action: OpenSuperIntentRequestedAction;
    workflow_candidate: OpenSuperIntentWorkflow | null;
    user_explicit_workflow: OpenSuperIntentWorkflow | null;
    change_id: string | null;
    target_area: string | null;
    scope: OpenSuperIntentScope;
    existing_behavior: boolean | null;
    new_capability: boolean | null;
    public_api_change: boolean | null;
    schema_change: boolean | null;
    cross_module_change: boolean | null;
  };
  context: {
    active_changes_count: number;
    active_change_names: string[];
    dirty_worktree: boolean | null;
  };
  evidence: Array<{ field: string; quote: string; source: OpenSuperIntentEvidenceSource }>;
  proposed_route: OpenSuperIntentRoute;
}

export interface OpenSuperIntentNormalizedFrame extends OpenSuperIntentFrame {
  route: OpenSuperIntentRoute;
}

export interface OpenSuperIntentRoute {
  name: OpenSuperIntentRouteName;
  next_skill: OpenSuperIntentNextSkill | null;
  confidence: number;
  requires_confirmation: boolean;
  fallback_reason: string | null;
}

export interface OpenSuperIntentRouteResolution {
  route: OpenSuperIntentRoute;
  diagnostics: string[];
  normalizedFrame: OpenSuperIntentNormalizedFrame;
}

export class OpenSuperIntentValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid OpenSuperIntentFrame:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function enumValue<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string,
  issues: string[],
): ValueOf<T> | null {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    issues.push(`${field} must be one of: ${allowed.join(', ')}`);
    return null;
  }
  return value as ValueOf<T>;
}

function optionalEnumValue<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string,
  issues: string[],
): ValueOf<T> | null {
  if (value === null || value === undefined) return null;
  return enumValue(value, allowed, field, issues);
}

function stringValue(value: unknown, field: string, issues: string[]): string {
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push(`${field} must be a non-empty string`);
    return '';
  }
  return value;
}

function optionalStringValue(value: unknown, field: string, issues: string[]): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push(`${field} must be a non-empty string or null`);
    return null;
  }
  return value;
}

function optionalBooleanValue(value: unknown, field: string, issues: string[]): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'boolean') {
    issues.push(`${field} must be boolean or null`);
    return null;
  }
  return value;
}

function confidenceValue(value: unknown, field: string, issues: string[]): number {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
    issues.push(`${field} must be a number between 0 and 1`);
    return 0;
  }
  return value;
}

function nonNegativeIntegerValue(value: unknown, field: string, issues: string[]): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    issues.push(`${field} must be a non-negative integer`);
    return 0;
  }

  return value;
}

function validateFrame(input: unknown): OpenSuperIntentFrame {
  const issues: string[] = [];
  if (!isRecord(input)) throw new OpenSuperIntentValidationError(['frame must be an object']);

  const intent = isRecord(input.intent) ? input.intent : {};
  if (!isRecord(input.intent)) issues.push('intent must be an object');
  const slots = isRecord(input.slots) ? input.slots : {};
  if (!isRecord(input.slots)) issues.push('slots must be an object');
  const context = isRecord(input.context) ? input.context : {};
  if (!isRecord(input.context)) issues.push('context must be an object');
  const proposedRouteInput = isRecord(input.proposed_route) ? input.proposed_route : {};
  if (!isRecord(input.proposed_route)) issues.push('proposed_route must be an object');

  const entities =
    input.entities === undefined ? [] : Array.isArray(input.entities) ? input.entities : [];
  if (input.entities !== undefined && !Array.isArray(input.entities)) {
    issues.push('entities must be an array');
  }
  const evidence = Array.isArray(input.evidence) ? input.evidence : [];
  if (!Array.isArray(input.evidence)) issues.push('evidence must be an array');

  const frame: OpenSuperIntentFrame = {
    schema_version: enumValue(
      input.schema_version,
      [OPENSUPER_INTENT_SCHEMA_VERSION] as const,
      'schema_version',
      issues,
    ) as typeof OPENSUPER_INTENT_SCHEMA_VERSION,
    utterance: stringValue(input.utterance, 'utterance', issues),
    locale: input.locale === undefined ? 'unknown' : stringValue(input.locale, 'locale', issues),
    intent: {
      name: enumValue(intent.name, INTENT_NAMES, 'intent.name', issues) ?? 'unknown',
      confidence: confidenceValue(intent.confidence, 'intent.confidence', issues),
    },
    entities: entities.map((entity, index) => {
      const record = isRecord(entity) ? entity : {};
      if (!isRecord(entity)) issues.push(`entities[${index}] must be an object`);
      return {
        type:
          enumValue(record.type, ENTITY_TYPES, `entities[${index}].type`, issues) ?? 'risk_signal',
        value: stringValue(record.value, `entities[${index}].value`, issues),
        text: stringValue(record.text, `entities[${index}].text`, issues),
      };
    }),
    slots: {
      requested_action:
        enumValue(slots.requested_action, REQUESTED_ACTIONS, 'slots.requested_action', issues) ??
        'unknown',
      workflow_candidate: optionalEnumValue(
        slots.workflow_candidate,
        WORKFLOWS,
        'slots.workflow_candidate',
        issues,
      ),
      user_explicit_workflow: optionalEnumValue(
        slots.user_explicit_workflow,
        WORKFLOWS,
        'slots.user_explicit_workflow',
        issues,
      ),
      change_id: optionalStringValue(slots.change_id, 'slots.change_id', issues),
      target_area: optionalStringValue(slots.target_area, 'slots.target_area', issues),
      scope:
        slots.scope === undefined
          ? 'unknown'
          : (enumValue(slots.scope, SCOPES, 'slots.scope', issues) ?? 'unknown'),
      existing_behavior: optionalBooleanValue(
        slots.existing_behavior,
        'slots.existing_behavior',
        issues,
      ),
      new_capability: optionalBooleanValue(slots.new_capability, 'slots.new_capability', issues),
      public_api_change: optionalBooleanValue(
        slots.public_api_change,
        'slots.public_api_change',
        issues,
      ),
      schema_change: optionalBooleanValue(slots.schema_change, 'slots.schema_change', issues),
      cross_module_change: optionalBooleanValue(
        slots.cross_module_change,
        'slots.cross_module_change',
        issues,
      ),
    },
    context: {
      active_changes_count: nonNegativeIntegerValue(
        context.active_changes_count,
        'context.active_changes_count',
        issues,
      ),
      active_change_names: isRecord(context)
        ? (() => {
            if (!Array.isArray(context.active_change_names)) {
              issues.push('context.active_change_names must be an array');
              return [];
            }

            if (!context.active_change_names.every((value) => typeof value === 'string')) {
              issues.push('context.active_change_names must only contain strings');
              return [];
            }

            return context.active_change_names;
          })()
        : [],
      dirty_worktree: optionalBooleanValue(
        context.dirty_worktree,
        'context.dirty_worktree',
        issues,
      ),
    },
    evidence: evidence.map((item, index) => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) issues.push(`evidence[${index}] must be an object`);
      return {
        field: stringValue(record.field, `evidence[${index}].field`, issues),
        quote: stringValue(record.quote, `evidence[${index}].quote`, issues),
        source:
          enumValue(record.source, EVIDENCE_SOURCES, `evidence[${index}].source`, issues) ?? 'user',
      };
    }),
    proposed_route: {
      name: enumValue(proposedRouteInput.name, ROUTES, 'proposed_route.name', issues) ?? 'ask_user',
      next_skill: optionalEnumValue(
        proposedRouteInput.next_skill,
        NEXT_SKILLS,
        'proposed_route.next_skill',
        issues,
      ),
      confidence: confidenceValue(
        proposedRouteInput.confidence,
        'proposed_route.confidence',
        issues,
      ),
      requires_confirmation:
        typeof proposedRouteInput.requires_confirmation === 'boolean'
          ? proposedRouteInput.requires_confirmation
          : true,
      fallback_reason: optionalStringValue(
        proposedRouteInput.fallback_reason,
        'proposed_route.fallback_reason',
        issues,
      ),
    },
  };

  if (issues.length > 0) throw new OpenSuperIntentValidationError(issues);
  return frame;
}

function hasEvidence(frame: OpenSuperIntentFrame, field: string): boolean {
  return frame.evidence.some((item) => item.field === field && item.quote.trim() !== '');
}

function hasRiskSignal(frame: OpenSuperIntentFrame): boolean {
  return (
    frame.slots.new_capability === true ||
    frame.slots.public_api_change === true ||
    frame.slots.schema_change === true ||
    frame.slots.cross_module_change === true
  );
}

function route(
  name: OpenSuperIntentRouteName,
  confidence: number,
  fallback_reason: string | null = null,
): OpenSuperIntentRoute {
  const nextSkill: Record<OpenSuperIntentRouteName, OpenSuperIntentNextSkill | null> = {
    full: 'opensuper-open',
    hotfix: 'opensuper-hotfix',
    tweak: 'opensuper-tweak',
    resume: null,
    ask_user: null,
    out_of_scope: null,
  };
  return {
    name,
    next_skill: nextSkill[name],
    confidence,
    requires_confirmation: name === 'ask_user' || name === 'out_of_scope',
    fallback_reason,
  };
}

function askUser(reason: string): OpenSuperIntentRoute {
  return route('ask_user', 0.5, reason);
}

function workflowRoute(
  workflow: OpenSuperIntentWorkflow,
  confidence: number,
): OpenSuperIntentRoute {
  return route(workflow, confidence);
}

export function resolveOpenSuperIntentRoute(input: unknown): OpenSuperIntentRouteResolution {
  const frame = validateFrame(input);
  const diagnostics: string[] = [];
  const confidence = frame.intent.confidence;

  let resolved: OpenSuperIntentRoute;
  if (frame.intent.confidence < OPENSUPER_INTENT_CONFIDENCE_THRESHOLD) {
    resolved = askUser(
      `intent confidence ${frame.intent.confidence} is below ${OPENSUPER_INTENT_CONFIDENCE_THRESHOLD}`,
    );
  } else if (
    (frame.intent.name === 'resume_change' ||
      frame.slots.requested_action === 'resume' ||
      frame.slots.requested_action === 'continue') &&
    !frame.slots.change_id &&
    frame.context.active_changes_count > 1
  ) {
    resolved = askUser('multiple active changes require an explicit change_id');
  } else if (
    (frame.intent.name === 'resume_change' ||
      frame.slots.requested_action === 'resume' ||
      frame.slots.requested_action === 'continue') &&
    frame.slots.change_id
  ) {
    resolved = frame.context.active_change_names.includes(frame.slots.change_id)
      ? route('resume', confidence)
      : askUser(`change_id '${frame.slots.change_id}' is not in active_change_names`);
  } else if (frame.intent.name === 'ask_question' || frame.slots.requested_action === 'question') {
    resolved = route(
      'out_of_scope',
      confidence,
      'user asked a question without requesting a OpenSuper workflow',
    );
  } else if (
    frame.slots.user_explicit_workflow &&
    frame.slots.user_explicit_workflow !== 'full' &&
    hasRiskSignal(frame)
  ) {
    resolved = askUser(
      `explicit workflow '${frame.slots.user_explicit_workflow}' conflicts with risk signals`,
    );
  } else if (frame.slots.user_explicit_workflow) {
    resolved = workflowRoute(frame.slots.user_explicit_workflow, confidence);
  } else if (hasRiskSignal(frame)) {
    resolved = route('full', confidence);
  } else if (
    frame.intent.name === 'fix_bug' &&
    frame.slots.existing_behavior === true &&
    hasEvidence(frame, 'slots.workflow_candidate')
  ) {
    resolved = route('hotfix', confidence);
  } else if (
    frame.intent.name === 'make_tweak' &&
    frame.slots.workflow_candidate === 'tweak' &&
    hasEvidence(frame, 'slots.workflow_candidate')
  ) {
    resolved = route('tweak', confidence);
  } else if (frame.slots.workflow_candidate && hasEvidence(frame, 'slots.workflow_candidate')) {
    resolved = workflowRoute(frame.slots.workflow_candidate, confidence);
  } else {
    resolved = askUser('workflow_candidate evidence is missing or route is ambiguous');
  }

  if (resolved.name !== frame.proposed_route.name) {
    diagnostics.push(
      `agent proposed_route '${frame.proposed_route.name}' normalized to '${resolved.name}'`,
    );
  }
  if (resolved.next_skill !== frame.proposed_route.next_skill) {
    diagnostics.push(
      `agent proposed_route next_skill '${frame.proposed_route.next_skill}' normalized to '${resolved.next_skill}'`,
    );
  }
  if (resolved.requires_confirmation !== frame.proposed_route.requires_confirmation) {
    diagnostics.push(
      `agent proposed_route requires_confirmation '${frame.proposed_route.requires_confirmation}' normalized to '${resolved.requires_confirmation}'`,
    );
  }
  if (resolved.fallback_reason !== frame.proposed_route.fallback_reason) {
    diagnostics.push(
      `agent proposed_route fallback_reason '${frame.proposed_route.fallback_reason}' normalized to '${resolved.fallback_reason}'`,
    );
  }

  return {
    route: resolved,
    diagnostics,
    normalizedFrame: { ...frame, route: resolved },
  };
}
