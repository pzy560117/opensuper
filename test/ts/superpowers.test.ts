import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const mockedExecSync = vi.mocked(execSync);

describe('superpowers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SKILLS_AGENT_MAP', () => {
    it('maps claude to claude-code', async () => {
      const { SKILLS_AGENT_MAP } = await import('../../src/core/superpowers.js');
      expect(SKILLS_AGENT_MAP['claude']).toBe('claude-code');
    });

    it('maps cursor unchanged', async () => {
      const { SKILLS_AGENT_MAP } = await import('../../src/core/superpowers.js');
      expect(SKILLS_AGENT_MAP['cursor']).toBe('cursor');
    });

    it('maps roocode to roo-code', async () => {
      const { SKILLS_AGENT_MAP } = await import('../../src/core/superpowers.js');
      expect(SKILLS_AGENT_MAP['roocode']).toBe('roo-code');
    });

    it('maps kilocode to kilo-code', async () => {
      const { SKILLS_AGENT_MAP } = await import('../../src/core/superpowers.js');
      expect(SKILLS_AGENT_MAP['kilocode']).toBe('kilo-code');
    });

    it('maps auggie to augment', async () => {
      const { SKILLS_AGENT_MAP } = await import('../../src/core/superpowers.js');
      expect(SKILLS_AGENT_MAP['auggie']).toBe('augment');
    });

    it('maps forgecode to forge', async () => {
      const { SKILLS_AGENT_MAP } = await import('../../src/core/superpowers.js');
      expect(SKILLS_AGENT_MAP['forgecode']).toBe('forge');
    });

    it('has entries for all 28 platforms', async () => {
      const { SKILLS_AGENT_MAP } = await import('../../src/core/superpowers.js');
      const platformIds = [
        'claude', 'cursor', 'codex', 'opencode', 'windsurf', 'cline',
        'roocode', 'continue', 'github-copilot', 'gemini', 'amazon-q',
        'qwen', 'kilocode', 'auggie', 'kiro', 'lingma', 'junie',
        'codebuddy', 'costrict', 'crush', 'factory', 'iflow', 'pi',
        'qoder', 'antigravity', 'bob', 'forgecode', 'trae',
      ];
      for (const id of platformIds) {
        expect(SKILLS_AGENT_MAP).toHaveProperty(id);
      }
      expect(Object.keys(SKILLS_AGENT_MAP)).toHaveLength(28);
    });
  });

  describe('installSuperpowersForPlatforms', () => {
    it('installs superpowers for valid platform ids', async () => {
      mockedExecSync.mockReturnValueOnce(Buffer.from('installed'));

      const { installSuperpowersForPlatforms } = await import('../../src/core/superpowers.js');
      const result = await installSuperpowersForPlatforms('/tmp/test', 'project', ['claude', 'cursor']);

      expect(result).toBe('installed');
      const cmd = mockedExecSync.mock.calls[0][0] as string;
      expect(cmd).toContain('npx skills add obra/superpowers');
      expect(cmd).toContain('--agent claude-code,cursor');
      expect(cmd).toContain('-y');
    });

    it('passes -g flag for global scope', async () => {
      mockedExecSync.mockReturnValueOnce(Buffer.from('installed'));

      const { installSuperpowersForPlatforms } = await import('../../src/core/superpowers.js');
      await installSuperpowersForPlatforms('/tmp/test', 'global', ['claude']);

      const cmd = mockedExecSync.mock.calls[0][0] as string;
      expect(cmd).toContain('-g');
    });

    it('throws when unknown platform ids are passed', async () => {
      const { installSuperpowersForPlatforms } = await import('../../src/core/superpowers.js');
      await expect(
        installSuperpowersForPlatforms('/tmp/test', 'project', ['unknown-platform']),
      ).rejects.toThrow('Unknown platform IDs: unknown-platform');
      expect(mockedExecSync).not.toHaveBeenCalled();
    });

    it('returns failed when execSync throws', async () => {
      mockedExecSync.mockImplementationOnce(() => {
        throw new Error('install failed');
      });

      const { installSuperpowersForPlatforms } = await import('../../src/core/superpowers.js');
      const result = await installSuperpowersForPlatforms('/tmp/test', 'project', ['claude']);

      expect(result).toBe('failed');
    });

    it('throws when mixed with unknown platform ids', async () => {
      const { installSuperpowersForPlatforms } = await import('../../src/core/superpowers.js');
      await expect(
        installSuperpowersForPlatforms('/tmp/test', 'project', ['claude', 'unknown-1', 'cursor', 'unknown-2']),
      ).rejects.toThrow('Unknown platform IDs: unknown-1, unknown-2');
    });
  });
});
