import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    passWithNoTests: true,
    environment: 'node',
    reporters: 'default',
    testTimeout: 15_000,
  },
});
