import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, '..', 'build');

if (!existsSync(buildDir)) mkdirSync(buildDir, { recursive: true });

// Build CSS with Tailwind CSS 4
try {
  execSync(
    `npx @tailwindcss/cli -i ${join(__dirname, 'client', 'styles.css')} -o ${join(buildDir, 'main.css')} --minify`,
    { stdio: 'inherit' },
  );
  console.log('CSS built → build/main.css');
} catch {
  console.warn('Tailwind CSS build failed — generating empty main.css');
  writeFileSync(join(buildDir, 'main.css'), '/* tailwind css build failed */\n');
}

// Build JS with esbuild
await build({
  entryPoints: [join(__dirname, 'client', 'entry.tsx')],
  outfile: join(buildDir, 'main.js'),
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

console.log('JS built → build/main.js');
