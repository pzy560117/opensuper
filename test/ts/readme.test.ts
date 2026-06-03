import { describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';

const readmes = ['README.md', 'README-zh.md'];

describe('README assets', () => {
  it.each(readmes)('uses npm-friendly absolute image URLs in %s', async (readmePath) => {
    const content = await fs.readFile(readmePath, 'utf-8');

    expect(content).not.toMatch(/\b(?:src|srcset)=["'](?:\.\/)?img\//);
    expect(content).not.toMatch(/\b(?:src|srcset)=["']https:\/\/github\.com\/pzy560117\/opensuper\/blob\/main\/img\//);
    expect(content).toContain('https://raw.githubusercontent.com/pzy560117/opensuper/main/img/');
  });
});
