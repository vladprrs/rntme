import { readFileSync } from 'node:fs';
import { parseAuthoringSpec } from '@rntme/graph-ir-compiler';
import { createPdmResolver, parsePdm, validatePdm } from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';
import type {
  BindingsGraphRuntimeInputs,
  RuntimeGraphSpec,
  ValidatedPdm,
  ValidatedQsm,
} from '../../src/startup/runtime-inputs.js';

export function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function parseRuntimeGraphSpec(input: unknown): RuntimeGraphSpec {
  const parsed = parseAuthoringSpec(input);
  if (!parsed.ok) throw new Error(`Graph IR parse failed: ${JSON.stringify(parsed.errors)}`);
  return parsed.value;
}

export function validateRuntimePdm(input: unknown): ValidatedPdm {
  const parsed = parsePdm(input);
  if (!parsed.ok) throw new Error(`PDM parse failed: ${JSON.stringify(parsed.errors)}`);
  const validated = validatePdm(parsed.value);
  if (!validated.ok) throw new Error(`PDM validation failed: ${JSON.stringify(validated.errors)}`);
  return validated.value;
}

export function validateRuntimeQsm(input: unknown, pdm: ValidatedPdm): ValidatedQsm {
  const parsed = parseQsm(input);
  if (!parsed.ok) throw new Error(`QSM parse failed: ${JSON.stringify(parsed.errors)}`);
  const validated = validateQsm(parsed.value, createPdmResolver(pdm));
  if (!validated.ok) throw new Error(`QSM validation failed: ${JSON.stringify(validated.errors)}`);
  return validated.value;
}

export function parseGraphRuntimeInputs(input: {
  graphSpec: unknown;
  pdm: unknown;
  qsm: unknown;
}): BindingsGraphRuntimeInputs {
  const graphSpec = parseRuntimeGraphSpec(input.graphSpec);
  const pdm = validateRuntimePdm(input.pdm);
  const qsm = validateRuntimeQsm(input.qsm, pdm);
  return { graphSpec, pdm, qsm };
}
