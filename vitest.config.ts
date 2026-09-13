import { realpathSync } from 'node:fs';
import os from 'node:os';

import { defineConfig } from 'vitest/config';

if (process.platform === 'win32') {
  const canonicalTemp = realpathSync.native(os.tmpdir());
  process.env.TEMP = canonicalTemp;
  process.env.TMP = canonicalTemp;
  process.env.TMPDIR = canonicalTemp;
}

export default defineConfig({
  test: {
    testTimeout: 120_000,
    // Git-heavy fixtures can exceed Vitest's 10s hook default under bounded full-suite concurrency.
    hookTimeout: 120_000,
    // Several test files spawn their own subprocesses and platform-install loops.
    // Bound file-level parallelism so nested work does not starve individual tests.
    maxWorkers: process.platform === 'win32' ? 2 : 4,
    include: ['test/**/*.test.ts'],
    exclude: [
      // Benchmark tests are developer-only tools, not part of CI validation
      'test/**/context-compression-benchmark.test.ts',
      'test/**/context-execution-benchmark.test.ts',
    ],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['app/**/*.ts', 'domains/**/*.ts', 'platform/**/*.ts'],
      exclude: [
        // Classic runtime behavior is generated to .mjs and exercised through subprocess smoke tests.
        'domains/opensuper-classic/**',
      ],
      thresholds: {
        branches: 75,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
