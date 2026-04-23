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
    const r = renderErrResponse(shape, { result: null, error: { code: 'BAD', message: 'bad' } }, 'BAD');
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/errors/BAD');
  });

  it('maps COMMAND_GUARD_REJECTED to 422 by default', () => {
    const shape: ResponseShape = {
      onOk: { json: {} },
      onErr: { json: { code: '$error.code' } },
    };
    const out = renderErrResponse(shape, { result: null, error: { code: 'COMMAND_GUARD_REJECTED' } }, 'COMMAND_GUARD_REJECTED');
    expect(out.status).toBe(422);
  });

  it('maps COMMAND_CONCURRENCY_CONFLICT to 409 by default', () => {
    const shape: ResponseShape = {
      onOk: { json: {} },
      onErr: { json: { code: '$error.code' } },
    };
    const out = renderErrResponse(shape, { result: null, error: { code: 'COMMAND_CONCURRENCY_CONFLICT' } }, 'COMMAND_CONCURRENCY_CONFLICT');
    expect(out.status).toBe(409);
  });

  it('URL-encodes redirect template substitutions', () => {
    const shape: ResponseShape = {
      onOk: { redirect: '/oauth/callback?state={$result.state}' },
      onErr: { json: {} },
    };
    const out = renderOkResponse(shape, { result: { state: '../admin?evil=1' }, error: null });
    expect(out.kind).toBe('redirect');
    if (out.kind === 'redirect') {
      expect(out.location).toBe('/oauth/callback?state=..%2Fadmin%3Fevil%3D1');
    }
  });

  it('object-form redirect evaluates expr result', () => {
    const shape: ResponseShape = {
      onOk: { redirect: { expr: '$result.url' } },
      onErr: { json: {} },
    };
    const out = renderOkResponse(shape, { result: { url: '/next' }, error: null });
    expect(out.kind).toBe('redirect');
    if (out.kind === 'redirect') {
      expect(out.location).toBe('/next');
    }
  });
});
