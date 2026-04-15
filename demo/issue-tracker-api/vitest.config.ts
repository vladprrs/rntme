import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const pkg = (name: string) =>
  resolve(__dirname, '../../packages', name, 'src/index.ts');

export default defineConfig({
  resolve: {
    alias: {
      '@rntme/runtime': pkg('runtime'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
