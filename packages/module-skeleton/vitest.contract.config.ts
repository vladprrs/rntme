import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/public-contract/**/*.test.ts'],
    environment: 'node',
    reporters: 'default',
    testTimeout: 15_000,
  },
});
