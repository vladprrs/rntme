import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, '..', 'build');
const sharedBuildOptions = {
  bundle: true,
  format: 'esm' as const,
  platform: 'browser' as const,
  target: 'es2022' as const,
  sourcemap: true,
  loader: {
    '.css': 'empty' as const,
  },
  external: [],
};

if (!existsSync(buildDir)) mkdirSync(buildDir, { recursive: true });

// 1. Build JS first — Tailwind needs the bundle to scan for class names
await build({
  entryPoints: [join(__dirname, 'client', 'no-auth-entry.ts')],
  outfile: join(buildDir, 'main.js'),
  ...sharedBuildOptions,
});
console.log('JS built → build/main.js');

await build({
  stdin: {
    contents: `
      import { mountAuthenticatedApp } from '../../ui-auth-shell/src/index.ts';

      const cfg = window.__RNTME_AUTH_SHELL_CONFIG__;
      const target = document.getElementById('root');
      if (!target) throw new Error('RNTME_ROOT_MISSING');

      void mountAuthenticatedApp({
        ...cfg,
        runtime: {
          ...cfg.runtime,
          target
        }
      }).catch((err) => {
        console.error('[rntme ui-auth-shell]', err);
        target.textContent = err instanceof Error ? err.message : String(err);
      });
    `,
    resolveDir: __dirname,
    sourcefile: 'auth-entry.ts',
    loader: 'ts',
  },
  outfile: join(buildDir, 'app.js'),
  ...sharedBuildOptions,
});
console.log('Auth shell JS built → build/app.js');

// 2. Build CSS with Tailwind CSS 4 — scans build/main.js via @source directive
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
