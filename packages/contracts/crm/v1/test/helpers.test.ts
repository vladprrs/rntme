import { describe, expect, it } from 'bun:test';
import { proto } from '../src/index.js';

const crm = proto.rntme.contracts.crm.v1;
const common = proto.rntme.contracts.common.v1;

function refFor(canonicalId: string, vendorId: string) {
  return common.CanonicalRef.create({
    canonical_id: canonicalId,
    vendor_id: vendorId,
    module_name: 'module-crm-hubspot',
    module_version: '0.0.0',
    contract_version: 'v1',
  });
}

describe('CRM helper/read messages', () => {
  it('round-trips Pipeline with ordered Stage items', () => {
    const pipeline = crm.Pipeline.create({
      canonical_id: 'pipeline-1',
      vendor_id: 'default',
      name: 'Sales',
      entity_type: 'deal',
      is_default: true,
      stages: [
        crm.Stage.create({
          canonical_id: 'stage-open',
          vendor_id: 'appointmentscheduled',
          pipeline_canonical_id: 'pipeline-1',
          name: 'Open',
          order: 1,
          semantic: crm.StageSemantic.STAGE_SEMANTIC_OPEN,
          probability: 0.2,
        }),
        crm.Stage.create({
          canonical_id: 'stage-won',
          vendor_id: 'closedwon',
          pipeline_canonical_id: 'pipeline-1',
          name: 'Closed won',
          order: 2,
          semantic: crm.StageSemantic.STAGE_SEMANTIC_WON,
          probability: 1,
          is_terminal: true,
        }),
      ],
    });

    const decoded = crm.Pipeline.decode(crm.Pipeline.encode(pipeline).finish());

    expect(decoded.stages).toHaveLength(2);
    expect(decoded.stages[1]?.semantic).toBe(crm.StageSemantic.STAGE_SEMANTIC_WON);
    expect(decoded.stages[1]?.is_terminal).toBe(true);
  });

  it('round-trips Owner, CustomFieldDefinition, Association, and SyncDeltaItem', () => {
    const owner = crm.Owner.create({
      canonical_id: 'owner-1',
      vendor_id: '42',
      email: 'owner@example.com',
      name: common.Name.create({ display: 'Owner One' }),
      is_active: true,
    });
    const customField = crm.CustomFieldDefinition.create({
      entity_type: 'deal',
      logical_name: 'implementation_tier',
      vendor_key: 'implementation_tier__c',
      field_type: crm.CustomFieldType.CUSTOM_FIELD_TYPE_ENUM,
      label: 'Implementation tier',
      is_required: true,
      options: ['standard', 'enterprise'],
    });
    const association = crm.Association.create({
      ref: refFor('association-1', '1-2'),
      from: crm.EntityRef.create({ entity_type: 'contact', canonical_id: 'contact-1' }),
      to: crm.EntityRef.create({ entity_type: 'company', canonical_id: 'company-1' }),
      category: crm.AssociationCategory.ASSOCIATION_CATEGORY_RNTME_DEFINED,
      label: 'DECISION_MAKER',
    });
    const delta = crm.SyncDeltaItem.create({
      canonical_id: 'contact-1',
      op: crm.SyncDeltaOp.SYNC_DELTA_OP_UPDATED,
    });

    expect(crm.Owner.decode(crm.Owner.encode(owner).finish()).email).toBe('owner@example.com');
    expect(crm.CustomFieldDefinition.decode(crm.CustomFieldDefinition.encode(customField).finish()).options).toEqual([
      'standard',
      'enterprise',
    ]);
    expect(crm.Association.decode(crm.Association.encode(association).finish()).label).toBe('DECISION_MAKER');
    expect(crm.SyncDeltaItem.decode(crm.SyncDeltaItem.encode(delta).finish()).op).toBe(crm.SyncDeltaOp.SYNC_DELTA_OP_UPDATED);
  });
});
