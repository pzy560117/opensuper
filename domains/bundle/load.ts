import { promises as fs } from 'fs';
import path from 'path';
import { parse } from 'yaml';
import type {
  BundleCapability,
  BundleAgentDefinition,
  BundleHookDefinition,
  BundleManifest,
  BundlePlatformOverride,
  BundleRuleDefinition,
  BundleScriptDefinition,
  BundleSkillDefinition,
  ResolvedBundleLocale,
  SkillBundle,
} from './types.js';

type YamlObject = Record<string, unknown>;

const CAPABILITIES = [
  'skills',
  'rules',
  'hooks',
  'scripts',
  'references',
  'assets',
  'agents',
] as const;
const AGENT_PLATFORMS = ['claude'] as const;
const SKILL_VISIBILITIES = ['entry', 'internal'] as const;
const RULE_MODES = ['always', 'matched'] as const;
const SIDE_EFFECTS = ['none', 'read', 'write', 'external'] as const;
const SCRIPT_RUNTIMES = ['node', 'bash', 'python'] as const;

function invalidDocument(filePath: string, fieldPath: string, message: string): Error {
  return new Error(`${filePath}: ${fieldPath} ${message}`);
}

function assertObject(
  value: unknown,
  filePath: string,
  fieldPath = 'document',
): asserts value is YamlObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidDocument(filePath, fieldPath, 'must be an object');
  }
}

function assertArray(
  value: unknown,
  filePath: string,
  fieldPath: string,
): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw invalidDocument(filePath, fieldPath, 'must be an array');
  }
}

function assertString(
  value: unknown,
  filePath: string,
  fieldPath: string,
): asserts value is string {
  if (typeof value !== 'string') {
    throw invalidDocument(filePath, fieldPath, 'must be a string');
  }
}

function assertBoolean(
  value: unknown,
  filePath: string,
  fieldPath: string,
): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw invalidDocument(filePath, fieldPath, 'must be a boolean');
  }
}

function assertOptionalBoolean(
  document: YamlObject,
  field: string,
  filePath: string,
  objectPath: string,
): void {
  if (field in document) {
    assertBoolean(document[field], filePath, `${objectPath}.${field}`);
  }
}

function assertOptionalNumber(
  document: YamlObject,
  field: string,
  filePath: string,
  objectPath: string,
): void {
  if (
    field in document &&
    (typeof document[field] !== 'number' || !Number.isFinite(document[field]))
  ) {
    throw invalidDocument(filePath, `${objectPath}.${field}`, 'must be a finite number');
  }
}

function assertOptionalString(
  document: YamlObject,
  field: string,
  filePath: string,
  objectPath: string,
): void {
  if (field in document) {
    assertString(document[field], filePath, `${objectPath}.${field}`);
  }
}

function assertEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  filePath: string,
  fieldPath: string,
): asserts value is T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw invalidDocument(filePath, fieldPath, `must be one of ${values.join(', ')}`);
  }
}

function stringArray(value: unknown, filePath: string, fieldPath: string): string[] {
  assertArray(value, filePath, fieldPath);
  return value.map((entry, index) => {
    assertString(entry, filePath, `${fieldPath}[${index}]`);
    return entry;
  });
}

function optionalArray(
  document: YamlObject,
  field: string,
  filePath: string,
  objectPath: string,
): unknown[] {
  if (!(field in document)) return [];
  assertArray(document[field], filePath, `${objectPath}.${field}`);
  return document[field];
}

function normalizeResourcePath(value: string): string {
  return value.replaceAll('\\', '/');
}

function narrowSkill(value: unknown, filePath: string, index: number): BundleSkillDefinition {
  const fieldPath = `skills[${index}]`;
  assertObject(value, filePath, fieldPath);
  assertString(value.id, filePath, `${fieldPath}.id`);
  assertString(value.path, filePath, `${fieldPath}.path`);
  assertEnum(value.visibility, SKILL_VISIBILITIES, filePath, `${fieldPath}.visibility`);
  return {
    id: value.id,
    path: normalizeResourcePath(value.path),
    visibility: value.visibility,
  };
}

