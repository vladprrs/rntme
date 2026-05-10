import { describe, expect, it } from 'bun:test';
import { proto } from '../src/index.js';

const expectedRpcs = [
  'GetContact',
  'ListContacts',
  'CreateContact',
  'UpdateContact',
  'DeleteContact',
  'GetCompany',
  'ListCompanies',
  'CreateCompany',
  'UpdateCompany',
  'DeleteCompany',
  'GetDeal',
  'ListDeals',
  'CreateDeal',
  'UpdateDeal',
  'DeleteDeal',
  'GetActivity',
  'ListActivities',
  'CreateActivity',
  'UpdateActivity',
  'DeleteActivity',
  'GetNote',
  'ListNotes',
  'CreateNote',
  'DeleteNote',
  'ListPipelines',
  'ListCustomFieldDefinitions',
  'CreateAssociation',
  'DeleteAssociation',
  'ListAssociations',
  'SyncDelta',
  'SubmitJob',
  'GetJob',
  'CancelJob',
  'ListJobs',
] as const;

function rpcNamesFromPrototype(): Set<string> {
  const Cons = proto.rntme.contracts.crm.v1.CrmModule;
  const names = new Set<string>();
  for (const key of Object.getOwnPropertyNames(Cons.prototype)) {
    if (key === 'constructor') continue;
    const fn = (Cons.prototype as unknown as Record<string, unknown>)[key];
    if (typeof fn !== 'function') continue;
    const name = (fn as { name?: string }).name;
    if (name && /^[A-Z][a-zA-Z0-9]*$/.test(name)) names.add(name);
  }
  return names;
}

describe('CrmModule service shape', () => {
  it('declares exactly 34 RPCs', () => {
    expect(rpcNamesFromPrototype().size).toBe(34);
  });

  it('declares exactly the expected RPCs', () => {
    expect(rpcNamesFromPrototype()).toEqual(new Set(expectedRpcs));
  });

  it('does not contain CRM v1 deferred surfaces', () => {
    const methodNames = rpcNamesFromPrototype();
    for (const rpc of ['UpdateNote', 'MoveDealToStage', 'CreateCustomField', 'ListOwners', 'GetOwner', 'SyncDeltaStream']) {
      expect(methodNames.has(rpc), `${rpc} must not appear in CrmModule v1`).toBe(false);
    }
  });
});
