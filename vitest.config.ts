import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/ts/**/*.test.ts'],
    // Git Bash-backed integration tests routinely exceed Vitest's 5s default on Windows.
    testTimeout: process.platform === 'win32' ? 60_000 : 5_000,
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
