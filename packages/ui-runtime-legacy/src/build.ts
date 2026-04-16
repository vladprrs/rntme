#!/usr/bin/env tsx
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'build');
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: ['src/client/entry.tsx'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  outfile: join(outDir, 'main.js'),
  sourcemap: true,
  loader: { '.css': 'empty' },
  external: [],
});

writeFileSync(
  join(outDir, 'main.css'),
  `html,body,#root{height:100%;margin:0;font-family:system-ui,sans-serif}\n`,
);
