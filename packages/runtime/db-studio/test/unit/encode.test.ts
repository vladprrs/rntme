import { Buffer } from 'node:buffer';
import { describe, it, expect } from 'vitest';
import { encodeValue, decodeArg } from '../../src/hrana/encode.js';

describe('encodeValue', () => {
  it('encodes null', () => {
    expect(encodeValue(null)).toEqual({ type: 'null' });
  });
  it('encodes integer (BigInt)', () => {
    expect(encodeValue(BigInt(42))).toEqual({ type: 'integer', value: '42' });
  });
  it('encodes integer (number)', () => {
    expect(encodeValue(42)).toEqual({ type: 'integer', value: '42' });
  });
  it('encodes float', () => {
    expect(encodeValue(3.14)).toEqual({ type: 'float', value: 3.14 });
  });
  it('encodes text', () => {
    expect(encodeValue('hello')).toEqual({ type: 'text', value: 'hello' });
  });
  it('encodes blob (Buffer)', () => {
    const buf = Buffer.from('abc', 'utf-8');
    expect(encodeValue(buf)).toEqual({ type: 'blob', base64: buf.toString('base64') });
  });
  it('encodes blob (Uint8Array)', () => {
    const u = new Uint8Array([1, 2, 3]);
    expect(encodeValue(u)).toEqual({ type: 'blob', base64: Buffer.from(u).toString('base64') });
  });
});

describe('decodeArg', () => {
  it('decodes text', () => {
    expect(decodeArg({ type: 'text', value: 'x' })).toBe('x');
  });
  it('decodes integer as BigInt if large', () => {
    expect(decodeArg({ type: 'integer', value: '9007199254740993' })).toBe(BigInt('9007199254740993'));
  });
  it('decodes integer as number if small', () => {
    expect(decodeArg({ type: 'integer', value: '42' })).toBe(42);
  });
  it('decodes null', () => {
    expect(decodeArg({ type: 'null' })).toBe(null);
  });
  it('decodes blob', () => {
    const b64 = Buffer.from('xyz').toString('base64');
    const out = decodeArg({ type: 'blob', base64: b64 });
    expect(out).toBeInstanceOf(Buffer);
    expect((out as Buffer).toString()).toBe('xyz');
  });
});
