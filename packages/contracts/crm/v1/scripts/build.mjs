import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const require = createRequire(resolve(pkgRoot, 'package.json'));
const tsc = require.resolve('typescript/bin/tsc');

const tscResult = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.json'], {
  stdio: 'inherit',
  cwd: pkgRoot,
});

if (tscResult.error) throw tscResult.error;
if (tscResult.status !== 0) process.exit(tscResult.status ?? 1);

mkdirSync(resolve(pkgRoot, 'dist'), { recursive: true });
copyFileSync(resolve(pkgRoot, 'src/proto.gen.d.ts'), resolve(pkgRoot, 'dist/proto.gen.d.ts'));
copyFileSync(resolve(pkgRoot, 'src/proto.gen.js'), resolve(pkgRoot, 'dist/proto.gen.js'));
