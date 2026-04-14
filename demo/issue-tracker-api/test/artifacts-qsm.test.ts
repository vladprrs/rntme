import { describe, it, expect } from 'vitest';
import { parseQsm, validateQsm, createQsmResolver, isOk } from '@rntme/qsm';
import { createPdmResolver, parsePdm, validatePdm } from '@rntme/pdm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const artifactsDir = join(here, '..', 'src', 'artifacts');
const readRaw = (f: string): unknown => JSON.parse(readFileSync(join(artifactsDir, f), 'utf8'));

describe('qsm.json — IssueView', () => {
  it('parses and validates against PDM', () => {
    const pdm = parsePdm(readRaw('pdm.json'));
    expect(isOk(pdm)).toBe(true);
    if (!isOk(pdm)) return;
    const pdmV = validatePdm(pdm.value);
    expect(isOk(pdmV)).toBe(true);
    if (!isOk(pdmV)) return;

    const qsm = parseQsm(readRaw('qsm.json'));
    expect(isOk(qsm)).toBe(true);
    if (!isOk(qsm)) return;
    const qsmV = validateQsm(qsm.value, createPdmResolver(pdmV.value));
    expect(isOk(qsmV)).toBe(true);
    if (!isOk(qsmV)) return;

    const resolver = createQsmResolver(qsmV.value);
    const mirror = resolver.findEntityMirror('Issue');
    expect(mirror).not.toBeNull();
    expect(mirror!.table).toBe('projection_issue');
  });
});
