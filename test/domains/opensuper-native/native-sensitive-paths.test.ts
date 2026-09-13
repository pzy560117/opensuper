import { describe, expect, it } from 'vitest';

import { nativeSensitiveRelativePathReason } from '../../../domains/opensuper-native/native-sensitive-paths.js';

describe('Native sensitive path classification', () => {
  it('classifies OpenSuper runtime configuration and selection files', () => {
    expect(nativeSensitiveRelativePathReason('.opensuper/config.yaml')).toBe('opensuper-config');
    expect(nativeSensitiveRelativePathReason('.opensuper/current-change.json')).toBe(
      'opensuper-selection',
    );
  });
});
