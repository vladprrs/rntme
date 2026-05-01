import { Buffer } from 'node:buffer';
import type { HranaValue } from './types.js';

const SAFE_INT_MAX = BigInt(Number.MAX_SAFE_INTEGER);
const SAFE_INT_MIN = BigInt(Number.MIN_SAFE_INTEGER);

export function encodeValue(v: unknown): HranaValue {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'bigint') return { type: 'integer', value: v.toString() };
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return { type: 'integer', value: v.toString() };
    return { type: 'float', value: v };
  }
  if (typeof v === 'string') return { type: 'text', value: v };
  if (v instanceof Uint8Array) {
    return { type: 'blob', base64: Buffer.from(v).toString('base64') };
  }
  return { type: 'text', value: String(v) };
}

export function decodeArg(v: HranaValue): null | number | bigint | string | Buffer {
  switch (v.type) {
    case 'null':
      return null;
    case 'text':
      return v.value;
    case 'float':
      return v.value;
    case 'integer': {
      const bi = BigInt(v.value);
      if (bi >= SAFE_INT_MIN && bi <= SAFE_INT_MAX) return Number(bi);
      return bi;
    }
    case 'blob':
      return Buffer.from(v.base64, 'base64');
  }
}
