import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const repoRoot = resolve(pkgRoot, '../../../..');

const require = createRequire(resolve(pkgRoot, 'package.json'));
const cliDir = dirname(require.resolve('protobufjs-cli/package.json'));
const pbjs = resolve(cliDir, 'bin/pbjs');
const pbts = resolve(cliDir, 'bin/pbts');

const protoEntry = resolve(pkgRoot, 'proto/ai_llm-events.proto');
const outJs = resolve(pkgRoot, 'src/proto.gen.js');
const outDts = resolve(pkgRoot, 'src/proto.gen.d.ts');
const pbjsRoot = resolve(pkgRoot, 'node_modules/protobufjs');

const protoDeps = resolve(pkgRoot, 'proto-deps');
rmSync(protoDeps, { recursive: true, force: true });
mkdirSync(resolve(protoDeps, 'rntme/contracts/common/v1'), { recursive: true });
mkdirSync(resolve(protoDeps, 'rntme/contracts/ai_llm/v1'), { recursive: true });
symlinkSync(
  resolve(repoRoot, 'packages/contracts/_common/v1/proto/common.proto'),
  resolve(protoDeps, 'rntme/contracts/common/v1/common.proto'),
);
symlinkSync(resolve(pkgRoot, 'proto/ai_llm.proto'), resolve(protoDeps, 'rntme/contracts/ai_llm/v1/ai_llm.proto'));

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: pkgRoot });
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

run(
  `node "${pbjs}" --target static-module --wrap es6 --es6 --keep-case ` +
    `--path ${pbjsRoot} --path ${protoDeps} --path ${resolve(pkgRoot, 'proto')} ` +
    `--out ${outJs} ${protoEntry}`,
);
patchPbjsEsmImports(outJs);
run(`node "${pbts}" --out ${outDts} ${outJs}`);

console.log('Codegen complete.');
