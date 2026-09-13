import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';

function normalizeCase(value: string): string {
  const normalized = path.normalize(value);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

export function canonicalizePath(value: string): string {
  const resolved = path.resolve(value);
  let current = resolved;
  const suffix: string[] = [];

  while (!existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return resolved;
    suffix.unshift(path.basename(current));
    current = parent;
  }

  const canonicalBase = realpathSync.native(current);
  return path.join(canonicalBase, ...suffix);
}

export function sameCanonicalPath(left: string, right: string): boolean {
  return normalizeCase(canonicalizePath(left)) === normalizeCase(canonicalizePath(right));
}

export function canonicalRelativePath(root: string, candidate: string): string {
  return path.relative(canonicalizePath(root), canonicalizePath(candidate));
}

export function isWithinCanonicalPath(root: string, candidate: string): boolean {
  const relative = canonicalRelativePath(root, candidate);
  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}
