import { beforeEach, describe, expect, it, vi } from 'vitest';

const collectOpenSuperPluginContext = vi.fn();
const expandOpenSuperPluginContext = vi.fn();
const recordOpenSuperContextOutcome = vi.fn();
const recordOpenSuperWorkflowResult = vi.fn();

vi.mock('../../domains/opensuper-entry/plugin-context.js', () => ({
  collectOpenSuperPluginContext,
  expandOpenSuperPluginContext,
  recordOpenSuperContextOutcome,
  recordOpenSuperWorkflowResult,
}));

describe('ordinary OpenSuper task host', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shares identity during the task request and refreshes it on the next invocation', async () => {
    const { resolveProjectName, resolveStableProjectId } =
      await import('../../platform/paths/project-identity.js');
    const { opensuperTaskCommand } = await import('../../app/commands/opensuper-task.js');
    let remote = 'https://example.com/first.git';
    const runGit = vi.fn(() => remote);
    const identities: string[] = [];
    collectOpenSuperPluginContext.mockImplementation(async (root: string) => {
      identities.push(resolveStableProjectId(root, { runGit }));
      await Promise.resolve();
      expect(resolveProjectName(root, { runGit })).toBe(
        remote.includes('first') ? 'first' : 'second',
      );
      return [];
    });
    await opensuperTaskCommand('D:/repo', { task: 'Inspect the project' });
    remote = 'https://example.com/second.git';
    await opensuperTaskCommand('D:/repo', { task: 'Inspect the project' });
    expect(identities[0]).not.toBe(identities[1]);
    expect(runGit).toHaveBeenCalledTimes(2);
  });

  it('records a completion checkpoint without selecting fresh context', async () => {
    collectOpenSuperPluginContext.mockResolvedValue([
      { pluginId: 'opensuper.personal-memory', text: '使用中文' },
    ]);
    const { opensuperTaskCommand } = await import('../../app/commands/opensuper-task.js');

    const result = await opensuperTaskCommand('D:/repo', {
      task: '修复接口',
      path: 'src/api.ts',
      phase: 'build',
      complete: true,
      workflow: 'native',
      change: 'change-1',
      json: true,
    });

    expect(collectOpenSuperPluginContext).not.toHaveBeenCalled();
    expect(recordOpenSuperWorkflowResult).toHaveBeenCalledWith(
      expect.objectContaining({
        projectRoot: expect.stringMatching(/D:[\\/]repo/u),
        workflow: 'native',
        changeId: 'change-1',
        command: 'task',
      }),
    );
    expect(recordOpenSuperWorkflowResult.mock.calls[0]?.[0]).not.toHaveProperty('summary');
    expect(recordOpenSuperWorkflowResult.mock.calls[0]?.[0]).not.toHaveProperty('userEvidence');
    expect(result.context).toEqual([]);
  });

  it('uses the shared progressive expansion and application outcome interfaces', async () => {
    expandOpenSuperPluginContext.mockResolvedValue({
      id: 'knowledge-1',
      title: '验证约束',
      content: '运行 pnpm lint',
      whyApplied: '当前操作匹配',
      sources: [],
      verification: [{ command: 'pnpm lint' }],
    });
    const { opensuperTaskCommand } = await import('../../app/commands/opensuper-task.js');

    const expansion = await opensuperTaskCommand('D:/repo', {
      task: '验证变更',
      phase: 'verify',
      operation: 'lint',
      session: 'session-1',
      contextBudget: '1200',
      expandContext: 'knowledge-1',
      json: true,
    });
    expect(expandOpenSuperPluginContext).toHaveBeenCalledWith(
      expect.stringMatching(/D:[\\/]repo/u),
      'knowledge-1',
      {
        task: '验证变更',
        phase: 'verify',
        operation: 'lint',
        sessionId: 'session-1',
        charBudget: 1200,
      },
    );
    expect(expansion.expansion).toMatchObject({ id: 'knowledge-1' });
    expect(collectOpenSuperPluginContext).not.toHaveBeenCalled();

    await opensuperTaskCommand('D:/repo', {
      task: '验证变更',
      application: 'application-1',
      outcome: 'used-successfully',
      json: true,
    });
    expect(recordOpenSuperContextOutcome).toHaveBeenCalledWith({
      projectRoot: expect.stringMatching(/D:[\\/]repo/u),
      applicationId: 'application-1',
      outcome: 'used-successfully',
    });
    expect(collectOpenSuperPluginContext).not.toHaveBeenCalled();
  });

  it('requires application and outcome together', async () => {
    const { opensuperTaskCommand } = await import('../../app/commands/opensuper-task.js');
    await expect(
      opensuperTaskCommand('D:/repo', {
        task: '验证变更',
        application: 'application-1',
      }),
    ).rejects.toThrow('--application and --outcome');
  });

  it('records the concrete adoption decision and actual verification without running a command', async () => {
    const { opensuperTaskCommand } = await import('../../app/commands/opensuper-task.js');
    await opensuperTaskCommand('D:/repo', {
      task: 'Fix router',
      application: 'application-1',
      outcome: 'used-successfully',
      decision: 'Rebuild the entry bundle',
      verification: 'pnpm check:generated',
      verificationResult: 'passed',
      json: true,
    });
    expect(recordOpenSuperContextOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        evidence: {
          decision: 'Rebuild the entry bundle',
          verification: { command: 'pnpm check:generated', success: true },
        },
      }),
    );
    await expect(
      opensuperTaskCommand('D:/repo', {
        task: 'Fix router',
        application: 'application-1',
        outcome: 'used-successfully',
        decision: 'Rebuild',
      }),
    ).rejects.toThrow('Adoption evidence requires');
  });

  it('reports an unavailable explicit context expansion', async () => {
    expandOpenSuperPluginContext.mockResolvedValue(null);
    const { opensuperTaskCommand } = await import('../../app/commands/opensuper-task.js');
    await expect(
      opensuperTaskCommand('D:/repo', {
        task: '展开上下文',
        expandContext: 'missing-context',
      }),
    ).rejects.toThrow('Unknown or unavailable context: missing-context');
  });

  it('prints expanded context details in the ordinary text output', async () => {
    expandOpenSuperPluginContext.mockResolvedValue({
      id: 'knowledge-1',
      title: '验证约束',
      content: '运行 pnpm lint',
      whyApplied: '当前操作匹配',
      sources: [{ type: 'repository', source: 'AGENTS.md' }],
      verification: [{ command: 'pnpm lint', expected: 'pass' }],
    });
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { opensuperTaskCommand } = await import('../../app/commands/opensuper-task.js');

    await opensuperTaskCommand('D:/repo', {
      task: '展开上下文',
      expandContext: 'knowledge-1',
    });

    expect(output).toHaveBeenCalledWith(expect.stringContaining('验证约束'));
    expect(output).toHaveBeenCalledWith(expect.stringContaining('运行 pnpm lint'));
    expect(output).toHaveBeenCalledWith(expect.stringContaining('AGENTS.md'));
    expect(output).toHaveBeenCalledWith(expect.stringContaining('pnpm lint'));
    output.mockRestore();
  });
});
