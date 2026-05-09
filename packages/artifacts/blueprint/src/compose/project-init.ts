import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { EventTypeSpec, PdmResolver } from '@rntme/pdm';
import {
  parseInitArtifact,
  validateInitCrossRef,
  validateInitStructural,
  type ValidatedInitArtifact,
} from '@rntme/init';
import { ERROR_CODES, err, ok, type Result } from '../types/result.js';

export function loadProjectInit(input: {
  readonly rootDir: string;
  readonly services: readonly string[];
  readonly pdm: PdmResolver;
  readonly eventsByService: Readonly<Record<string, readonly EventTypeSpec[]>>;
}): Result<ValidatedInitArtifact | null> {
  const relPath = 'init/init.json';
  const absPath = join(input.rootDir, relPath);
  if (!existsSync(absPath)) return ok(null);

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(absPath, 'utf8'));
  } catch (cause) {
    return initErr(relPath, [cause instanceof Error ? cause.message : String(cause)]);
  }

  const parsed = parseInitArtifact(raw);
  if (!parsed.ok) return initErr(relPath, parsed.errors);

  const structural = validateInitStructural(parsed.value);
  if (!structural.ok) return initErr(relPath, structural.errors);

  const validated = validateInitCrossRef(structural.value, {
    services: input.services,
    pdm: input.pdm,
    eventsByService: input.eventsByService,
    fileExists: (relativePath) => isRegularInitFile(input.rootDir, relativePath),
    readJson: (relativePath) => readInitJson(input.rootDir, relativePath),
  });
  if (!validated.ok) return initErr(relPath, validated.errors);

  return ok(validated.value);
}

function isRegularInitFile(rootDir: string, relativePath: string): boolean {
  try {
    return statSync(join(rootDir, 'init', relativePath)).isFile();
  } catch {
    return false;
  }
}

function readInitJson(rootDir: string, relativePath: string): unknown | null {
  try {
    return JSON.parse(readFileSync(join(rootDir, 'init', relativePath), 'utf8'));
  } catch {
    return null;
  }
}

function initErr<T>(path: string, cause: readonly unknown[]): Result<T> {
  return err([
    {
      layer: 'composition',
      code: ERROR_CODES.BLUEPRINT_INIT_INVALID,
      message: 'init artifact failed validation',
      path,
      cause: [...cause],
    },
  ]);
}
