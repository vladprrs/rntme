#!/usr/bin/env node
/* eslint-disable no-console -- CLI entrypoint */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  parsePdm,
  validatePdm,
  createPdmResolver,
  deriveEventTypes,
} from '@rntme/pdm';
import type { PdmError } from '@rntme/pdm';
import { SqliteEventStore } from '@rntme/event-store';
import { loadSeed } from '../load.js';
import { applySeed } from '../apply.js';
import type { ApplyMode, SeedError } from '../types.js';

const DEFAULT_SERVICE_NAME = 'rntme-seed';

type BuildCtx = {
  pdm: ReturnType<typeof createPdmResolver>;
  events: ReturnType<typeof deriveEventTypes>;
  serviceName: string;
};

type BuildCtxResult =
  | { ok: true; value: BuildCtx }
  | { ok: false; message: string; errors?: readonly PdmError[] };

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const [cmd, ...rest] = args;
  if (cmd === 'validate') return runValidate(rest);
  if (cmd === 'apply') return await runApply(rest);
  printUsage();
  return cmd === undefined ? 0 : 1;
}

function runValidate(args: string[]): number {
  const dir = args.find((a) => !a.startsWith('--'));
  if (!dir) {
    console.error(
      'usage: rntme-seed validate <artifacts-dir> [--path <file>] [--service-name <name>] [--json]',
    );
    return 1;
  }
  const pathArg = getFlag(args, '--path');
  const asJson = args.includes('--json');
  const seedPath = join(dir, pathArg ?? 'seed.json');

  if (!existsSync(seedPath)) {
    if (asJson) console.log('[]');
    return 0;
  }

  const serviceName = resolveServiceName(args, dir);
  const ctx = buildCtx(dir, serviceName);
  if (!ctx.ok) {
    emitBuildCtxFailure(ctx);
    return 1;
  }

  const result = loadSeed(seedPath, ctx.value);
  if (result.ok) {
    if (asJson) console.log('[]');
    else console.log(`ok: ${result.value.events.length} events`);
    return 0;
  }
  emitErrors(result.errors, asJson);
  return 1;
}

async function runApply(args: string[]): Promise<number> {
  const dir = args.find((a) => !a.startsWith('--'));
  const eventStorePath = getFlag(args, '--event-store');
  const modeArg = getFlag(args, '--mode');
  const dryRun = args.includes('--dry-run');

  if (!dir || !eventStorePath) {
    console.error(
      'usage: rntme-seed apply <artifacts-dir> --event-store <path> [--mode strict|upsert-by-event-id] [--service-name <name>] [--dry-run]',
    );
    return 1;
  }

  const mode = resolveApplyMode(modeArg);
  if (mode === null) {
    console.error(`invalid --mode ${JSON.stringify(modeArg)} (use strict or upsert-by-event-id)`);
    return 1;
  }

  const serviceName = resolveServiceName(args, dir);
  const ctx = buildCtx(dir, serviceName);
  if (!ctx.ok) {
    emitBuildCtxFailure(ctx);
    return 1;
  }
  const pathArg = getFlag(args, '--path');
  const seedPath = join(dir, pathArg ?? 'seed.json');
  if (!existsSync(seedPath)) {
    console.error(`no seed.json at ${seedPath}`);
    return 1;
  }

  const result = loadSeed(seedPath, ctx.value);
  if (!result.ok) {
    emitErrors(result.errors, false);
    return 1;
  }
  if (dryRun) {
    console.log(`would apply ${result.value.events.length} events (mode=${mode})`);
    return 0;
  }

  const store = new SqliteEventStore({ filename: eventStorePath, serviceName });
  try {
    const r = await applySeed(result.value, store, { mode, serviceName });
    console.log(`applied=${r.appliedCount} skipped=${r.skippedCount}`);
    return 0;
  } catch (err) {
    const e = err as SeedError;
    console.error(`${e.code}: ${e.message}`);
    return 1;
  } finally {
    store.close();
  }
}

function resolveApplyMode(modeArg: string | undefined): ApplyMode | null {
  if (modeArg === undefined || modeArg === 'upsert-by-event-id') return 'upsertByEventId';
  if (modeArg === 'strict') return 'strict';
  return null;
}

/**
 * Resolve serviceName in priority order:
 *   1. `--service-name <name>` CLI flag
 *   2. `serviceName` field in `<dir>/manifest.json` (when present)
 *   3. Default DEFAULT_SERVICE_NAME
 */
function resolveServiceName(args: string[], dir: string): string {
  const flag = getFlag(args, '--service-name');
  if (flag && flag.length > 0) return flag;
  const manifestPath = join(dir, 'manifest.json');
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        serviceName?: unknown;
      };
      if (typeof manifest.serviceName === 'string' && manifest.serviceName.length > 0) {
        return manifest.serviceName;
      }
    } catch {
      // fall through to default
    }
  }
  return DEFAULT_SERVICE_NAME;
}

function buildCtx(dir: string, serviceName: string): BuildCtxResult {
  const pdmPath = join(dir, 'pdm.json');
  const message = `cannot read or validate pdm.json in ${dir}`;
  if (!existsSync(pdmPath)) return { ok: false, message };
  const raw = readFileSync(pdmPath, 'utf8');
  const parsed = parsePdm(raw);
  if (!parsed.ok) return { ok: false, message, errors: parsed.errors };
  const validated = validatePdm(parsed.value);
  if (!validated.ok) return { ok: false, message, errors: validated.errors };
  return {
    ok: true,
    value: {
      pdm: createPdmResolver(validated.value),
      events: deriveEventTypes(validated.value),
      serviceName,
    },
  };
}

function emitBuildCtxFailure(result: Extract<BuildCtxResult, { ok: false }>): void {
  console.error(result.message);
  for (const e of result.errors ?? []) {
    const prefix = e.path ? `pdm.json ${e.path}: ` : 'pdm.json: ';
    console.error(`${prefix}${e.code} ${e.message}`);
  }
}

function emitErrors(errors: readonly SeedError[], asJson: boolean): void {
  if (asJson) {
    console.log(JSON.stringify(errors, null, 2));
    return;
  }
  for (const e of errors) {
    const prefix = e.path ? `${e.path}: ` : '';
    console.error(`${prefix}${e.code} ${e.message}`);
  }
}

function getFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1];
}

function printUsage(): void {
  console.error('usage: rntme-seed {validate | apply} ...');
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
