import { describe, it, expect } from 'vitest';
import { renderOkResponse, renderErrResponse } from '../../src/runtime/render-response.js';
import type { ResponseShape } from '@rntme/bindings';

describe('renderResponse', () => {
  it('renders a JSON ok response with template substitution', () => {
    const shape: ResponseShape = {
      onOk: { json: { status: 'active', userId: '$result.userId' } },
      onErr: { json: '$error' },
    };
    const r = renderOkResponse(shape, { result: { userId: 'u-1' }, error: null });
    expect(r.kind).toBe('json');
    if (r.kind === 'json') {
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ status: 'active', userId: 'u-1' });
    }
  });

  it('renders a 302 redirect with substitution', () => {
    const shape: ResponseShape = {
      onOk: { redirect: '/settings?u={$result.userId}', status: 302 },
      onErr: { redirect: '/errors/{$error.code}' },
    };
    const r = renderOkResponse(shape, { result: { userId: 'u-1' }, error: null });
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') {
      expect(r.status).toBe(302);
      expect(r.location).toBe('/settings?u=u-1');
    }
  });

  it('defaults redirect status to 302 when omitted', () => {
    const shape: ResponseShape = {
      onOk: { redirect: '/x' },
      onErr: { json: '$error' },
    };
    const r = renderOkResponse(shape, { result: null, error: null });
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.status).toBe(302);
  });

  it('renderErrResponse substitutes error fields', () => {
    const shape: ResponseShape = {
      onOk: { json: '$result' },
      onErr: { redirect: '/errors/{$error.code}' },
    };
    const r = renderErrResponse(shape, { result: null, error: { code: 'BAD', message: 'bad' } });
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/errors/BAD');
  });
});
