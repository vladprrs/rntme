import { describe, it, expect, vi } from 'vitest';
import { createAmoCrmModule } from '../../src/handlers.js';
import { InMemoryIdempotencyStore } from '../../src/webhooks.js';
import type { AmoCrmAdapter } from '../../src/adapter.js';

function createMockAdapter(): AmoCrmAdapter {
  return {
    getContact: vi.fn(),
    listContacts: vi.fn(),
    addContacts: vi.fn(),
    updateContacts: vi.fn(),
    getCompany: vi.fn(),
    listCompanies: vi.fn(),
    addCompanies: vi.fn(),
    updateCompanies: vi.fn(),
    getLead: vi.fn(),
    listLeads: vi.fn(),
    addLeads: vi.fn(),
    updateLeads: vi.fn(),
    getTask: vi.fn(),
    listTasks: vi.fn(),
    addTasks: vi.fn(),
    updateTasks: vi.fn(),
    getNote: vi.fn(),
    listNotes: vi.fn(),
    addNotes: vi.fn(),
    listPipelines: vi.fn(),
    listCustomFields: vi.fn(),
    listUsers: vi.fn(),
    listLinks: vi.fn(),
    addLinks: vi.fn(),
    deleteLinks: vi.fn(),
    webhookHandler: vi.fn(),
  } as unknown as AmoCrmAdapter;
}

describe('createAmoCrmModule', () => {
  it('creates a module with all handlers', () => {
    const adapter = createMockAdapter();
    const store = new InMemoryIdempotencyStore();
    const module = createAmoCrmModule({ adapter, idempotencyStore: store });

    expect(module.getContact).toBeDefined();
    expect(module.listContacts).toBeDefined();
    expect(module.createContact).toBeDefined();
    expect(module.updateContact).toBeDefined();
    expect(module.deleteContact).toBeDefined();
    expect(module.getCompany).toBeDefined();
    expect(module.listCompanies).toBeDefined();
    expect(module.createCompany).toBeDefined();
    expect(module.updateCompany).toBeDefined();
    expect(module.deleteCompany).toBeDefined();
    expect(module.getDeal).toBeDefined();
    expect(module.listDeals).toBeDefined();
    expect(module.createDeal).toBeDefined();
    expect(module.updateDeal).toBeDefined();
    expect(module.deleteDeal).toBeDefined();
    expect(module.getActivity).toBeDefined();
    expect(module.listActivities).toBeDefined();
    expect(module.createActivity).toBeDefined();
    expect(module.updateActivity).toBeDefined();
    expect(module.deleteActivity).toBeDefined();
    expect(module.getNote).toBeDefined();
    expect(module.listNotes).toBeDefined();
    expect(module.createNote).toBeDefined();
    expect(module.deleteNote).toBeDefined();
    expect(module.listPipelines).toBeDefined();
    expect(module.listCustomFieldDefinitions).toBeDefined();
    expect(module.listAssociations).toBeDefined();
    expect(module.createAssociation).toBeDefined();
    expect(module.deleteAssociation).toBeDefined();
    expect(module.syncDelta).toBeDefined();
    expect(module.submitJob).toBeDefined();
    expect(module.getJob).toBeDefined();
    expect(module.cancelJob).toBeDefined();
    expect(module.listJobs).toBeDefined();
  });

  it('getContact returns mapped contact', async () => {
    const adapter = createMockAdapter();
    const store = new InMemoryIdempotencyStore();
    const module = createAmoCrmModule({ adapter, idempotencyStore: store });

    vi.mocked(adapter.getContact).mockResolvedValue({
      id: 42,
      name: 'John Doe',
      first_name: 'John',
      last_name: 'Doe',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T12:00:00Z',
    });

    const result = await module.getContact({ canonicalId: 'amocrm:contact:42' });
    expect(result).toMatchObject({
      ref: { canonicalId: 'amocrm:contact:42', vendorId: '42' },
      name: { givenName: 'John', familyName: 'Doe' },
    });
  });

  it('createContact requires idempotency key', async () => {
    const adapter = createMockAdapter();
    const store = new InMemoryIdempotencyStore();
    const module = createAmoCrmModule({ adapter, idempotencyStore: store });

    await expect(module.createContact({})).rejects.toThrow('idempotency_key is required');
  });

  it('listDeals returns mapped deals', async () => {
    const adapter = createMockAdapter();
    const store = new InMemoryIdempotencyStore();
    const module = createAmoCrmModule({ adapter, idempotencyStore: store });

    vi.mocked(adapter.listLeads).mockResolvedValue({
      data: [{ id: 1, name: 'Deal 1', price: 1000, status_id: 10, pipeline_id: 1, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' }],
      totalCount: 1,
    });

    const result = await module.listDeals({});
    expect(result).toMatchObject({
      items: [{ ref: { canonicalId: 'amocrm:deal:1' } }],
      meta: { totalCount: 1 },
    });
  });

  it('unimplemented RPCs throw', async () => {
    const adapter = createMockAdapter();
    const store = new InMemoryIdempotencyStore();
    const module = createAmoCrmModule({ adapter, idempotencyStore: store });

    await expect(module.syncDelta({})).rejects.toThrow('SyncDelta is not implemented');
    await expect(module.submitJob({})).rejects.toThrow('SubmitJob is not implemented');
    await expect(module.getJob({ canonicalId: 'amocrm:job:1' })).rejects.toThrow('GetJob is not implemented');
    await expect(module.cancelJob({ canonicalId: 'amocrm:job:1' })).rejects.toThrow('CancelJob is not implemented');
    await expect(module.listJobs({})).rejects.toThrow('ListJobs is not implemented');
  });
});
