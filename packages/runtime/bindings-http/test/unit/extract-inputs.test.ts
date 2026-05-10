import { describe, it, expect } from 'bun:test';
import { extractInputs } from '../../src/runtime/extract-inputs.js';
import type { InputFromMap } from '@rntme/bindings';

function mkRequest({
  query = {},
  headers = {},
  body,
  form,
}: {
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  form?: Record<string, string>;
}): Parameters<typeof extractInputs>[1] {
  return {
    query: new URLSearchParams(
      Object.entries(query).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]])) as [string, string][],
    ),
    header: (name) => headers[name.toLowerCase()] ?? null,
    body: body ?? null,
    form: form ?? null,
  };
}

describe('extractInputs', () => {
  it('extracts query values', () => {
    const map: InputFromMap = { state: { from: 'query', name: 'state', required: true } };
    const out = extractInputs(map, mkRequest({ query: { state: 'abc' } }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.values.state).toBe('abc');
  });

  it('extracts header values case-insensitively', () => {
    const map: InputFromMap = { ua: { from: 'header', name: 'User-Agent' } };
    const out = extractInputs(map, mkRequest({ headers: { 'user-agent': 'rntme-test' } }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.values.ua).toBe('rntme-test');
  });

  it('extracts body-path values', () => {
    const map: InputFromMap = { email: { from: 'body', path: 'profile.email' } };
    const out = extractInputs(map, mkRequest({ body: { profile: { email: 'u@x' } } }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.values.email).toBe('u@x');
  });

  it('extracts whole body when no path', () => {
    const map: InputFromMap = { payload: { from: 'body' } };
    const out = extractInputs(map, mkRequest({ body: { a: 1 } }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.values.payload).toEqual({ a: 1 });
  });

  it('extracts form values', () => {
    const map: InputFromMap = { samlResponse: { from: 'form', name: 'SAMLResponse', required: true } };
    const out = extractInputs(map, mkRequest({ form: { SAMLResponse: 'data' } }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.values.samlResponse).toBe('data');
  });

  it('reports missing required query param', () => {
    const map: InputFromMap = { state: { from: 'query', name: 'state', required: true } };
    const out = extractInputs(map, mkRequest({}));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe('INPUT_FROM_MISSING');
  });

  it('allows missing optional header → null', () => {
    const map: InputFromMap = { ua: { from: 'header', name: 'User-Agent' } };
    const out = extractInputs(map, mkRequest({}));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.values.ua).toBeNull();
  });
});