function narrowRule(value: unknown, filePath: string, index: number): BundleRuleDefinition {
  const fieldPath = `resources.rules[${index}]`;
  assertObject(value, filePath, fieldPath);
  assertString(value.id, filePath, `${fieldPath}.id`);
  assertString(value.path, filePath, `${fieldPath}.path`);
  assertEnum(value.mode, RULE_MODES, filePath, `${fieldPath}.mode`);
  assertBoolean(value.required, filePath, `${fieldPath}.required`);
  assertOptionalNumber(value, 'priority', filePath, fieldPath);
  const match =
    'match' in value ? stringArray(value.match, filePath, `${fieldPath}.match`) : undefined;
  return {
    id: value.id,
    path: normalizeResourcePath(value.path),
    mode: value.mode,
    ...(match ? { match } : {}),
    ...(typeof value.priority === 'number' ? { priority: value.priority } : {}),
    required: value.required,
  };
}

function narrowHook(value: unknown, filePath: string, index: number): BundleHookDefinition {
  const fieldPath = `resources.hooks[${index}]`;
  assertObject(value, filePath, fieldPath);
  assertString(value.id, filePath, `${fieldPath}.id`);
  assertString(value.path, filePath, `${fieldPath}.path`);
  return { id: value.id, path: normalizeResourcePath(value.path) };
}

function narrowScript(value: unknown, filePath: string, index: number): BundleScriptDefinition {
  const fieldPath = `resources.scripts[${index}]`;
  assertObject(value, filePath, fieldPath);
  assertString(value.id, filePath, `${fieldPath}.id`);
  assertString(value.path, filePath, `${fieldPath}.path`);
  assertEnum(value.sideEffect, SIDE_EFFECTS, filePath, `${fieldPath}.sideEffect`);
  assertEnum(value.runtime, SCRIPT_RUNTIMES, filePath, `${fieldPath}.runtime`);
  assertOptionalBoolean(value, 'requiresConfirmation', filePath, fieldPath);
  return {
    id: value.id,
    path: normalizeResourcePath(value.path),
    sideEffect: value.sideEffect,
    runtime: value.runtime,
    ...(typeof value.requiresConfirmation === 'boolean'
      ? { requiresConfirmation: value.requiresConfirmation }
      : {}),
  };
}

function narrowAgent(value: unknown, filePath: string, index: number): BundleAgentDefinition {
  const fieldPath = `resources.agents[${index}]`;
  assertObject(value, filePath, fieldPath);
  assertString(value.id, filePath, `${fieldPath}.id`);
  assertString(value.path, filePath, `${fieldPath}.path`);
  assertEnum(value.platform, AGENT_PLATFORMS, filePath, `${fieldPath}.platform`);
  assertBoolean(value.required, filePath, `${fieldPath}.required`);
  return {
    id: value.id,
    path: normalizeResourcePath(value.path),
    platform: value.platform,
    required: value.required,
  };
}

function narrowCapabilityArray(
  value: unknown,
  filePath: string,
  fieldPath: string,
): BundleCapability[] {
  assertArray(value, filePath, fieldPath);
  return value.map((entry, index) => {
    assertEnum(entry, CAPABILITIES, filePath, `${fieldPath}[${index}]`);
    return entry;
  });
}

function narrowOverride(value: unknown, filePath: string, index: number): BundlePlatformOverride {
  const fieldPath = `platforms.overrides[${index}]`;
  assertObject(value, filePath, fieldPath);
  assertString(value.platform, filePath, `${fieldPath}.platform`);
  assertString(value.replaces, filePath, `${fieldPath}.replaces`);
  assertString(value.path, filePath, `${fieldPath}.path`);
  return {
    platform: value.platform,
    replaces: value.replaces,
    path: normalizeResourcePath(value.path),
  };
}

