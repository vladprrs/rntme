import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadService } from '../../src/load/load-service.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures', 'issue-tracker');

describe('loadService (happy path)', () => {
  it('loads the issue-tracker fixture', () => {
    const r = loadService(fixtureDir);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.manifest.service.name).toBe('issue-tracker-api');
    expect(Object.keys(r.value.graphSpec.graphs).length).toBeGreaterThan(0);
    expect(r.value.openApiDoc.openapi).toBe('3.1.0');
    expect(r.value.projectionDdls.length).toBeGreaterThan(0);
    expect(r.value.eventTypes.length).toBeGreaterThan(0);
  });
});
