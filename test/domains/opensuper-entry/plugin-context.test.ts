import { beforeEach, describe, expect, test, vi } from 'vitest';

const bridge = vi.hoisted(() => ({
  collectContext: vi.fn(),
  diagnostics: vi.fn(),
}));

vi.mock('../../../domains/opensuper-plugin/index.js', () => ({
  createDefaultOpenSuperPluginBridge: vi.fn(async () => bridge),
}));

import { collectOpenSuperPluginContext } from '../../../domains/opensuper-entry/plugin-context.js';

describe('OpenSuper plugin context boundary', () => {
  beforeEach(() => {
    bridge.collectContext.mockReset();
    bridge.diagnostics.mockReset();
    bridge.diagnostics.mockResolvedValue([]);
  });

  test('passes through the single Agent Context assembled by the bridge', async () => {
    bridge.collectContext.mockResolvedValue([
      {
        pluginId: 'opensuper.context-director',
        text: '<agent_context>\n<context_manifest />\n</agent_context>',
        episodeId: 'context:one',
        manifest: [],
        applications: [],
      },
    ]);

    await expect(
      collectOpenSuperPluginContext(process.cwd(), { task: '测试上下文' }),
    ).resolves.toEqual([
      {
        pluginId: 'opensuper.context-director',
        text: '<agent_context>\n<context_manifest />\n</agent_context>',
        episodeId: 'context:one',
        manifest: [],
        applications: [],
      },
    ]);
  });

  test('keeps an empty bridge response empty', async () => {
    bridge.collectContext.mockResolvedValue([]);

    await expect(collectOpenSuperPluginContext(process.cwd(), { task: '兼容性' })).resolves.toEqual(
      [],
    );
  });
});
