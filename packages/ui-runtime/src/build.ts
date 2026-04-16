import { build } from 'esbuild';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [join(__dirname, 'client', 'entry.tsx')],
  outfile: join(__dirname, '..', 'build', 'main.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  loader: {
    '.css': 'empty',
  },
  external: [],
});

console.log('Client bundle built → build/main.js');
