import { describe, expect, it } from 'vitest';
import { parseStorageJson } from '../../src/validate/storage/parse.js';
import { validateStorageJsonStructural } from '../../src/validate/storage/structural.js';

const minimal = {
  owner: { aggregate: 'ticket', association: 'attachments' },
  maxSize: '10MB',
  allowedTypes: ['image/*'],
  maxCount: 5,
  auth: { requireRole: ['member'] },
  lifecycle: { expirePending: '24h', retainCommitted: null },
};

function build(routes: Record<string, unknown>): string {
  return JSON.stringify({ version: '1.0', routes });
}

describe('validateStorageJsonStructural', () => {
  it('rejects route id with uppercase letters', () => {
    const parsed = parseStorageJson(build({ TicketAttachments: minimal }));
    if (!parsed.ok) throw new Error('parse failed unexpectedly');
    const r = validateStorageJsonStructural(parsed.value);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.at(0)?.code).toBe('STORAGE_STRUCTURAL_ROUTE_ID_FORMAT');
  });

  it('rejects an unparseable duration', () => {
    const parsed = parseStorageJson(
      build({
        'ticket-attachments': {
          ...minimal,
          lifecycle: { expirePending: 'foreverish', retainCommitted: null },
        },
      }),
    );
    if (!parsed.ok) throw new Error('parse failed');
    const r = validateStorageJsonStructural(parsed.value);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.at(0)?.code).toBe('STORAGE_STRUCTURAL_INVALID_DURATION');
  });

  it('rejects an unparseable byte size', () => {
    const parsed = parseStorageJson(
      build({
        'ticket-attachments': { ...minimal, maxSize: 'huge' },
      }),
    );
    if (!parsed.ok) throw new Error('parse failed');
    const r = validateStorageJsonStructural(parsed.value);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.at(0)?.code).toBe('STORAGE_STRUCTURAL_INVALID_BYTE_SIZE');
  });

  it('rejects a malformed mime glob', () => {
    const parsed = parseStorageJson(
      build({
        'ticket-attachments': { ...minimal, allowedTypes: ['no-slash-here'] },
      }),
    );
    if (!parsed.ok) throw new Error('parse failed');
    const r = validateStorageJsonStructural(parsed.value);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.at(0)?.code).toBe('STORAGE_STRUCTURAL_INVALID_MIME_GLOB');
  });

  it('produces a normalized StorageJson on success (durations to ms, sizes to bytes)', () => {
    const parsed = parseStorageJson(build({ 'ticket-attachments': minimal }));
    if (!parsed.ok) throw new Error('parse failed');
    const r = validateStorageJsonStructural(parsed.value);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const route = r.value.routes['ticket-attachments'];
    expect(route).toBeDefined();
    if (route === undefined) return;
    expect(route.maxSize).toBe(10 * 1024 * 1024);
    expect(route.lifecycle.expirePendingMs).toBe(24 * 60 * 60 * 1000);
    expect(route.lifecycle.retainCommittedMs).toBeNull();
  });
});
