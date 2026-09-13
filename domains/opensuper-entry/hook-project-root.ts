import { promises as fs } from 'fs';
import path from 'path';

import {
  canonicalizePath,
  isWithinCanonicalPath,
  sameCanonicalPath,
} from '../../platform/paths/canonical-path.js';
import { listGitWorktreeRoots } from '../../platform/paths/git-worktree.js';
import type { OpenSuperHookRequest } from './hook-types.js';

function owningWorktree(candidate: string, roots: readonly string[]): string | null {
  return (
    [...roots]
      .sort((left, right) => right.length - left.length)
      .find((root) => isWithinCanonicalPath(root, candidate)) ?? null
  );
}

async function assertRebasedWorktreeReady(projectRoot: string): Promise<void> {
  for (const marker of ['.git', path.join('.opensuper', 'config.yaml')]) {
    try {
      await fs.lstat(path.join(projectRoot, marker));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      throw new Error(
        `linked worktree ${projectRoot} is not initialized for OpenSuper: missing ${marker.replaceAll('\\', '/')}`,
        { cause: error },
      );
    }
  }
}

export async function resolveOpenSuperHookProjectRoot(
  explicitProjectRoot: string,
  request: OpenSuperHookRequest,
): Promise<string> {
  const explicitRoot = canonicalizePath(explicitProjectRoot);
  const roots = listGitWorktreeRoots(explicitRoot);
  if (roots.length < 2 || request.targets.length === 0) return explicitRoot;

  const cwdOwner = request.cwd ? owningWorktree(canonicalizePath(request.cwd), roots) : null;
  const relativeTargetBase = cwdOwner ?? explicitRoot;
  const owners = new Map<string, string>();

  for (const target of request.targets) {
    const absoluteTarget = canonicalizePath(
      path.isAbsolute(target) ? target : path.resolve(relativeTargetBase, target),
    );
    const owner = owningWorktree(absoluteTarget, roots);
    if (!owner) continue;
    const key = process.platform === 'win32' ? owner.toLowerCase() : owner;
    owners.set(key, owner);
  }

  if (owners.size === 0) return explicitRoot;
  if (owners.size > 1) {
    throw new Error('one Hook request cannot write across multiple Git worktrees');
  }

  const [selectedRoot] = owners.values();
  if (!sameCanonicalPath(selectedRoot, explicitRoot)) {
    await assertRebasedWorktreeReady(selectedRoot);
  }
  return selectedRoot;
}
