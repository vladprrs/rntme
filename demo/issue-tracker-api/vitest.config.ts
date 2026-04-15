import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const pkg = (name: string) =>
  resolve(__dirname, '../../packages', name, 'src/index.ts');

export default defineConfig({
  resolve: {
    alias: {
      '@rntme/bindings': pkg('bindings'),
      '@rntme/bindings-http': pkg('bindings-http'),
      '@rntme/event-store': pkg('event-store'),
      '@rntme/graph-ir-compiler': pkg('graph-ir-compiler'),
      '@rntme/pdm': pkg('pdm'),
      '@rntme/projection-consumer': pkg('projection-consumer'),
      '@rntme/qsm': pkg('qsm'),
      '@rntme/ui': pkg('ui'),
      '@rntme/ui-runtime': pkg('ui-runtime'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
