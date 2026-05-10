import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'bun:test';
import { proto } from '../src/index.js';

const crm = proto.rntme.contracts.crm.v1;
const common = proto.rntme.contracts.common.v1;
const here = dirname(fileURLToPath(import.meta.url));

const expectedEvents = [
  'ContactCreated',
  'ContactUpdated',
  'ContactDeleted',
  'CompanyCreated',
  'CompanyUpdated',
  'CompanyDeleted',
  'DealCreated',
  'DealUpdated',
  'DealStageChanged',
  'DealClosed',
  'ActivityCreated',
  'ActivityUpdated',
  'ActivityDeleted',
  'NoteCreated',
  'NoteDeleted',
  'AssociationCreated',
  'AssociationDeleted',
  'AsyncJobSubmitted',
  'AsyncJobStatusChanged',
  'AsyncJobCompleted',
  'AsyncJobFailed',
] as const;

function refFor(canonicalId: string, vendorId: string) {
  return common.CanonicalRef.create({
    canonical_id: canonicalId,
    vendor_id: vendorId,
    module_name: 'module-crm-bitrix24',
    module_version: '0.0.0',
    contract_version: 'v1',
  });
}

describe('CRM event payloads', () => {
  it('exports exactly 21 canonical event types', () => {
    const protoSource = readFileSync(resolve(here, '../proto/crm-events.proto'), 'utf8');
    const actualEvents = Array.from(protoSource.matchAll(/^message\s+(\w+)\s*\{/gm), ([, name]) => name);

    expect(actualEvents).toEqual([...expectedEvents]);
    for (const name of expectedEvents) {
      expect((crm as unknown as Record<string, unknown>)[name], `expected event message ${name}`).toBeTruthy();
    }
  });

  it('ContactUpdated round-trips changed fields and previous snapshot', () => {
    const before = crm.Contact.create({ ref: refFor('contact-1', '101'), email: 'old@example.com' });
    const after = crm.Contact.create({ ref: refFor('contact-1', '101'), email: 'new@example.com' });
    const event = crm.ContactUpdated.create({
      contact: after,
      previous: before,
      changed_fields: ['email'],
      trigger: 'webhook',
    });

    const decoded = crm.ContactUpdated.decode(crm.ContactUpdated.encode(event).finish());

    expect(decoded.contact?.email).toBe('new@example.com');
    expect(decoded.previous?.email).toBe('old@example.com');
    expect(decoded.changed_fields).toEqual(['email']);
  });

  it('Deal stage and terminal close events round-trip dedicated fields', () => {
    const deal = crm.Deal.create({
      ref: refFor('deal-1', '301'),
      status: crm.DealStatus.DEAL_STATUS_WON,
      stage_canonical_id: 'stage-won',
    });
    const stage = crm.DealStageChanged.create({
      deal,
      from_stage_canonical_id: 'stage-demo',
      to_stage_canonical_id: 'stage-won',
      from_pipeline_canonical_id: 'pipeline-1',
      to_pipeline_canonical_id: 'pipeline-1',
      actor_canonical_id: 'owner-1',
      trigger: 'command',
    });
    const closed = crm.DealClosed.create({
      deal,
      terminal_status: crm.DealStatus.DEAL_STATUS_WON,
      close_reason: 'signed',
      trigger: 'command',
    });

    expect(crm.DealStageChanged.decode(crm.DealStageChanged.encode(stage).finish()).to_stage_canonical_id).toBe('stage-won');
    expect(crm.DealClosed.decode(crm.DealClosed.encode(closed).finish()).terminal_status).toBe(
      crm.DealStatus.DEAL_STATUS_WON,
    );
  });

  it('AsyncJob lifecycle events round-trip status state', () => {
    const job = crm.AsyncJob.create({
      ref: refFor('job-1', '601'),
      type: crm.AsyncJobType.ASYNC_JOB_TYPE_SYNC_FULL,
      status: crm.AsyncJobStatus.ASYNC_JOB_STATUS_RUNNING,
    });
    const submitted = crm.AsyncJobSubmitted.create({ job, type: crm.AsyncJobType.ASYNC_JOB_TYPE_SYNC_FULL });
    const changed = crm.AsyncJobStatusChanged.create({
      canonical_id: 'job-1',
      type: crm.AsyncJobType.ASYNC_JOB_TYPE_SYNC_FULL,
      previous_status: crm.AsyncJobStatus.ASYNC_JOB_STATUS_QUEUED,
      new_status: crm.AsyncJobStatus.ASYNC_JOB_STATUS_RUNNING,
      progress_percentage: 25,
    });
    const completed = crm.AsyncJobCompleted.create({ job });
    const failed = crm.AsyncJobFailed.create({
      job,
      error_code: 'CRM_VENDOR_UNAVAILABLE',
      error_message: 'upstream unavailable',
    });

    expect(crm.AsyncJobSubmitted.decode(crm.AsyncJobSubmitted.encode(submitted).finish()).type).toBe(
      crm.AsyncJobType.ASYNC_JOB_TYPE_SYNC_FULL,
    );
    expect(crm.AsyncJobStatusChanged.decode(crm.AsyncJobStatusChanged.encode(changed).finish()).new_status).toBe(
      crm.AsyncJobStatus.ASYNC_JOB_STATUS_RUNNING,
    );
    expect(crm.AsyncJobCompleted.decode(crm.AsyncJobCompleted.encode(completed).finish()).job?.ref?.canonical_id).toBe('job-1');
    expect(crm.AsyncJobFailed.decode(crm.AsyncJobFailed.encode(failed).finish()).error_code).toBe('CRM_VENDOR_UNAVAILABLE');
  });
});
