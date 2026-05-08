import { describe, expect, it } from 'vitest';
import { parseStorageJson } from '../../src/validate/storage/parse.js';

describe('parseStorageJson - parse layer', () => {
  it('rejects invalid JSON', () => {
    const result = parseStorageJson('{ not: json');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('STORAGE_PARSE_INVALID_JSON');
  });

  it('rejects missing version', () => {
    const result = parseStorageJson(JSON.stringify({ routes: {} }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('STORAGE_PARSE_MISSING_VERSION');
  });

  it('rejects missing routes', () => {
    const result = parseStorageJson(JSON.stringify({ version: '1.0' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('STORAGE_PARSE_MISSING_ROUTES');
  });

  it('rejects route with non-object value', () => {
    const result = parseStorageJson(
      JSON.stringify({ version: '1.0', routes: { x: 42 } }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('STORAGE_PARSE_INVALID_ROUTE_SHAPE');
  });

  it('accepts a minimal well-formed file', () => {
    const result = parseStorageJson(
      JSON.stringify({
        version: '1.0',
        routes: {
          'ticket-attachments': {
            owner: { aggregate: 'ticket', association: 'attachments' },
            maxSize: '10MB',
            allowedTypes: ['image/*'],
            maxCount: 5,
            auth: { requireRole: ['member'] },
            lifecycle: { expirePending: '24h', retainCommitted: null },
          },
        },
      }),
    );
    expect(result.ok).toBe(true);
  });
});
