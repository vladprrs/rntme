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
import { SqliteEventStore } from '@rntme/event-store';
import { loadSeed } from '../load.js';
import { applySeed } from '../apply.js';
import type { ApplyMode, SeedError } from '../types.js';

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
    console.error('usage: rntme-seed validate <artifacts-dir> [--path <file>] [--json]');
    return 1;
  }
  const pathArg = getFlag(args, '--path');
  const asJson = args.includes('--json');
  const seedPath = join(dir, pathArg ?? 'seed.json');

  if (!existsSync(seedPath)) {
    if (asJson) console.log('[]');
    return 0;
  }

  const ctx = buildCtx(dir);
  if (ctx === null) {
    console.error(`cannot read or validate pdm.json in ${dir}`);
    return 1;
  }

  const result = loadSeed(seedPath, ctx);
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
      'usage: rntme-seed apply <artifacts-dir> --event-store <path> [--mode strict|upsert-by-event-id] [--dry-run]',
    );
    return 1;
  }

  const mode = resolveApplyMode(modeArg);
  if (mode === null) {
    console.error(`invalid --mode ${JSON.stringify(modeArg)} (use strict or upsert-by-event-id)`);
    return 1;
  }

  const ctx = buildCtx(dir);
  if (ctx === null) {
    console.error(`cannot read or validate pdm.json in ${dir}`);
    return 1;
  }
  const pathArg = getFlag(args, '--path');
  const seedPath = join(dir, pathArg ?? 'seed.json');
  if (!existsSync(seedPath)) {
    console.error(`no seed.json at ${seedPath}`);
    return 1;
  }

  const result = loadSeed(seedPath, ctx);
  if (!result.ok) {
    emitErrors(result.errors, false);
    return 1;
  }
  if (dryRun) {
    console.log(`would apply ${result.value.events.length} events (mode=${mode})`);
    return 0;
  }

  const store = new SqliteEventStore({ filename: eventStorePath });
  try {
    const r = await applySeed(result.value, store, { mode });
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

function buildCtx(dir: string) {
  const pdmPath = join(dir, 'pdm.json');
  if (!existsSync(pdmPath)) return null;
  const raw = JSON.parse(readFileSync(pdmPath, 'utf8'));
  const parsed = parsePdm(raw);
  if (!parsed.ok) return null;
  const validated = validatePdm(parsed.value);
  if (!validated.ok) return null;
  return {
    pdm: createPdmResolver(validated.value),
    events: deriveEventTypes(validated.value),
  };
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
