import { describe, expect, it } from 'bun:test';
import { ok, err, isOk, isErr, type Result } from '../src/index.js';

type DemoError = { code: string; message: string };

describe('@rntme/artifact-shared algebra', () => {
  it('ok() builds an Ok carrying the value', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    if (isOk(r)) expect(r.value).toBe(42);
  });

  it('err() builds an Err carrying the array', () => {
    const e: DemoError = { code: 'X', message: 'boom' };
    const r = err<DemoError>([e]);
    expect(r.ok).toBe(false);
    expect(isErr(r)).toBe(true);
    expect(isOk(r)).toBe(false);
    if (isErr(r)) expect(r.errors).toEqual([e]);
  });

  it('Result<T, E> narrows correctly via isOk/isErr', () => {
    const oneOf = (n: number): Result<number, DemoError> =>
      n > 0 ? ok(n) : err([{ code: 'NEG', message: 'negative' }]);
    const r = oneOf(1);
    if (isOk(r)) {
      const v: number = r.value;
      expect(v).toBe(1);
    } else {
      const errs: readonly DemoError[] = r.errors;
      expect(errs).toHaveLength(0); // unreachable for n=1
    }
    const r2 = oneOf(-1);
    if (isErr(r2)) {
      const errs: readonly DemoError[] = r2.errors;
      expect(errs).toHaveLength(1);
    }
  });

  it('err() accepts an empty array', () => {
    const r = err<DemoError>([]);
    expect(r.ok).toBe(false);
    if (isErr(r)) expect(r.errors).toHaveLength(0);
  });
});
