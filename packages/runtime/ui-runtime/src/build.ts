import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, writeFileSync, rmSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, '..', 'build');

if (!existsSync(buildDir)) mkdirSync(buildDir, { recursive: true });
rmSync(join(buildDir, 'main.js'), { force: true });
rmSync(join(buildDir, 'main.js.map'), { force: true });

// 1. Build JS first — Tailwind needs the bundle to scan for class names
execFileSync(
  'bun',
  [
    'build',
    join(__dirname, 'client', 'no-auth-entry.ts'),
    '--target=browser',
    '--format=esm',
    '--sourcemap=linked',
    '--minify',
    `--outdir=${buildDir}`,
    '--entry-naming=main.js',
  ],
  { stdio: 'inherit' },
);
console.log('JS built → build/main.js');

// 2. Build CSS with Tailwind CSS 4 — scans build/main.js via @source directive
try {
  execFileSync(
    'bunx',
    [
      '--no-install',
      'tailwindcss',
      '-i',
      join(__dirname, 'client', 'styles.css'),
      '-o',
      join(buildDir, 'main.css'),
      '--minify',
    ],
    { stdio: 'inherit' },
  );
  console.log('CSS built → build/main.css');
} catch {
  console.warn('Tailwind CSS build failed — generating empty main.css');
  writeFileSync(join(buildDir, 'main.css'), '/* tailwind css build failed */\n');
}
