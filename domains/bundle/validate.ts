import { promises as fs } from 'fs';
import path from 'path';
import { parse } from 'yaml';
import type { BundleHookDefinition, BundleManifest, NormalizedHook, SkillBundle } from './types.js';
import { loadSkillPackage } from '../skill/load.js';
import { validateSkillPackage } from '../skill/validate.js';

type YamlObject = Record<string, unknown>;

const HOOK_EVENTS = [
  'session_start',
  'before_tool',
  'after_tool',
  'before_write',
  'after_write',
] as const;
const HOOK_FAILURES = ['block', 'warn'] as const;
const INLINE_HOOK_FIELDS = ['command', 'shell', 'run'] as const;

interface DeclaredPath {
  field: string;
  relative: string;
  directory: boolean;
}

function isObject(value: unknown): value is YamlObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function posixPath(value: string): string {
  return value.replaceAll('\\', '/');
}

function isEscapingPath(value: string): boolean {
  const portable = posixPath(value);
  if (portable.split('/').includes('..')) return true;
  const normalized = path.posix.normalize(portable);
  return normalized === '..' || normalized.startsWith('../');
}

function isAbsolutePath(value: string): boolean {
  return (
    path.isAbsolute(value) ||
    path.posix.isAbsolute(posixPath(value)) ||
    path.win32.isAbsolute(value)
  );
}

function insideRoot(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function declaredPaths(manifest: BundleManifest): DeclaredPath[] {
  return [
    ...manifest.skills.map((skill, index) => ({
      field: `skills[${index}].path`,
      relative: skill.path,
      directory: true,
    })),
    ...manifest.resources.rules.map((rule, index) => ({
      field: `resources.rules[${index}].path`,
      relative: rule.path,
      directory: false,
    })),
    ...manifest.resources.hooks.map((hook, index) => ({
      field: `resources.hooks[${index}].path`,
      relative: hook.path,
      directory: false,
    })),
    ...manifest.resources.references.map((reference, index) => ({
      field: `resources.references[${index}]`,
      relative: reference,
      directory: false,
    })),
    ...manifest.resources.scripts.map((script, index) => ({
      field: `resources.scripts[${index}].path`,
      relative: script.path,
      directory: false,
    })),
    ...manifest.resources.assets.map((asset, index) => ({
      field: `resources.assets[${index}]`,
      relative: asset,
      directory: false,
    })),
    ...manifest.resources.agents.map((agent, index) => ({
      field: `resources.agents[${index}].path`,
      relative: agent.path,
      directory: false,
    })),
    ...manifest.platforms.overrides.map((override, index) => ({
      field: `platforms.overrides[${index}].path`,
      relative: override.path,
      directory: false,
    })),
    ...(manifest.engine.enabled
      ? [
          {
            field: 'engine.path',
            relative: manifest.engine.path ?? 'engine',
            directory: true,
          },
        ]
      : []),
  ];
}

async function collectSymbolicLinks(
  root: string,
  directory: string,
  errors: string[],
): Promise<void> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    const relative = posixPath(path.relative(root, target));
    const stats = await fs.lstat(target);
    if (stats.isSymbolicLink()) {
      errors.push(`${relative} is a symbolic link`);
      continue;
    }
    if (stats.isDirectory()) {
      await collectSymbolicLinks(root, target, errors);
    }
  }
}

function hookError(field: string, message: string): Error {
  return new Error(`${field} ${message}`);
}

export async function loadNormalizedHook(
  bundle: SkillBundle,
  hook: BundleHookDefinition,
  index: number,
  source = path.resolve(bundle.root, hook.path),
): Promise<NormalizedHook> {
  const field = `resources.hooks[${index}]`;
  let document: unknown;
  try {
    document = parse(await fs.readFile(source, 'utf8')) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw hookError(field, `is invalid: ${message}`);
  }
  if (!isObject(document)) throw hookError(field, 'must contain a YAML object');
  for (const inlineField of INLINE_HOOK_FIELDS) {
    if (inlineField in document) {
      throw hookError(`${field}.${inlineField}`, 'is not allowed');
    }
  }
  if (
    typeof document.event !== 'string' ||
    !HOOK_EVENTS.includes(document.event as (typeof HOOK_EVENTS)[number])
  ) {
    throw hookError(`${field}.event`, `must be one of ${HOOK_EVENTS.join(', ')}`);
  }
  if (typeof document.script !== 'string') {
    throw hookError(`${field}.script`, 'must be a string');
  }
  if (
    typeof document.failure !== 'string' ||
    !HOOK_FAILURES.includes(document.failure as (typeof HOOK_FAILURES)[number])
  ) {
    throw hookError(`${field}.failure`, `must be one of ${HOOK_FAILURES.join(', ')}`);
  }
  if (typeof document.requiresConfirmation !== 'boolean') {
    throw hookError(`${field}.requiresConfirmation`, 'must be a boolean');
  }
  if ('matcher' in document && typeof document.matcher !== 'string') {
    throw hookError(`${field}.matcher`, 'must be a string');
  }
  return {
    event: document.event as NormalizedHook['event'],
    ...(typeof document.matcher === 'string' ? { matcher: document.matcher } : {}),
    script: document.script,
    failure: document.failure as NormalizedHook['failure'],
    requiresConfirmation: document.requiresConfirmation,
  };
}

