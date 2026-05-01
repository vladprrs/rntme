import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const pkg = (...segments: string[]) =>
  resolve(__dirname, '../../packages', ...segments, 'src/index.ts');

export default defineConfig({
  resolve: {
    alias: {
      '@rntme/runtime': pkg('runtime', 'runtime'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
  },
});
