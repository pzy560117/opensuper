import path from 'path';
import { hashBundle } from './hash.js';
import { resolveBundleLocale } from './load.js';
import type { BundleCompilerIr, SkillBundle } from './types.js';
import { assertValidBundle, loadNormalizedHook } from './validate.js';

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requiredSource(files: Map<string, string>, logicalPath: string): string {
  const source = files.get(logicalPath);
  if (!source) throw new Error(`Resolved Bundle file is missing: ${logicalPath}`);
  return source;
}

export async function compileBundleIr(
  bundle: SkillBundle,
  options: { locale?: string } = {},
): Promise<BundleCompilerIr> {
  const resolved = await resolveBundleLocale(bundle, options.locale);
  await assertValidBundle(bundle);
  const hash = await hashBundle(bundle);

  const skills = bundle.manifest.skills
    .map((skill) => {
      const prefix = `${skill.path.replace(/\/+$/, '')}/`;
      const files = [...resolved.files.entries()]
        .filter(([logicalPath]) => logicalPath.startsWith(prefix))
        .map(([logicalPath, source]) => ({
          relativePath: logicalPath.slice(prefix.length),
          source,
        }))
        .sort((left, right) => compareText(left.relativePath, right.relativePath));
      return {
        id: skill.id,
        logicalRoot: skill.path,
        visibility: skill.visibility,
        sourceRoot: path.resolve(bundle.root, skill.path),
        files,
      };
    })
    .sort((left, right) => compareText(left.id, right.id));

  const rules = bundle.manifest.resources.rules
    .map((rule) => ({
      ...rule,
      source: requiredSource(resolved.files, rule.path),
    }))
    .sort((left, right) => compareText(left.id, right.id));

  const hooks = await Promise.all(
    bundle.manifest.resources.hooks.map(async (hook, index) => ({
      ...(await loadNormalizedHook(bundle, hook, index, requiredSource(resolved.files, hook.path))),
      id: hook.id,
      source: requiredSource(resolved.files, hook.path),
    })),
  );
  hooks.sort((left, right) => compareText(left.id, right.id));

  const scripts = bundle.manifest.resources.scripts
    .map((script) => ({
      ...script,
      source: requiredSource(resolved.files, script.path),
    }))
    .sort((left, right) => compareText(left.id, right.id));

  const references = bundle.manifest.resources.references
    .map((logicalPath) => ({
      logicalPath,
      source: requiredSource(resolved.files, logicalPath),
    }))
    .sort((left, right) => compareText(left.logicalPath, right.logicalPath));

  const assets = bundle.manifest.resources.assets
    .map((logicalPath) => ({
      logicalPath,
      source: requiredSource(resolved.files, logicalPath),
    }))
    .sort((left, right) => compareText(left.logicalPath, right.logicalPath));

  const agents = bundle.manifest.resources.agents
    .map((agent) => ({
      ...agent,
      source: requiredSource(resolved.files, agent.path),
    }))
    .sort((left, right) => compareText(left.id, right.id));

  const overrides = bundle.manifest.platforms.overrides
    .map((override) => ({
      ...override,
      source: requiredSource(resolved.files, override.path),
    }))
    .sort((left, right) => {
      const platformOrder = compareText(left.platform, right.platform);
      return platformOrder === 0 ? compareText(left.replaces, right.replaces) : platformOrder;
    });

  return {
    bundle: {
      name: bundle.manifest.metadata.name,
      version: bundle.manifest.metadata.version,
      locale: resolved.locale,
      hash,
    },
    capabilities: {
      requires: [...bundle.manifest.platforms.requires],
      optional: [...bundle.manifest.platforms.optional],
    },
    skills,
    rules,
    hooks,
    scripts,
    references,
    assets,
    agents,
    overrides,
    engine: bundle.manifest.engine.enabled
      ? { sourceRoot: path.resolve(bundle.root, bundle.manifest.engine.path ?? 'engine') }
      : null,
  };
}
