import { describe, expect, it } from 'vitest';
import { ok, err, isOk, isErr, type Result, type UiError } from '../../src/types/result.js';
import { isRefElement, type ElementJson, type RefElement } from '../../src/types/source.js';

describe('Result helpers', () => {
  it('ok() creates an Ok result', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value).toBe(42);
  });

  it('err() creates an Err result', () => {
    const e: UiError = { code: 'INTERNAL', message: 'boom' };
    const r = err([e]);
    expect(r.ok).toBe(false);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.errors).toEqual([e]);
  });
});

describe('isRefElement', () => {
  it('returns true for $ref elements', () => {
    const ref: RefElement = { $ref: 'fragments/card', bind: { title: 'hello' } };
    expect(isRefElement(ref)).toBe(true);
  });

  it('returns false for regular elements', () => {
    const el: ElementJson = { type: 'Text', props: { text: 'hi' } };
    expect(isRefElement(el)).toBe(false);
  });
});
