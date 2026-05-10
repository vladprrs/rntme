import { describe, expect, it } from 'bun:test';
import { proto } from '../src/index.js';

const crm = proto.rntme.contracts.crm.v1;
const common = proto.rntme.contracts.common.v1;

function refFor(canonicalId: string, vendorId: string) {
  return common.CanonicalRef.create({
    canonical_id: canonicalId,
    vendor_id: vendorId,
    module_name: 'module-crm-bitrix24',
    module_version: '0.0.0',
    contract_version: 'v1',
  });
}

describe('CRM aggregate messages', () => {
  it('round-trips Contact with name, company, owner, tags, metadata, and status', () => {
    const contact = crm.Contact.create({
      ref: refFor('contact-1', '101'),
      email: 'ada@example.com',
      phone: '+15551234567',
      name: common.Name.create({ given: 'Ada', family: 'Lovelace', display: 'Ada Lovelace' }),
      company_canonical_id: 'company-1',
      owner_canonical_id: 'owner-1',
      tags: ['vip', 'inbound'],
      status: crm.ContactStatus.CONTACT_STATUS_ACTIVE,
    });

    const decoded = crm.Contact.decode(crm.Contact.encode(contact).finish());

    expect(decoded.ref?.canonical_id).toBe('contact-1');
    expect(decoded.email).toBe('ada@example.com');
    expect(decoded.name?.display).toBe('Ada Lovelace');
    expect(decoded.tags).toEqual(['vip', 'inbound']);
    expect(decoded.status).toBe(crm.ContactStatus.CONTACT_STATUS_ACTIVE);
  });

  it('round-trips Company regulatory fields and revenue', () => {
    const company = crm.Company.create({
      ref: refFor('company-1', '201'),
      name: 'Acme',
      domain: 'acme.example',
      annual_revenue: 1000000,
      currency: 'USD',
      tax_id: '7707083893',
      registration_id: '1027700132195',
      tax_branch_id: '770701001',
      status: crm.CompanyStatus.COMPANY_STATUS_ACTIVE,
    });

    const decoded = crm.Company.decode(crm.Company.encode(company).finish());

    expect(decoded.tax_id).toBe('7707083893');
    expect(decoded.registration_id).toBe('1027700132195');
    expect(decoded.tax_branch_id).toBe('770701001');
    expect(decoded.annual_revenue).toBe(1000000);
  });

  it('round-trips Deal pipeline, stage, qualification, amount, and terminal status', () => {
    const deal = crm.Deal.create({
      ref: refFor('deal-1', '301'),
      name: 'Enterprise rollout',
      pipeline_canonical_id: 'pipeline-1',
      stage_canonical_id: 'stage-demo',
      status: crm.DealStatus.DEAL_STATUS_WON,
      qualification: crm.DealQualification.DEAL_QUALIFICATION_QUALIFIED,
      amount: 42000,
      currency: 'USD',
      probability: 1,
    });

    const decoded = crm.Deal.decode(crm.Deal.encode(deal).finish());

    expect(decoded.pipeline_canonical_id).toBe('pipeline-1');
    expect(decoded.stage_canonical_id).toBe('stage-demo');
    expect(decoded.status).toBe(crm.DealStatus.DEAL_STATUS_WON);
    expect(decoded.qualification).toBe(crm.DealQualification.DEAL_QUALIFICATION_QUALIFIED);
    expect(decoded.amount).toBe(42000);
  });

  it('round-trips Activity linked entities and completion state', () => {
    const activity = crm.Activity.create({
      ref: refFor('activity-1', '401'),
      type: crm.ActivityType.ACTIVITY_TYPE_MEETING,
      subject: 'Demo',
      outcome: crm.ActivityOutcome.ACTIVITY_OUTCOME_COMPLETED,
      is_completed: true,
      linked_entities: [
        crm.EntityRef.create({ entity_type: 'contact', canonical_id: 'contact-1' }),
        crm.EntityRef.create({ entity_type: 'deal', canonical_id: 'deal-1' }),
      ],
    });

    const decoded = crm.Activity.decode(crm.Activity.encode(activity).finish());

    expect(decoded.type).toBe(crm.ActivityType.ACTIVITY_TYPE_MEETING);
    expect(decoded.is_completed).toBe(true);
    expect(decoded.linked_entities.map((item) => item.entity_type)).toEqual(['contact', 'deal']);
  });

  it('round-trips Note parent and author', () => {
    const note = crm.Note.create({
      ref: refFor('note-1', '501'),
      content: 'Met at conference.',
      title: 'Follow-up note',
      parent: crm.EntityRef.create({ entity_type: 'deal', canonical_id: 'deal-1' }),
      author_canonical_id: 'owner-1',
    });

    const decoded = crm.Note.decode(crm.Note.encode(note).finish());

    expect(decoded.content).toBe('Met at conference.');
    expect(decoded.parent?.entity_type).toBe('deal');
    expect(decoded.author_canonical_id).toBe('owner-1');
  });

  it('round-trips AsyncJob and SyncFullPayload', () => {
    const job = crm.AsyncJob.create({
      ref: refFor('job-1', '601'),
      type: crm.AsyncJobType.ASYNC_JOB_TYPE_SYNC_FULL,
      status: crm.AsyncJobStatus.ASYNC_JOB_STATUS_RUNNING,
      progress_percentage: 42,
      record_count: 100,
    });
    const payload = crm.SyncFullPayload.create({ entity_types: ['contact', 'company', 'deal'] });

    const decodedJob = crm.AsyncJob.decode(crm.AsyncJob.encode(job).finish());
    const decodedPayload = crm.SyncFullPayload.decode(crm.SyncFullPayload.encode(payload).finish());

    expect(decodedJob.type).toBe(crm.AsyncJobType.ASYNC_JOB_TYPE_SYNC_FULL);
    expect(decodedJob.progress_percentage).toBe(42);
    expect(decodedPayload.entity_types).toEqual(['contact', 'company', 'deal']);
  });
});