function narrowManifest(document: unknown, filePath: string): BundleManifest {
  assertObject(document, filePath);
  assertEnum(document.apiVersion, ['opensuper/v1alpha1'], filePath, 'apiVersion');
  assertEnum(document.kind, ['SkillBundle'], filePath, 'kind');

  assertObject(document.metadata, filePath, 'metadata');
  assertString(document.metadata.name, filePath, 'metadata.name');
  assertString(document.metadata.version, filePath, 'metadata.version');
  assertString(document.metadata.description, filePath, 'metadata.description');
  assertString(document.metadata.defaultLocale, filePath, 'metadata.defaultLocale');
  const locales = stringArray(document.metadata.locales, filePath, 'metadata.locales');

  assertArray(document.skills, filePath, 'skills');
  const skills = document.skills.map((entry, index) => narrowSkill(entry, filePath, index));

  const resourcesValue = document.resources ?? {};
  assertObject(resourcesValue, filePath, 'resources');
  const resources = {
    rules: optionalArray(resourcesValue, 'rules', filePath, 'resources').map((entry, index) =>
      narrowRule(entry, filePath, index),
    ),
    hooks: optionalArray(resourcesValue, 'hooks', filePath, 'resources').map((entry, index) =>
      narrowHook(entry, filePath, index),
    ),
    references: optionalArray(resourcesValue, 'references', filePath, 'resources').map(
      (entry, index) => {
        assertString(entry, filePath, `resources.references[${index}]`);
        return normalizeResourcePath(entry);
      },
    ),
    scripts: optionalArray(resourcesValue, 'scripts', filePath, 'resources').map((entry, index) =>
      narrowScript(entry, filePath, index),
    ),
    assets: optionalArray(resourcesValue, 'assets', filePath, 'resources').map((entry, index) => {
      assertString(entry, filePath, `resources.assets[${index}]`);
      return normalizeResourcePath(entry);
    }),
    agents: optionalArray(resourcesValue, 'agents', filePath, 'resources').map((entry, index) =>
      narrowAgent(entry, filePath, index),
    ),
  };

  const platformsValue = document.platforms ?? {};
  assertObject(platformsValue, filePath, 'platforms');
  const platforms = {
    requires:
      'requires' in platformsValue
        ? narrowCapabilityArray(platformsValue.requires, filePath, 'platforms.requires')
        : [],
    optional:
      'optional' in platformsValue
        ? narrowCapabilityArray(platformsValue.optional, filePath, 'platforms.optional')
        : [],
    overrides: optionalArray(platformsValue, 'overrides', filePath, 'platforms').map(
      (entry, index) => narrowOverride(entry, filePath, index),
    ),
  };

  const engineValue = document.engine ?? { enabled: false };
  assertObject(engineValue, filePath, 'engine');
  assertBoolean(engineValue.enabled, filePath, 'engine.enabled');
  assertOptionalString(engineValue, 'path', filePath, 'engine');

  return {
    apiVersion: document.apiVersion,
    kind: document.kind,
    metadata: {
      name: document.metadata.name,
      version: document.metadata.version,
      description: document.metadata.description,
      defaultLocale: document.metadata.defaultLocale,
      locales,
    },
    skills,
    resources,
    platforms,
    engine: {
      enabled: engineValue.enabled,
      ...(typeof engineValue.path === 'string'
        ? { path: normalizeResourcePath(engineValue.path) }
        : {}),
    },
  };
}

async function readYaml(filePath: string): Promise<unknown> {
  const source = await fs.readFile(filePath, 'utf8');
  try {
    return parse(source) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw invalidDocument(filePath, 'document', message);
  }
}

export async function loadBundle(root: string): Promise<SkillBundle> {
  const bundleRoot = path.resolve(root);
  const manifestPath = path.join(bundleRoot, 'bundle.yaml');
  return {
    root: bundleRoot,
    manifest: narrowManifest(await readYaml(manifestPath), manifestPath),
  };
}

async function collectDirectoryFiles(
  root: string,
  directory: string,
  files: Map<string, string>,
): Promise<void> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    const stats = await fs.lstat(target);
    const relative = normalizeResourcePath(path.relative(root, target));
    if (stats.isSymbolicLink()) {
      throw new Error(`${relative} is a symbolic link`);
    }
    if (stats.isDirectory()) {
      await collectDirectoryFiles(root, target, files);
    } else if (stats.isFile()) {
      files.set(relative, target);
    }
  }
}

