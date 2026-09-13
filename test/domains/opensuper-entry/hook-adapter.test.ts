import { describe, expect, it } from 'vitest';
import path from 'path';

import {
  OPENSUPER_HOOK_PLATFORM_IDS,
  parseOpenSuperHookRequest,
  renderOpenSuperHookDecision,
} from '../../../domains/opensuper-entry/hook-adapter.js';

const PLATFORM_FIXTURES = [
  {
    id: 'claude',
    single: { tool_name: 'Write', tool_input: { file_path: 'src/claude.ts' } },
  },
  {
    id: 'codex',
    single: { tool_name: 'Edit', tool_input: { file_path: 'src/codex.ts' } },
  },
  {
    id: 'windsurf',
    single: { file_path: 'src/windsurf.ts' },
  },
  {
    id: 'github-copilot',
    single: { toolName: 'create', toolArgs: '{"file_path":"src/github-copilot.ts"}' },
  },
  {
    id: 'gemini',
    single: { tool_name: 'write_file', tool_input: { file_path: 'src/gemini.ts' } },
  },
  {
    id: 'amazon-q',
    single: { tool_name: 'Write', tool_input: { file_path: 'src/amazon-q.ts' } },
  },
  {
    id: 'qwen',
    single: { tool_name: 'WriteFile', tool_input: { file_path: 'src/qwen.ts' } },
  },
  {
    id: 'kiro',
    single: {
      tool_name: 'write',
      tool_input: { operations: [{ mode: 'Line', path: 'src/kiro.ts' }] },
    },
  },
  {
    id: 'codebuddy',
    single: { tool_name: 'Write', tool_input: { file_path: 'src/codebuddy.ts' } },
  },
  {
    id: 'workbuddy',
    single: { tool_name: 'Write', tool_input: { file_path: 'src/workbuddy.ts' } },
  },
  {
    id: 'oh-my-pi',
    single: { tool_name: 'write', tool_input: { path: 'src/oh-my-pi.ts' } },
  },
  {
    id: 'qoder',
    single: { tool_name: 'Write', tool_input: { file_path: 'src/qoder.ts' } },
  },
  {
    id: 'trae',
    single: { tool_name: 'Write', tool_input: { file_path: 'src/trae.ts' } },
  },
  {
    id: 'trae-cn',
    single: { tool_name: 'Write', tool_input: { file_path: 'src/trae-cn.ts' } },
  },
  {
    id: 'grok',
    single: { toolName: 'write', toolInput: { file_path: 'src/grok.ts' } },
  },
] as const;

