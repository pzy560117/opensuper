import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { parse, stringify } from 'yaml';
import type { SkillBundle } from './types.js';

interface HashedFile {
  path: string;
  sha256: string;
}

function posixPath(value: string): string {
  return value.replaceAll('\\', '/');
}

function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function normalizedContentForHash(relative: string, content: Buffer): string | Buffer {
  if (!relative.endsWith('/opensuper/eval.yaml') && relative !== 'opensuper/eval.yaml') {
    return content;
  }
  let manifest: unknown;
  try {
    manifest = parse(content.toString('utf8'));
  } catch {
    return content;
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return content;
  }
  const record = manifest as Record<string, unknown>;
  if (record.kind !== 'SkillEvalManifest') return content;
  const metadata = record.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return content;
  const metadataRecord = metadata as Record<string, unknown>;
  if (typeof metadataRecord.draftHash !== 'string') return content;
  metadataRecord.draftHash = '<current-bundle-hash>';
  return stringify(record);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function enumerateFiles(root: string, directory: string, files: HashedFile[]): Promise<void> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => compareText(left.name, right.name));
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    const relative = posixPath(path.relative(root, target));
    const stats = await fs.lstat(target);
    if (stats.isSymbolicLink()) {
      throw new Error(`${relative} is a symbolic link`);
    }
    if (stats.isDirectory()) {
      await enumerateFiles(root, target, files);
      continue;
    }
    if (stats.isFile()) {
      const content = await fs.readFile(target);
      files.push({
        path: relative,
        sha256: sha256(normalizedContentForHash(relative, content)),
      });
    }
  }
}

export async function hashBundle(bundle: SkillBundle): Promise<string> {
  const files: HashedFile[] = [];
  await enumerateFiles(bundle.root, bundle.root, files);
  files.sort((left, right) => compareText(left.path, right.path));
  return sha256(
    JSON.stringify({
      manifest: bundle.manifest,
      files,
    }),
  );
}
