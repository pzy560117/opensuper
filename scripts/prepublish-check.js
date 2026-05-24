#!/usr/bin/env node

/**
 * Pre-publish security scan.
 * Checks for common secret patterns in files that would be published.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const SECRET_PATTERNS = [
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/i, name: 'API key' },
  { pattern: /(?:secret|token|password|passwd|pwd)\s*[:=]\s*['"][^\s'"]{8,}['"]/i, name: 'Secret/token' },
  { pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/, name: 'Private key' },
  { pattern: /ghp_[A-Za-z0-9]{36}/, name: 'GitHub token' },
  { pattern: /sk-[A-Za-z0-9]{20,}/, name: 'OpenAI key' },
  { pattern: /xoxb-[0-9]+-[A-Za-z0-9]+/, name: 'Slack token' },
  { pattern: /AKIA[0-9A-Z]{16}/, name: 'AWS access key' },
];

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist']);
const TEXT_EXTENSIONS = new Set(['.js', '.ts', '.json', '.md', '.txt', '.yml', '.yaml', '.toml']);
const README_IMAGE_PATTERN = /\b(?:src|srcset)=["'](?:\.\/)?img\//;

function* walkFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) {
        yield* walkFiles(full);
      }
    } else if (stat.isFile()) {
      yield full;
    }
  }
}

let found = 0;

for (const filePath of walkFiles('.')) {
  const ext = extname(filePath);
  if (!TEXT_EXTENSIONS.has(ext)) continue;

  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    continue;
  }

  for (const { pattern, name } of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      console.error(`[SECURITY] Possible ${name} found in ${filePath}`);
      found++;
    }
  }

  if (/README(?:-zh)?\.md$/.test(filePath) && README_IMAGE_PATTERN.test(content)) {
    console.error(
      `[PACKAGE] npm README images must use absolute URLs, not local img/ paths: ${filePath}`,
    );
    found++;
  }
}

if (found > 0) {
  console.error(`\n[SECURITY] ${found} potential secret(s) detected. Aborting publish.`);
  console.error('Review the files above and remove any secrets before publishing.');
  process.exit(1);
}

console.log('[SECURITY] No secrets detected. Safe to publish.');