async function validateDeclaredPath(
  bundle: SkillBundle,
  item: DeclaredPath,
  realRoot: string,
  errors: string[],
): Promise<void> {
  if (isAbsolutePath(item.relative)) {
    errors.push(`${item.field} must be relative to the Bundle root`);
    return;
  }
  if (isEscapingPath(item.relative)) {
    errors.push(`${item.field} escapes the Bundle root`);
    return;
  }
  const target = path.resolve(bundle.root, item.relative);
  if (!insideRoot(bundle.root, target)) {
    errors.push(`${item.field} escapes the Bundle root`);
    return;
  }
  try {
    const realTarget = await fs.realpath(target);
    if (!insideRoot(realRoot, realTarget)) {
      errors.push(`${item.field} escapes the Bundle root`);
      return;
    }
    const stats = await fs.stat(target);
    if (item.directory && !stats.isDirectory()) {
      errors.push(`${item.field} must reference a directory`);
    }
    if (!item.directory && !stats.isFile()) {
      errors.push(`${item.field} must reference a file`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      errors.push(`${item.field} does not exist`);
      return;
    }
    throw error;
  }
}

function validateDuplicates(bundle: SkillBundle, errors: string[]): void {
  const ids = new Map<string, number>();
  const paths = new Map<string, number>();
  bundle.manifest.skills.forEach((skill, index) => {
    const idIndex = ids.get(skill.id);
    if (idIndex !== undefined) errors.push(`skills[${index}].id duplicates skills[${idIndex}].id`);
    else ids.set(skill.id, index);

    const normalized = path.posix.normalize(posixPath(skill.path));
    const pathIndex = paths.get(normalized);
    if (pathIndex !== undefined) {
      errors.push(`skills[${index}].path duplicates skills[${pathIndex}].path`);
    } else {
      paths.set(normalized, index);
    }
  });
}

export async function validateBundle(bundle: SkillBundle): Promise<string[]> {
  const errors: string[] = [];
  const { manifest } = bundle;

  if (!manifest.skills.some((skill) => skill.visibility === 'entry')) {
    errors.push('skills must include at least one entry Skill');
  }
  validateDuplicates(bundle, errors);

  const required = new Set(manifest.platforms.requires);
  for (const capability of manifest.platforms.optional) {
    if (required.has(capability)) {
      errors.push(`platforms capability ${capability} cannot be both required and optional`);
    }
  }

  manifest.resources.rules.forEach((rule, index) => {
    if (rule.mode === 'matched' && (!rule.match || rule.match.length === 0)) {
      errors.push(`resources.rules[${index}].match must contain at least one pattern`);
    }
  });

  for (const [index, agent] of manifest.resources.agents.entries()) {
    if (agent.platform !== 'claude') continue;
    if (isAbsolutePath(agent.path) || isEscapingPath(agent.path)) continue;
    try {
      const source = await fs.readFile(path.resolve(bundle.root, agent.path), 'utf8');
      if (
        !source.trimStart().startsWith('---') ||
        !source.includes('\nname:') ||
        !source.includes('\ndescription:')
      ) {
        errors.push(`resources.agents[${index}] must contain Claude Code agent frontmatter`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  const realRoot = await fs.realpath(bundle.root);
  await collectSymbolicLinks(bundle.root, bundle.root, errors);
  for (const item of declaredPaths(manifest)) {
    await validateDeclaredPath(bundle, item, realRoot, errors);
  }

  for (const [index, skill] of manifest.skills.entries()) {
    if (isAbsolutePath(skill.path) || isEscapingPath(skill.path)) continue;
    try {
      const stats = await fs.stat(path.resolve(bundle.root, skill.path, 'SKILL.md'));
      if (!stats.isFile()) errors.push(`skills[${index}].path must contain SKILL.md`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        errors.push(`skills[${index}].path must contain SKILL.md`);
      } else {
        throw error;
      }
    }
  }

  const scriptIds = new Set(manifest.resources.scripts.map((script) => script.id));
  for (const [index, hook] of manifest.resources.hooks.entries()) {
    try {
      const normalized = await loadNormalizedHook(bundle, hook, index);
      if (!scriptIds.has(normalized.script)) {
        errors.push(
          `resources.hooks[${index}].script references undeclared script ${normalized.script}`,
        );
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (manifest.engine.enabled) {
    try {
      const engine = await loadSkillPackage(
        path.resolve(bundle.root, manifest.engine.path ?? 'engine'),
      );
      errors.push(
        ...validateSkillPackage(engine).map((error) => `engine.path is invalid: ${error}`),
      );
    } catch (error) {
      errors.push(
        `engine.path is invalid: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return [...new Set(errors)];
}

export async function assertValidBundle(bundle: SkillBundle): Promise<void> {
  const errors = await validateBundle(bundle);
  if (errors.length > 0) {
    throw new Error(`Invalid Skill Bundle:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  }
}
