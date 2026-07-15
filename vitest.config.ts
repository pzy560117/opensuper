import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/ts/**/*.test.ts'],
    // Concurrent Git Bash workers contend heavily and leave nested shells behind after timeouts.
    fileParallelism: process.platform !== 'win32',
    // Some integration cases invoke several Git Bash scripts and exceed two minutes on Windows.
    testTimeout: process.platform === 'win32' ? 300_000 : 5_000,
    exclude: [
      // Benchmark tests are developer-only tools, not part of CI validation
      'test/ts/context-compression-benchmark.test.ts',
      'test/ts/context-execution-benchmark.test.ts',
    ],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: [
        'src/cli/**',
        // Commands are interactive orchestrators best tested via E2E
        'src/commands/**',
      ],
      thresholds: {
        branches: 70,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
