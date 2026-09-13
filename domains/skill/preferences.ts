import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { parse } from 'yaml';
import type { SkillPreferenceEntry } from './find.js';

export type SkillPreferenceMode = 'advisory' | 'strict';
export type MissingSkillPolicy = 'ask' | 'fail';
export type AmbiguousSkillPolicy = 'ask' | 'fail';
export type DeviationPolicy = 'explain' | 'fail';
export type CapabilityPolicy = 'allow' | 'disclose' | 'deny';

export interface SkillPreferencePolicies {
  missing: MissingSkillPolicy;
  ambiguous: AmbiguousSkillPolicy;
  deviation: DeviationPolicy;
  scripts: CapabilityPolicy;
  hooks: CapabilityPolicy;
}

export interface NormalizedSkillPreferences {
  version: 1;
  mode: SkillPreferenceMode;
  prefer: string[];
  require: string[];
  policies: SkillPreferencePolicies;
}

export type SkillPreferenceWarning =
  | { code: 'duplicate-prefer' | 'duplicate-require'; message: string; skill: string }
  | { code: 'unknown-field'; message: string; field: string };

export interface NormalizedSkillPreferenceDocument {
  preferences: NormalizedSkillPreferences;
  warnings: SkillPreferenceWarning[];
}

export interface ProjectSkillPreferences extends NormalizedSkillPreferenceDocument {
  path: string;
  hash: string;
}

const DEFAULT_POLICIES: SkillPreferencePolicies = {
  missing: 'ask',
  ambiguous: 'ask',
  deviation: 'explain',
  scripts: 'disclose',
  hooks: 'disclose',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertStringArray(value: unknown, file: string, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${file}: ${field} must be a string array`);
  return value.map((item, index) => {
    if (typeof item !== 'string' || item.trim().length === 0) {
      throw new Error(`${file}: ${field}[${index}] must be a non-empty string`);
    }
    return item.trim();
  });
}

function dedupeSkills(
  values: string[],
  code: 'duplicate-prefer' | 'duplicate-require',
  label: 'prefer' | 'require',
  warnings: SkillPreferenceWarning[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      warnings.push({
        code,
        message: `Duplicate ${label} Skill ignored: ${value}`,
        skill: value,
      });
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

function enumValue<T extends string>(
  value: unknown,
  file: string,
  field: string,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${file}: ${field} must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

export function normalizeSkillPreferencesDocument(
  value: unknown,
  file = '.opensuper/skill-preferences.yaml',
): NormalizedSkillPreferenceDocument {
  if (!isRecord(value)) throw new Error(`${file}: document must be an object`);
  if (value.version !== 1) throw new Error(`${file}: version must be 1`);

  const warnings: SkillPreferenceWarning[] = [];
  for (const key of Object.keys(value)) {
    if (!['version', 'mode', 'prefer', 'require', 'policies'].includes(key)) {
      warnings.push({
        code: 'unknown-field',
        message: `Unknown top-level field ignored: ${key}`,
        field: key,
      });
    }
  }

  const mode = enumValue(value.mode, file, 'mode', ['advisory', 'strict'] as const, 'advisory');
  if (value.policies !== undefined && !isRecord(value.policies)) {
    throw new Error(`${file}: policies must be an object`);
  }
  const policiesRecord = value.policies ?? {};
  const policies: SkillPreferencePolicies = {
    missing: enumValue(
      policiesRecord.missing,
      file,
      'policies.missing',
      ['ask', 'fail'] as const,
      DEFAULT_POLICIES.missing,
    ),
    ambiguous: enumValue(
      policiesRecord.ambiguous,
      file,
      'policies.ambiguous',
      ['ask', 'fail'] as const,
      DEFAULT_POLICIES.ambiguous,
    ),
    deviation: enumValue(
      policiesRecord.deviation,
      file,
      'policies.deviation',
      ['explain', 'fail'] as const,
      DEFAULT_POLICIES.deviation,
    ),
    scripts: enumValue(
      policiesRecord.scripts,
      file,
      'policies.scripts',
      ['allow', 'disclose', 'deny'] as const,
      DEFAULT_POLICIES.scripts,
    ),
    hooks: enumValue(
      policiesRecord.hooks,
      file,
      'policies.hooks',
      ['allow', 'disclose', 'deny'] as const,
      DEFAULT_POLICIES.hooks,
    ),
  };

  const prefer = dedupeSkills(
    assertStringArray(value.prefer, file, 'prefer'),
    'duplicate-prefer',
    'prefer',
    warnings,
  );
  const required = dedupeSkills(
    assertStringArray(value.require, file, 'require'),
    'duplicate-require',
    'require',
    warnings,
  );

  return {
    preferences: { version: 1, mode, prefer, require: required, policies },
    warnings,
  };
}

export function skillPreferenceEntries(
  preferences: NormalizedSkillPreferences,
): SkillPreferenceEntry[] {
  const seen = new Set<string>();
  const entries: SkillPreferenceEntry[] = [];
  for (const query of [...preferences.prefer, ...preferences.require]) {
    if (seen.has(query)) continue;
    seen.add(query);
    entries.push({ query, preferenceIndex: entries.length });
  }
  return entries;
}

export function skillPreferencesPath(projectRoot: string): string {
  return path.resolve(projectRoot, '.opensuper', 'skill-preferences.yaml');
}

export async function readProjectSkillPreferences(
  projectRoot: string,
): Promise<ProjectSkillPreferences | null> {
  const file = skillPreferencesPath(projectRoot);
  let source: string;
  try {
    source = await fs.readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }

  const parsed = parse(source) as unknown;
  return {
    path: file,
    hash: createHash('sha256').update(source).digest('hex'),
    ...normalizeSkillPreferencesDocument(parsed, file),
  };
}
