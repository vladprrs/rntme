import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const generatedFiles = ['src/proto.gen.js', 'src/proto.gen.d.ts'];
const snapshots = new Map(
  generatedFiles.map((relativePath) => {
    const absolutePath = resolve(pkgRoot, relativePath);
    return [absolutePath, readFileSync(absolutePath, 'utf8')];
  }),
);

let generated = false;

try {
  execFileSync(process.execPath, [resolve(here, 'gen.mjs')], {
    cwd: pkgRoot,
    stdio: 'pipe',
  });
  generated = true;

  const changed = [];
  for (const [absolutePath, before] of snapshots) {
    const after = readFileSync(absolutePath, 'utf8');
    if (after !== before) changed.push(absolutePath.replace(`${pkgRoot}/`, ''));
  }

  if (changed.length > 0) {
    console.error(`Generated proto files are out of date: ${changed.join(', ')}`);
    console.error('Run `bun --cwd packages/contracts/identity/v1 run proto:gen` and commit the generated output.');
    process.exitCode = 1;
  }
} finally {
  for (const [absolutePath, contents] of snapshots) {
    writeFileSync(absolutePath, contents);
  }
  rmSync(resolve(pkgRoot, 'proto-deps'), { recursive: true, force: true });
  if (generated && process.exitCode !== 1) {
    console.log('Generated proto files are in sync.');
  }
}
