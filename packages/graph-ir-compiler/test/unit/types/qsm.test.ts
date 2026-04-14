import { describe, it, expect } from 'vitest';
import { QsmSchema } from '../../../src/types/qsm.js';
import qsm from '../../e2e/fixtures/commerce.qsm.json' with { type: 'json' };

describe('QSM', () => {
  it('accepts the commerce fixture', () => {
    expect(() => QsmSchema.parse(qsm)).not.toThrow();
  });
});
