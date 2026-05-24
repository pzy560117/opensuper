import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { ensureDir, copyFile, fileExists, readJson, writeFile, readDir } from '../../src/utils/file-system.js';

describe('file-system utils', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `opensuper-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('ensureDir', () => {
    it('creates a directory that does not exist', async () => {
      const dirPath = path.join(tmpDir, 'new-dir');
      await ensureDir(dirPath);
      const stat = await fs.stat(dirPath);
      expect(stat.isDirectory()).toBe(true);
    });

    it('creates nested directories recursively', async () => {
      const dirPath = path.join(tmpDir, 'a', 'b', 'c');
      await ensureDir(dirPath);
      const stat = await fs.stat(dirPath);
      expect(stat.isDirectory()).toBe(true);
    });

    it('does not throw when directory already exists', async () => {
      const dirPath = path.join(tmpDir, 'exists');
      await fs.mkdir(dirPath);
      await expect(ensureDir(dirPath)).resolves.not.toThrow();
    });
  });

  describe('copyFile', () => {
    it('copies file content from source to destination', async () => {
      const src = path.join(tmpDir, 'source.txt');
      const dest = path.join(tmpDir, 'sub', 'dest.txt');
      await fs.writeFile(src, 'hello');
      await copyFile(src, dest);
      const content = await fs.readFile(dest, 'utf-8');
      expect(content).toBe('hello');
    });

    it('creates parent directories of destination', async () => {
      const src = path.join(tmpDir, 'src.txt');
      const dest = path.join(tmpDir, 'deep', 'nested', 'dest.txt');
      await fs.writeFile(src, 'data');
      await copyFile(src, dest);
      const content = await fs.readFile(dest, 'utf-8');
      expect(content).toBe('data');
    });
  });

  describe('fileExists', () => {
    it('returns true for an existing file', async () => {
      const filePath = path.join(tmpDir, 'real.txt');
      await fs.writeFile(filePath, '');
      expect(await fileExists(filePath)).toBe(true);
    });

    it('returns true for an existing directory', async () => {
      expect(await fileExists(tmpDir)).toBe(true);
    });

    it('returns false for a non-existent path', async () => {
      expect(await fileExists(path.join(tmpDir, 'nope'))).toBe(false);
    });
  });

  describe('readJson', () => {
    it('parses a JSON file and returns typed data', async () => {
      const filePath = path.join(tmpDir, 'data.json');
      await fs.writeFile(filePath, JSON.stringify({ name: 'test', version: '1.0' }));
      const data = await readJson<{ name: string; version: string }>(filePath);
      expect(data).toEqual({ name: 'test', version: '1.0' });
    });

    it('throws on invalid JSON', async () => {
      const filePath = path.join(tmpDir, 'bad.json');
      await fs.writeFile(filePath, '{not json');
      await expect(readJson(filePath)).rejects.toThrow();
    });
  });

  describe('writeFile', () => {
    it('writes content to a file', async () => {
      const filePath = path.join(tmpDir, 'out.txt');
      await writeFile(filePath, 'my content');
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('my content');
    });

    it('creates parent directories', async () => {
      const filePath = path.join(tmpDir, 'dir', 'subdir', 'out.txt');
      await writeFile(filePath, 'deep');
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('deep');
    });
  });

  describe('readDir', () => {
    it('lists directory entries', async () => {
      await fs.writeFile(path.join(tmpDir, 'a.txt'), '');
      await fs.writeFile(path.join(tmpDir, 'b.txt'), '');
      const entries = await readDir(tmpDir);
      expect(entries).toContain('a.txt');
      expect(entries).toContain('b.txt');
    });

    it('returns empty array for non-existent directory', async () => {
      const entries = await readDir(path.join(tmpDir, 'nope'));
      expect(entries).toEqual([]);
    });
  });
});
