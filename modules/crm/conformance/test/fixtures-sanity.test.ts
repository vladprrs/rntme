import { describe, expect, it } from 'vitest';
import { statSync, readFileSync } from 'node:fs';
import {
  bitrix24EventPath,
  hubspotBatchPath,
  amocrmUpdatePath,
  pipedriveV2Path,
} from '../src/fixtures/webhooks/index.js';

const MAX_SIZE_BYTES = 50 * 1024; // 50 KB per fixture

describe('webhook fixtures', () => {
  it('bitrix24-event.json is valid JSON ≤ 50KB with event=ONCRMDEALUPDATE', () => {
    const stat = statSync(bitrix24EventPath);
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.size).toBeLessThanOrEqual(MAX_SIZE_BYTES);
    const payload = JSON.parse(readFileSync(bitrix24EventPath, 'utf8')) as {
      event?: string;
      data?: { FIELDS?: { ID?: string } };
      auth?: { application_token?: string };
    };
    expect(payload.event).toBe('ONCRMDEALUPDATE');
    expect(payload.data?.FIELDS?.ID).toBeDefined();
    expect(payload.auth?.application_token).toBeDefined();
  });

  it('hubspot-batch.json is a valid JSON array ≤ 50KB with subscriptionType events', () => {
    const stat = statSync(hubspotBatchPath);
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.size).toBeLessThanOrEqual(MAX_SIZE_BYTES);
    const payload = JSON.parse(readFileSync(hubspotBatchPath, 'utf8')) as Array<{
      subscriptionType: string;
      eventId: unknown;
      portalId: unknown;
    }>;
    expect(Array.isArray(payload)).toBe(true);
    expect(payload.length).toBeGreaterThanOrEqual(1);
    for (const event of payload) {
      expect(event.subscriptionType).toMatch(
        /^(contact|company|deal|ticket)\.(creation|propertyChange|deletion)$/,
      );
      expect(event.eventId).toBeDefined();
      expect(event.portalId).toBeDefined();
    }
  });

  it('amocrm-update.urlencoded parses as URL-encoded form data ≤ 50KB', () => {
    const stat = statSync(amocrmUpdatePath);
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.size).toBeLessThanOrEqual(MAX_SIZE_BYTES);
    const raw = readFileSync(amocrmUpdatePath, 'utf8').trim();
    // URLSearchParams handles the percent-encoding + flat key=value structure.
    const params = new URLSearchParams(raw);
    // amoCRM's bracket-notation keys are preserved as-is; assert presence of canonical keys.
    expect(params.get('account[id]')).toBe('12345');
    expect(params.get('account[subdomain]')).toBe('example');
    expect(params.get('leads[update][0][id]')).toBe('42');
    expect(params.get('leads[update][0][name]')).toBe('Acme Q4');
    expect(params.get('leads[update][0][status_id]')).toBe('143');
    expect(params.get('leads[update][0][price]')).toBe('50000');
    expect(params.get('leads[update][0][responsible_user_id]')).toBe('99');
  });

  it('pipedrive-v2.json is valid JSON ≤ 50KB with meta.version=2.0', () => {
    const stat = statSync(pipedriveV2Path);
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.size).toBeLessThanOrEqual(MAX_SIZE_BYTES);
    const payload = JSON.parse(readFileSync(pipedriveV2Path, 'utf8')) as {
      meta?: { version?: string; entity?: string; action?: string };
      current: unknown;
      previous: unknown;
    };
    expect(payload.meta?.version).toBe('2.0');
    expect(payload.meta?.entity).toBeDefined();
    expect(payload.meta?.action).toBeDefined();
    expect(payload.current).toBeDefined();
    expect(payload.previous).toBeDefined();
  });
});
