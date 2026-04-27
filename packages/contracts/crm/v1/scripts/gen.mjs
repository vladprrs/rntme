import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const repoRoot = resolve(pkgRoot, '../../../..');

const require = createRequire(resolve(pkgRoot, 'package.json'));
const cliDir = dirname(require.resolve('protobufjs-cli/package.json'));
const pbjs = resolve(cliDir, 'bin/pbjs');
const pbts = resolve(cliDir, 'bin/pbts');

const protoEntry = resolve(pkgRoot, 'proto/crm-events.proto');
const outJs = resolve(pkgRoot, 'src/proto.gen.js');
const outDts = resolve(pkgRoot, 'src/proto.gen.d.ts');
const pbjsRoot = resolve(pkgRoot, 'node_modules/protobufjs');

const protoDeps = resolve(pkgRoot, 'proto-deps');
rmSync(protoDeps, { recursive: true, force: true });
mkdirSync(resolve(protoDeps, 'rntme/contracts/common/v1'), { recursive: true });
mkdirSync(resolve(protoDeps, 'rntme/contracts/crm/v1'), { recursive: true });
symlinkSync(resolve(repoRoot, 'packages/contracts/_common/v1/proto/common.proto'), resolve(protoDeps, 'rntme/contracts/common/v1/common.proto'));
symlinkSync(resolve(pkgRoot, 'proto/crm.proto'), resolve(protoDeps, 'rntme/contracts/crm/v1/crm.proto'));

function runNodeScript(script, args) {
  console.log(`> node ${[script, ...args].map((part) => JSON.stringify(part)).join(' ')}`);
  const result = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit', cwd: pkgRoot });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function patchPbjsEsmImports(filePath) {
  let js = readFileSync(filePath, 'utf8');
  js = js.replace(
    /import \* as \$protobuf from "protobufjs\/minimal\.js"/g,
    'import $protobuf from "protobufjs/minimal.js"',
  );
  js = js.replace(/import \* as \$protobuf from "protobufjs\/minimal"/g, 'import $protobuf from "protobufjs/minimal.js"');
  writeFileSync(filePath, js);
}

runNodeScript(pbjs, [
  '--target',
  'static-module',
  '--wrap',
  'es6',
  '--es6',
  '--keep-case',
  '--path',
  pbjsRoot,
  '--path',
  protoDeps,
  '--path',
  resolve(pkgRoot, 'proto'),
  '--out',
  outJs,
  protoEntry,
]);
patchPbjsEsmImports(outJs);
runNodeScript(pbts, ['--out', outDts, outJs]);

console.log('Codegen complete.');
