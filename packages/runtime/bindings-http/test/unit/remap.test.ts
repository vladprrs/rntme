import { describe, it, expect } from 'vitest';
import { buildBindToMap, remapToGraphInputs } from '../../src/runtime/remap.js';
import type { HttpParameter } from '@rntme/bindings';

const p = (name: string, bindTo: string): HttpParameter =>
  ({ name, in: 'query', bindTo, required: true });

describe('buildBindToMap', () => {
  it('returns map from http name to graph input name', () => {
    const m = buildBindToMap([p('dateFrom', 'dateFrom'), p('limitOverride', 'limit')]);
    expect(m).toEqual({ dateFrom: 'dateFrom', limitOverride: 'limit' });
  });
});

describe('remapToGraphInputs', () => {
  const map = { dateFrom: 'dateFrom', limitOverride: 'limit' };

  it('renames keys through the map', () => {
    expect(remapToGraphInputs({ dateFrom: '2024-01-01', limitOverride: 5 }, map)).toEqual({
      dateFrom: '2024-01-01',
      limit: 5,
    });
  });

  it('omits keys absent from input bag', () => {
    expect(remapToGraphInputs({ dateFrom: '2024-01-01' }, map)).toEqual({
      dateFrom: '2024-01-01',
    });
  });

  it('ignores unknown keys in the bag', () => {
    expect(remapToGraphInputs({ dateFrom: 'x', unrelated: 'y' }, map)).toEqual({
      dateFrom: 'x',
    });
  });
});
