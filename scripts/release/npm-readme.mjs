#!/usr/bin/env node

/**
 * npm README transform.
 *
 * GitHub renders bare user-attachments URLs as inline video players, while
 * npmjs.com shows them as plain links. Before packing, `apply` swaps each
 * video URL for the absolute-URL preview image plus a play link; `restore`
 * puts the GitHub version back afterwards.
 */

import { promises as fs } from 'fs';

const IMAGE_BASE = 'https://github.com/pzy560117/opensuper/blob/main/img';
const ATTACHMENT_BASE = 'https://github.com/user-attachments/assets';

export const README_FILES = [
  { path: 'README.md', playLabel: '▶ Play the full demo' },
  { path: 'README-zh.md', playLabel: '▶ 播放完整演示' },
];

// Registry of the videos embedded in the READMEs. The attachmentId is the
// GitHub-uploaded asset that renders as an inline player; name/alt point at
// the repository mp4 and preview image used for the npm README. New videos
// must be registered here — apply/restore refuse unknown attachment IDs.
export const README_VIDEOS = [
  {
    attachmentId: '96114cb0-f542-4f58-aa27-256f32adc46e',
    name: 'supervisor-codex',
    alt: 'OpenSuper Supervisor coordinating independent Codex sessions',
  },
  {
    attachmentId: '41428669-a49a-46e3-a0ae-0775e4f4bb6f',
    name: 'supervisor-claude-code',
    alt: 'OpenSuper Supervisor coordinating a Claude Code Agent Team',
  },
];

// GitHub shape: blank line, bare attachment URL, blank line.
const GITHUB_VIDEO_EMBED =
  /\r?\n\r?\nhttps:\/\/github\.com\/user-attachments\/assets\/([0-9a-f-]+)\r?\n\r?\n/g;

// Exact mirror of the block npmPreviewBlock() emits, used to restore.
// Top-level indentation only: inside a markdown paragraph, 4+ spaces of
// indentation would turn the block into a code fence.
const NPM_PREVIEW_BLOCK = new RegExp(
  String.raw`\r?\n<a href="https://github\.com/pzy560117/opensuper/blob/main/img/([a-z0-9-]+)\.mp4">` +
    String.raw`\r?\n {2}<img src="https://github\.com/pzy560117/opensuper/blob/main/img/\1-preview\.png" alt="([^"]*)" width="100%">` +
    String.raw`\r?\n</a><br>` +
    String.raw`\r?\n<a href="https://github\.com/pzy560117/opensuper/blob/main/img/\1\.mp4">[^<\r\n]*</a>` +
    String.raw`\r?\n`,
  'g',
);

function detectEol(content) {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

function npmPreviewBlock(video, playLabel, eol) {
  return [
    `<a href="${IMAGE_BASE}/${video.name}.mp4">`,
    `  <img src="${IMAGE_BASE}/${video.name}-preview.png" alt="${video.alt}" width="100%">`,
    '</a><br>',
    `<a href="${IMAGE_BASE}/${video.name}.mp4">${playLabel}</a>`,
  ].join(eol);
}

export function transformReadmeForNpm(content, playLabel) {
  const eol = detectEol(content);
  let count = 0;
  let skipped = 0;
  const transformed = content.replace(GITHUB_VIDEO_EMBED, (match, attachmentId) => {
    const video = README_VIDEOS.find((candidate) => candidate.attachmentId === attachmentId);
    if (!video) {
      skipped++;
      return match;
    }
    count++;
    return `${eol}${npmPreviewBlock(video, playLabel, eol)}${eol}`;
  });
  return { content: transformed, count, skipped };
}

export function restoreReadmeForGithub(content) {
  const eol = detectEol(content);
  let count = 0;
  const restored = content.replace(NPM_PREVIEW_BLOCK, (match, name) => {
    const video = README_VIDEOS.find((candidate) => candidate.name === name);
    if (!video) return match;
    count++;
    return `${eol}${eol}${ATTACHMENT_BASE}/${video.attachmentId}${eol}${eol}`;
  });
  return { content: restored, count, skipped: 0 };
}

export async function runNpmReadmeCommand(command) {
  if (command !== 'apply' && command !== 'restore') {
    console.error(`[NPM-README] Unknown command: ${command ?? '(none)'}`);
    console.error('Usage: node scripts/release/npm-readme.mjs <apply|restore>');
    return 1;
  }

  let failures = 0;
  for (const file of README_FILES) {
    const original = await fs.readFile(file.path, 'utf8');
    const result =
      command === 'apply'
        ? transformReadmeForNpm(original, file.playLabel)
        : restoreReadmeForGithub(original);
    if (result.content !== original) {
      await fs.writeFile(file.path, result.content);
    }
    console.log(`[NPM-README] ${command}: ${file.path} — ${result.count} embed(s)`);
    if (result.skipped > 0) {
      console.error(
        `[NPM-README] ${file.path}: skipped ${result.skipped} unregistered user-attachments URL(s)`,
      );
      failures++;
    }
  }
  return failures === 0 ? 0 : 1;
}

if (process.argv[1] && process.argv[1].endsWith('npm-readme.mjs')) {
  process.exit(await runNpmReadmeCommand(process.argv[2]));
}
