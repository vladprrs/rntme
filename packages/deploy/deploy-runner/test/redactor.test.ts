import { describe, expect, it } from 'bun:test';
import { redact } from '../src/redactor.js';

describe('redact', () => {
  it('masks Authorization Bearer values', () => {
    expect(redact('Authorization: Bearer abc123')).toBe('Authorization: Bearer ***');
  });

  it('masks api-key query parameters', () => {
    expect(redact('https://x.example?apiToken=secret&foo=1'))
      .toBe('https://x.example?apiToken=***&foo=1');
  });

  it('masks structural secretOutputs JSON values', () => {
    const input = '{"secretOutputs":{"k":"v"},"keep":1}';
    expect(redact(input)).toContain('"secretOutputs":"***"');
    expect(redact(input)).toContain('"keep":1');
  });

  it('passes through strings with no secrets', () => {
    expect(redact('hello world')).toBe('hello world');
  });
});
