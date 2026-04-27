import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { proto } from '@rntme/contracts-crm-v1';
import { suite } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const scenariosDir = resolve(here, '../src/scenarios');

const EXPECTED_RPCS = [
  'GetContact', 'ListContacts', 'CreateContact', 'UpdateContact', 'DeleteContact',
  'GetCompany', 'ListCompanies', 'CreateCompany', 'UpdateCompany', 'DeleteCompany',
  'GetDeal', 'ListDeals', 'CreateDeal', 'UpdateDeal', 'DeleteDeal',
  'GetActivity', 'ListActivities', 'CreateActivity', 'UpdateActivity', 'DeleteActivity',
  'GetNote', 'ListNotes', 'CreateNote', 'DeleteNote',
  'ListPipelines', 'ListCustomFieldDefinitions', 'ListAssociations',
  'CreateAssociation', 'DeleteAssociation',
  'SyncDelta',
  'SubmitJob', 'GetJob', 'CancelJob', 'ListJobs',
] as const;

describe('CRM conformance drift detector', () => {
  it('every canonical RPC has a matching scenario file (34 files)', () => {
    const filenames = readdirSync(scenariosDir).filter((n) => n.endsWith('.scenarios.ts'));
    const rpcNamesFromFiles = filenames.map((n) => n.replace('.scenarios.ts', '')).sort();
    const expected = [...EXPECTED_RPCS].sort();
    expect(rpcNamesFromFiles).toEqual(expected);
    expect(rpcNamesFromFiles).toHaveLength(34);
  });

  it('every scenario file is wired in suite.ts', () => {
    const filenames = readdirSync(scenariosDir).filter((n) => n.endsWith('.scenarios.ts'));
    const rpcNamesFromFiles = filenames.map((n) => n.replace('.scenarios.ts', ''));
    const wiredKeys = Object.keys(suite.scenarios);
    expect(wiredKeys.sort()).toEqual(rpcNamesFromFiles.sort());
  });

  it('EXPECTED_RPCS matches the canonical contract service', () => {
    // Introspect CrmModule to confirm the file list matches the proto definition.
    const ns = proto.rntme.contracts.crm.v1 as Record<string, unknown>;
    const ServiceCtor = ns['CrmModule'] as { prototype: Record<string, unknown> };
    expect(ServiceCtor, 'CrmModule service descriptor missing').toBeDefined();
    const declaredMethods = Object.getOwnPropertyNames(ServiceCtor.prototype).filter((n) => n !== 'constructor');
    // pbjs lower-cases the first letter of RPC method names.
    const camelExpected = [...EXPECTED_RPCS].map((n) => n.charAt(0).toLowerCase() + n.slice(1)).sort();
    expect(declaredMethods.sort()).toEqual(camelExpected);
  });

  it('suite metadata is fixed', () => {
    expect(suite.category).toBe('crm');
    expect(suite.contract_version).toBe('v1');
  });
});