describe('OpenSuper Hook platform adapter', () => {
  it('keeps the fixture matrix aligned with every declared Hook platform', () => {
    expect(PLATFORM_FIXTURES.map(({ id }) => id)).toEqual([...OPENSUPER_HOOK_PLATFORM_IDS]);
  });

  it('parses a payload carrying a leading UTF-8 BOM', () => {
    const source =
      String.fromCharCode(0xfeff) +
      JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'src/a.ts' } });
    expect(parseOpenSuperHookRequest(source)).toEqual({
      intent: 'write',
      targets: ['src/a.ts'],
      toolName: 'Write',
    });
  });

  it.each(PLATFORM_FIXTURES)('normalizes the $id native single-file payload', ({ id, single }) => {
    expect(parseOpenSuperHookRequest(JSON.stringify(single))).toMatchObject({
      intent: 'write',
      targets: [`src/${id}.ts`],
    });
  });

  it('normalizes Claude and Copilot payloads', () => {
    expect(
      parseOpenSuperHookRequest(
        JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'src/a.ts' } }),
      ),
    ).toEqual({ intent: 'write', targets: ['src/a.ts'], toolName: 'Write' });
    expect(
      parseOpenSuperHookRequest(
        JSON.stringify({
          toolName: 'apply_patch',
          toolArgs: { patch: '*** Update File: src/b.ts' },
        }),
      ),
    ).toEqual({ intent: 'write', targets: ['src/b.ts'], toolName: 'apply_patch' });
    expect(
      parseOpenSuperHookRequest(
        JSON.stringify({
          toolName: 'search_replace',
          toolInput: { file_path: 'src/c.ts' },
        }),
      ),
    ).toEqual({ intent: 'write', targets: ['src/c.ts'], toolName: 'search_replace' });
  });

  it('normalizes raw Codex apply_patch input from Hook stdin', () => {
    const patch = [
      '*** Begin Patch',
      '*** Update File: src/existing.ts',
      '*** Add File: src/new.ts',
      '*** Delete File: src/old.ts',
      '*** End Patch',
    ].join('\n');

    expect(parseOpenSuperHookRequest(patch)).toEqual({
      intent: 'write',
      targets: ['src/existing.ts', 'src/new.ts', 'src/old.ts'],
      toolName: 'apply_patch',
    });
  });

  it('normalizes standard unified-diff headers from raw patch input', () => {
    const patch = ['--- a/src/old.ts', '+++ b/src/new.ts'].join('\n');

    expect(parseOpenSuperHookRequest(patch)).toEqual({
      intent: 'write',
      targets: ['src/new.ts'],
      toolName: 'apply_patch',
    });
  });

  it('keeps an absolute Hook working directory for linked-worktree routing', () => {
    const cwd = path.resolve('linked-worktree');
    expect(
      parseOpenSuperHookRequest(
        JSON.stringify({
          tool_name: 'Write',
          cwd,
          tool_input: { file_path: 'src/a.ts' },
        }),
      ),
    ).toEqual({ intent: 'write', targets: ['src/a.ts'], toolName: 'Write', cwd });
    expect(
      parseOpenSuperHookRequest(
        JSON.stringify({
          tool_name: 'Write',
          cwd: 'relative/worktree',
          tool_input: { file_path: 'src/a.ts' },
        }),
      ),
    ).toEqual({ intent: 'write', targets: ['src/a.ts'], toolName: 'Write' });
  });

  it('recognizes an agent-start task as a context request', () => {
    const cwd = path.resolve('omp-project');
    expect(
      parseOpenSuperHookRequest(
        JSON.stringify({
          hook_event_name: 'before_agent_start',
          task: 'Implement the dashboard',
          cwd,
          session_id: 'session-file',
        }),
      ),
    ).toEqual({
      intent: 'context',
      targets: [],
      toolName: null,
      task: 'Implement the dashboard',
      cwd,
      sessionId: 'session-file',
    });
  });

  it('collects every target atomically and fails unknown writes closed', () => {
    expect(
      parseOpenSuperHookRequest(
        JSON.stringify({
          tool_name: 'Edit',
          tool_input: { file_paths: ['src/a.ts', 'src/b.ts'] },
        }),
      ),
    ).toEqual({ intent: 'write', targets: ['src/a.ts', 'src/b.ts'], toolName: 'Edit' });
    expect(parseOpenSuperHookRequest('{broken')).toEqual({
      intent: 'unknown',
      targets: [],
      toolName: null,
    });
    expect(
      parseOpenSuperHookRequest(
        JSON.stringify({
          tool_name: 'FutureWriteTool',
          tool_input: { file_path: 'src/future.ts' },
        }),
      ),
    ).toEqual({
      intent: 'unknown',
      targets: ['src/future.ts'],
      toolName: 'FutureWriteTool',
    });
  });

  it('collects nested Kiro operation targets atomically', () => {
    expect(
      parseOpenSuperHookRequest(
        JSON.stringify({
          tool_name: 'write',
          tool_input: {
            operations: [
              { mode: 'Line', path: 'src/a.ts' },
              { mode: 'Line', path: 'src/b.ts' },
            ],
          },
        }),
      ),
    ).toEqual({
      intent: 'write',
      targets: ['src/a.ts', 'src/b.ts'],
      toolName: 'write',
    });
  });

  it.each(PLATFORM_FIXTURES)(
    'handles $id multi-file, patch, non-write, and malformed input',
    () => {
      expect(
        parseOpenSuperHookRequest(
          JSON.stringify({
            tool_name: 'Edit',
            tool_input: { file_paths: ['src/a.ts', 'src/b.ts'] },
          }),
        ),
      ).toMatchObject({ intent: 'write', targets: ['src/a.ts', 'src/b.ts'] });
      expect(
        parseOpenSuperHookRequest(
          JSON.stringify({
            tool_name: 'apply_patch',
            tool_input: {
              patch: '*** Update File: src/a.ts\n*** Add File: src/b.ts',
            },
          }),
        ),
      ).toMatchObject({ intent: 'write', targets: ['src/a.ts', 'src/b.ts'] });
      expect(
        parseOpenSuperHookRequest(
          JSON.stringify({ tool_name: 'Read', tool_input: { path: 'src/a.ts' } }),
        ),
      ).toEqual({ intent: 'non-write', targets: [], toolName: 'Read' });
      expect(parseOpenSuperHookRequest('{broken')).toEqual({
        intent: 'unknown',
        targets: [],
        toolName: null,
      });
    },
  );

  it('renders Copilot structured denial without granting permission on allow', () => {
    expect(
      renderOpenSuperHookDecision('github-copilot', { allowed: false, reason: 'blocked' }),
    ).toEqual({
      exitCode: 0,
      stdout: '{"permissionDecision":"deny","permissionDecisionReason":"blocked"}\n',
      stderr: '',
    });
    expect(
      renderOpenSuperHookDecision('github-copilot', { allowed: true, reason: 'allowed' }),
    ).toEqual({
      exitCode: 0,
      stdout: '{}\n',
      stderr: '',
    });
  });

  it.each(PLATFORM_FIXTURES.filter(({ id }) => id !== 'github-copilot'))(
    'renders $id allow and deny through its exit-code protocol',
    ({ id }) => {
      expect(renderOpenSuperHookDecision(id, { allowed: true, reason: 'allowed' })).toEqual({
        exitCode: 0,
        stdout: '',
        stderr: '',
      });
      expect(renderOpenSuperHookDecision(id, { allowed: false, reason: 'blocked' })).toEqual({
        exitCode: 2,
        stdout: '',
        stderr: 'blocked\n',
      });
    },
  );

  it('rejects an unknown platform instead of guessing its denial protocol', () => {
    expect(
      renderOpenSuperHookDecision('unknown-platform', { allowed: false, reason: 'blocked' }),
    ).toEqual({
      exitCode: 64,
      stdout: '',
      stderr: 'Unsupported OpenSuper Hook platform: unknown-platform\n',
    });
  });
});
