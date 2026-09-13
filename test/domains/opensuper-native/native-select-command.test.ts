import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const inspectNativeStatus = vi.hoisted(() => vi.fn());
const inspectNativePortableStatus = vi.hoisted(() => vi.fn());
const isNativePortableChange = vi.hoisted(() => vi.fn());
const selectNativeChange = vi.hoisted(() => vi.fn());

vi.mock('../../../domains/opensuper-native/native-diagnostics.js', () => ({ inspectNativeStatus }));
vi.mock('../../../domains/opensuper-native/native-portable-status.js', () => ({
  inspectNativePortableStatus,
}));
vi.mock('../../../domains/opensuper-native/native-portable-runtime.js', () => ({
  isNativePortableChange,
}));
vi.mock('../../../domains/opensuper-native/native-selection.js', () => ({ selectNativeChange }));

import { nativeSelectCommand } from '../../../domains/opensuper-native/native-select-command.js';
import {
  defaultProjectConfig,
  writeProjectConfig,
} from '../../../domains/opensuper-native/native-config.js';

describe('Native select command branches', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'opensuper-native-select-command-'));
    await writeProjectConfig(projectRoot, defaultProjectConfig('docs'));
    inspectNativeStatus.mockReset();
    inspectNativePortableStatus.mockReset();
    isNativePortableChange.mockReset();
    selectNativeChange.mockReset();
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it('uses the regular status projection for a non-portable change', async () => {
    isNativePortableChange.mockResolvedValue(false);
    inspectNativeStatus.mockResolvedValue({ continuation: { kind: 'shape' } });

    await expect(nativeSelectCommand(['demo'], projectRoot)).resolves.toMatchObject({
      command: 'select',
      exitCode: 0,
      data: { selected: 'demo', continuation: { kind: 'shape' } },
    });
    expect(inspectNativePortableStatus).not.toHaveBeenCalled();
  });
});
