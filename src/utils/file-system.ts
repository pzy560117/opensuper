import { promises as fs } from 'fs';
import path from 'path';

/**
 * Ensure a directory exists, creating it recursively if needed.
 */
export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Copy a file from src to dest, creating parent directories if needed.
 */
export async function copyFile(src: string, dest: string): Promise<void> {
  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
}

/**
 * Check if a file or directory exists.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and parse a JSON file.
 */
export async function readJson<T = unknown>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Write content to a file, creating parent directories if needed.
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * List entries in a directory. Returns empty array if directory doesn't exist.
 */
export async function readDir(dirPath: string): Promise<string[]> {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}
