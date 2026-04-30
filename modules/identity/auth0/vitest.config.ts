import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environmentMatchGlobs: [
      ['test/unit/client/**/*.test.{ts,tsx}', 'jsdom'],
      ['test/unit/boot.test.ts', 'jsdom'],
    ],
    environment: 'node',
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