function declaredLocalizedPaths(bundle: SkillBundle): Set<string> {
  return new Set([
    ...bundle.manifest.resources.rules.map((item) => item.path),
    ...bundle.manifest.resources.hooks.map((item) => item.path),
    ...bundle.manifest.resources.references,
    ...bundle.manifest.resources.agents.map((item) => item.path),
    ...bundle.manifest.platforms.overrides.map((item) => item.path),
  ]);
}

function sharedResourcePaths(bundle: SkillBundle): Set<string> {
  return new Set([
    ...bundle.manifest.resources.scripts.map((item) => item.path),
    ...bundle.manifest.resources.assets,
  ]);
}

function insideDeclaredSkill(bundle: SkillBundle, logicalPath: string): boolean {
  return bundle.manifest.skills.some((skill) => {
    const prefix = `${skill.path.replace(/\/+$/, '')}/`;
    return logicalPath.startsWith(prefix);
  });
}

async function addDeclaredFile(
  bundle: SkillBundle,
  logicalPath: string,
  files: Map<string, string>,
): Promise<void> {
  const source = path.resolve(bundle.root, logicalPath);
  const stats = await fs.lstat(source);
  if (stats.isSymbolicLink()) throw new Error(`${logicalPath} is a symbolic link`);
  if (!stats.isFile()) throw new Error(`${logicalPath} must reference a file`);
  files.set(logicalPath, source);
}

async function collectBaselineFiles(bundle: SkillBundle): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  for (const skill of bundle.manifest.skills) {
    await collectDirectoryFiles(bundle.root, path.resolve(bundle.root, skill.path), files);
  }
  const directFiles = [
    ...bundle.manifest.resources.rules.map((item) => item.path),
    ...bundle.manifest.resources.hooks.map((item) => item.path),
    ...bundle.manifest.resources.references,
    ...bundle.manifest.resources.scripts.map((item) => item.path),
    ...bundle.manifest.resources.assets,
    ...bundle.manifest.resources.agents.map((item) => item.path),
    ...bundle.manifest.platforms.overrides.map((item) => item.path),
  ];
  for (const logicalPath of directFiles) {
    await addDeclaredFile(bundle, logicalPath, files);
  }
  if (bundle.manifest.engine.enabled) {
    await collectDirectoryFiles(
      bundle.root,
      path.resolve(bundle.root, bundle.manifest.engine.path ?? 'engine'),
      files,
    );
  }
  return files;
}

async function applyLocaleOverlay(
  bundle: SkillBundle,
  locale: string,
  files: Map<string, string>,
): Promise<void> {
  const localeRoot = path.join(bundle.root, 'locales', locale);
  try {
    const stats = await fs.lstat(localeRoot);
    if (stats.isSymbolicLink()) throw new Error(`locales/${locale} is a symbolic link`);
    if (!stats.isDirectory()) throw new Error(`locales/${locale} must be a directory`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }

  const overlays = new Map<string, string>();
  await collectDirectoryFiles(localeRoot, localeRoot, overlays);
  const localizedPaths = declaredLocalizedPaths(bundle);
  const sharedPaths = sharedResourcePaths(bundle);
  for (const [logicalPath, source] of overlays) {
    if (sharedPaths.has(logicalPath)) {
      throw new Error(`Locale overlay cannot replace shared resource: ${logicalPath}`);
    }
    if (!localizedPaths.has(logicalPath) && !insideDeclaredSkill(bundle, logicalPath)) {
      throw new Error(`Locale overlay is outside the Bundle resource graph: ${logicalPath}`);
    }
    files.set(logicalPath, source);
  }
}

export async function resolveBundleLocale(
  bundle: SkillBundle,
  requested?: string,
): Promise<ResolvedBundleLocale> {
  const locale = requested ?? bundle.manifest.metadata.defaultLocale;
  if (!bundle.manifest.metadata.locales.includes(locale)) {
    throw new Error(`Unsupported Bundle locale: ${locale}`);
  }
  const files = await collectBaselineFiles(bundle);
  await applyLocaleOverlay(bundle, locale, files);
  return { bundle, locale, files };
}
