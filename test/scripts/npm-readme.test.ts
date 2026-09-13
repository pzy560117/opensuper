import { promises as fs } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  README_FILES,
  README_VIDEOS,
  restoreReadmeForGithub,
  transformReadmeForNpm,
} from '../../scripts/release/npm-readme.mjs';

const ATTACHMENT_URL = (attachmentId: string) =>
  `https://github.com/user-attachments/assets/${attachmentId}`;
const MARKDOWN_MP4_EMBED = /!\[[^\]]*\]\(img\/[a-z0-9-]+\.mp4\)/u;

describe('npm readme transform', () => {
  it.each(README_FILES)('round-trips $path byte-exactly', async (file) => {
    const original = await fs.readFile(file.path, 'utf8');

    const applied = transformReadmeForNpm(original, file.playLabel);
    expect(applied.count).toBe(README_VIDEOS.length);
    expect(applied.skipped).toBe(0);
    for (const video of README_VIDEOS) {
      expect(applied.content).not.toContain(ATTACHMENT_URL(video.attachmentId));
      expect(applied.content).toContain(
        `https://github.com/pzy560117/opensuper/blob/main/img/${video.name}-preview.png`,
      );
    }
    expect(applied.content).toContain(`${file.playLabel}</a>`);
    expect(applied.content).not.toMatch(MARKDOWN_MP4_EMBED);

    const restored = restoreReadmeForGithub(applied.content);
    expect(restored.count).toBe(README_VIDEOS.length);
    expect(restored.content).toBe(original);
  });

  it.each(README_FILES)('is idempotent on $path', async (file) => {
    const original = await fs.readFile(file.path, 'utf8');

    expect(restoreReadmeForGithub(original).count).toBe(0);
    const applied = transformReadmeForNpm(original, file.playLabel);
    expect(transformReadmeForNpm(applied.content, file.playLabel).count).toBe(0);
    expect(applied.content).not.toBe(original);
  });

  it('preserves CRLF line endings through the round trip', () => {
    const [codex] = README_VIDEOS;
    const source = [
      '**Codex multi-session execution**',
      '',
      ATTACHMENT_URL(codex.attachmentId),
      '',
      '**Claude Code Agent Teams execution**',
      '',
    ].join('\r\n');

    const applied = transformReadmeForNpm(source, '▶ Play the full demo');
    expect(applied.count).toBe(1);
    expect(applied.content).toContain('\r\n<a href="https://github.com/pzy560117/opensuper');
    expect(restoreReadmeForGithub(applied.content).content).toBe(source);
  });

  it('keeps unregistered attachment URLs untouched', () => {
    const url = ATTACHMENT_URL('00000000-dead-beef-0000-000000000000');
    const source = `intro\n\n${url}\n\noutro\n`;

    const applied = transformReadmeForNpm(source, '▶ Play the full demo');
    expect(applied.count).toBe(0);
    expect(applied.skipped).toBe(1);
    expect(applied.content).toBe(source);
  });
});
