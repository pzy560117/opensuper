import { describe, expect, it } from 'vitest';
import {
  OPENSUPER_BANNER,
  applyBulkOverwriteChoice,
  getSetupTargetLabel,
} from '../../src/commands/init.js';

describe('init command helpers', () => {
  it('can apply a single overwrite choice to all existing components on a platform', () => {
    const plan = {
      osAction: 'install' as const,
      spAction: 'install' as const,
      cmAction: 'install' as const,
    };

    expect(applyBulkOverwriteChoice(plan, 'overwrite-all')).toEqual({
      osAction: 'overwrite',
      spAction: 'overwrite',
      cmAction: 'overwrite',
    });
    expect(applyBulkOverwriteChoice(plan, 'skip-all')).toEqual({
      osAction: 'skip',
      spAction: 'skip',
      cmAction: 'skip',
    });
  });

  it('shows the OpenSuper brand in the interactive banner', () => {
    expect(OPENSUPER_BANNER).toContain('OpenSuper');
  });

  it('does not expose the absolute current working directory in interactive setup copy', () => {
    expect(getSetupTargetLabel('.')).toBe('current directory');
  });
});
