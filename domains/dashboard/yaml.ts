/**
 * Lightweight `.opensuper.yaml` parser.
 *
 * Mirrors the format produced by `assets/skills/opensuper/scripts/opensuper-state.sh`
 * (a single flat map of `key: value` lines). This is intentionally a subset
 * of YAML — no nested keys, no anchors — and matches the parser already used
 * by `app/commands/status.ts`. It is reproduced here, rather than reused, to
 * keep the dashboard module standalone; a future PR may consolidate them.
 */

import { promises as fs } from 'fs';
import { fileExists } from '../../platform/fs/file-system.js';

export type OpenSuperYaml = Record<string, string>;

export async function readOpenSuperYaml(yamlPath: string): Promise<OpenSuperYaml | null> {
  if (!(await fileExists(yamlPath))) return null;
  const raw = await fs.readFile(yamlPath, 'utf-8');
  return parseOpenSuperYaml(raw);
}

export function parseOpenSuperYaml(raw: string): OpenSuperYaml {
  const out: OpenSuperYaml = {};
  for (const line of raw.split(/\r?\n/u)) {
    const stripped = stripInlineComment(line);
    const match = stripped.match(/^(\w[\w_]*):\s*(.*)$/u);
    if (!match) continue;
    const value = match[2].trim();
    out[match[1]] = stripWrappingQuotes(value);
  }
  return out;
}

function stripInlineComment(line: string): string {
  // Walk char-by-char so that `#` inside quoted strings is preserved.
  let out = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (!quote) {
      if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '#' && (i === 0 || /\s/u.test(line[i - 1]))) {
        return out.replace(/\s+$/u, '');
      }
    } else if (ch === quote) {
      quote = null;
    }
    out += ch;
  }
  return out;
}

function stripWrappingQuotes(value: string): string {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' || first === "'") && first === last) {
    return value.slice(1, -1);
  }
  return value;
}
