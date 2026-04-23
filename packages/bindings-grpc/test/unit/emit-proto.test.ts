import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { emitProto } from '../../src/emit/emit-proto.js';
import { minimalValidated, minimalShapeRegistry } from '../fixtures/minimal-bindings.js';

const here = dirname(fileURLToPath(import.meta.url));
const goldenPath = resolve(here, '../fixtures/golden/minimal.proto');

describe('emitProto', () => {
  it('produces byte-identical .proto for the minimal fixture', () => {
    const actual = emitProto(minimalValidated, minimalShapeRegistry, {
      packageName: 'rntme.minimal.v1',
      serviceName: 'MinimalService',
    });
    const expected = readFileSync(goldenPath, 'utf8');
    expect(actual).toBe(expected);
  });
});
