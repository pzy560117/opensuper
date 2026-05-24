import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/ts/**/*.test.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: [
      'src/cli/**',
      // Commands are interactive orchestrators best tested via E2E
      'src/commands/**',
    ],
      thresholds: {
        branches: 74,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
