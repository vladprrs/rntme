import { describe, expect, it } from 'bun:test';
import { createRouteResolver } from '../../src/route-resolver.js';

const sj = {
  version: '1.0' as const,
  routes: {
    img: {
      id: 'img',
      owner: { aggregate: 'a', association: 'b' },
      maxSize: 1_000,
      allowedTypes: ['image/*'],
      maxCount: 2,
      auth: { requireRole: null },
      lifecycle: { expirePendingMs: 60_000, retainCommittedMs: null },
    },
  },
};

describe('routeResolver', () => {
  const r = createRouteResolver(sj);

  it('STORAGE_REFERENCES_ROUTE_NOT_FOUND for unknown route', () => {
    const v = r.resolve('nope');
    expect(v.ok).not.toBe(true);
    if (v.ok === true) return;
    expect(v.error).toBe('STORAGE_REFERENCES_ROUTE_NOT_FOUND');
  });

  it('STORAGE_CONSISTENCY_FILE_TOO_LARGE when declaredSize > maxSize', () => {
    const v = r.checkUploadAllowed('img', {
      contentType: 'image/png',
      declaredSize: 2_000,
      currentCount: 0,
    });
    if (v.ok === true) return;
    expect(v.error).toBe('STORAGE_CONSISTENCY_FILE_TOO_LARGE');
  });

  it('STORAGE_CONSISTENCY_MIME_NOT_ALLOWED for disallowed mime', () => {
    const v = r.checkUploadAllowed('img', {
      contentType: 'video/mp4',
      declaredSize: 1,
      currentCount: 0,
    });
    if (v.ok === true) return;
    expect(v.error).toBe('STORAGE_CONSISTENCY_MIME_NOT_ALLOWED');
  });

  it('STORAGE_CONSISTENCY_MAX_COUNT_EXCEEDED at the count limit', () => {
    const v = r.checkUploadAllowed('img', {
      contentType: 'image/png',
      declaredSize: 1,
      currentCount: 2,
    });
    if (v.ok === true) return;
    expect(v.error).toBe('STORAGE_CONSISTENCY_MAX_COUNT_EXCEEDED');
  });

  it('passes a valid upload', () => {
    const v = r.checkUploadAllowed('img', {
      contentType: 'image/png',
      declaredSize: 999,
      currentCount: 1,
    });
    expect(v.ok).toBe(true);
  });
});
