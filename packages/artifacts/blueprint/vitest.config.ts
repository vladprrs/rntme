import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@rntme/blueprint': resolve(here, 'src/index.ts'),
    },
  },
  test: {
    include: [
      'test/**/*.test.ts',
      '../../../apps/*/blueprint/test/**/*.test.ts',
    ],
    environment: 'node',
  },
});
