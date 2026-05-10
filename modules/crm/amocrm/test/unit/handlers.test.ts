import { describe, expect, it, mock } from 'bun:test';
import { proto } from '@rntme/contracts-crm-v1';
import {
  GRPC_STATUS_UNIMPLEMENTED,
  createAmoCrmModule,
  isAmoCrmError,
} from '../../src/index.js';
import type { AmoCrmAdapter } from '../../src/adapter.js';

const crm = proto.rntme.contracts.crm.v1;

function adapter(overrides: Partial<AmoCrmAdapter> = {}): AmoCrmAdapter {
  const base = {
    getContact: mock(async () => ({ id: 123, name: 'Alice' })),
    listContacts: mock(async () => ({ data: [{ id: 123, name: 'Alice' }], totalCount: 1 })),
    createContact: mock(async () => [{ id: 124, name: 'Bob' }]),
    updateContact: mock(async () => [{ id: 123, name: 'Alice Updated', is_deleted: true }]),

    getCompany: mock(async () => ({ id: 456, name: 'Acme' })),
    listCompanies: mock(async () => ({ data: [{ id: 456, name: 'Acme' }], totalCount: 1 })),
    createCompany: mock(async () => [{ id: 457, name: 'Globex' }]),
    updateCompany: mock(async () => [{ id: 456, name: 'Acme Updated' }]),

    getLead: mock(async () => ({ id: 789, name: 'Deal 1' })),
    listLeads: mock(async () => ({ data: [{ id: 789, name: 'Deal 1' }], totalCount: 1 })),
    createLead: mock(async () => [{ id: 790, name: 'Deal 2' }]),
    updateLead: mock(async () => [{ id: 789, name: 'Deal 1 Updated' }]),

    getTask: mock(async () => ({ id: 100, text: 'Task 1' })),
    listTasks: mock(async () => ({ data: [{ id: 100, text: 'Task 1' }], totalCount: 1 })),
    createTask: mock(async () => [{ id: 101, text: 'Task 2' }]),

    getNote: mock(async () => ({ id: 200, text: 'Note 1' })),
    listNotes: mock(async () => ({ data: [{ id: 200, text: 'Note 1' }], totalCount: 1 })),
    createNote: mock(async () => [{ id: 201, text: 'Note 2' }]),

    getPipelines: mock(async () => [{ id: 1, name: 'Pipeline 1', statuses: [] }]),
    getCustomFields: mock(async () => ({ data: [{ id: 1, name: 'Field 1', type: 'text' }], totalCount: 1 })),
    getUsers: mock(async () => ({ data: [{ id: 99, name: 'User 1' }], totalCount: 1 })),

    createAssociation: mock(async () => ({})),
    deleteAssociation: mock(async () => undefined),
  } satisfies AmoCrmAdapter;

  return { ...base, ...overrides };
}

describe('amoCRM handlers', () => {
  it('calls the adapter and maps CreateContact to a canonical contact', async () => {
    const calls: unknown[] = [];
    const module = createAmoCrmModule({
      adapter: adapter({
        createContact: mock(async (params) => {
          calls.push(params);
          return [{ id: 124, name: 'Bob', created_at: Math.floor(Date.now() / 1000), custom_fields_values: [{ field_code: 'EMAIL', values: [{ value: 'bob@example.com' }] }] }];
        }),
      }),
    });

    const contact = await module.CreateContact(
      crm.CreateContactRequest.create({
        context: { idempotency_key: 'idem_1', correlation_id: 'corr_1' },
        email: 'bob@example.com',
        name: { given: 'Bob', family: 'Jones', display: 'Bob Jones' },
      }),
    );

    expect(contact.ref?.canonical_id).toBe('124');
    expect(contact.email).toBe('bob@example.com');
    expect(calls).toHaveLength(1);
  });

  it('GetContact calls adapter and maps result', async () => {
    const mockAdapter = adapter();
    const module = createAmoCrmModule({ adapter: mockAdapter });
    const contact = await module.GetContact(crm.GetContactRequest.create({ canonical_id: '123' }));
    expect(contact.ref?.canonical_id).toBe('123');
    expect(mockAdapter.getContact).toHaveBeenCalledWith(123);
  });

  it('ListContacts calls adapter with pagination', async () => {
    const mockAdapter = adapter();
    const module = createAmoCrmModule({ adapter: mockAdapter });
    const result = await module.ListContacts(crm.ListContactsRequest.create({ base: { limit: 10, offset: 0 } }));
    expect(result.items).toHaveLength(1);
    expect(mockAdapter.listContacts).toHaveBeenCalled();
  });

  it('CreateContact requires idempotency key', async () => {
    const mockAdapter = adapter();
    const module = createAmoCrmModule({ adapter: mockAdapter });
    await expect(module.CreateContact(crm.CreateContactRequest.create({}))).rejects.toMatchObject({
      canonicalCode: 'CRM_STRUCTURAL_MISSING_REQUIRED_FIELD',
    });
  });

  it('dedupes repeated CreateContact calls with the same idempotency key', async () => {
    let createContactCalls = 0;
    const mockAdapter = adapter({
      createContact: mock(async () => {
        createContactCalls += 1;
        return createContactCalls === 1
          ? [{ id: 124, name: 'Bob' }]
          : [{ id: 125, name: 'Duplicate Bob' }];
      }),
    });
    const module = createAmoCrmModule({ adapter: mockAdapter });
    const request = crm.CreateContactRequest.create({
      context: { idempotency_key: 'idem_repeat' },
      email: 'bob@example.com',
      name: { display: 'Bob' },
    });

    const first = await module.CreateContact(request);
    const second = await module.CreateContact(request);

    expect(first.ref?.canonical_id).toBe('124');
    expect(second.ref?.canonical_id).toBe('124');
    expect(mockAdapter.createContact).toHaveBeenCalledTimes(1);
  });

  it('UpdateContact calls adapter', async () => {
    const mockAdapter = adapter();
    const module = createAmoCrmModule({ adapter: mockAdapter });
    const contact = await module.UpdateContact(
      crm.UpdateContactRequest.create({ canonical_id: '123', email: 'new@example.com' }),
    );
    expect(contact.ref?.canonical_id).toBe('123');
    expect(mockAdapter.updateContact).toHaveBeenCalled();
  });

  it('DeleteContact soft deletes via update', async () => {
    const mockAdapter = adapter();
    const module = createAmoCrmModule({ adapter: mockAdapter });
    const contact = await module.DeleteContact(crm.DeleteContactRequest.create({ canonical_id: '123' }));
    expect(contact.status).toBe(crm.ContactStatus.CONTACT_STATUS_DELETED);
    expect(mockAdapter.updateContact).toHaveBeenCalledWith([{ id: 123, is_deleted: true }]);
  });

  it('GetCompany calls adapter', async () => {
    const mockAdapter = adapter();
    const module = createAmoCrmModule({ adapter: mockAdapter });
    const company = await module.GetCompany(crm.GetCompanyRequest.create({ canonical_id: '456' }));
    expect(company.ref?.canonical_id).toBe('456');
  });

  it('CreateCompany requires idempotency key', async () => {
    const mockAdapter = adapter();
    const module = createAmoCrmModule({ adapter: mockAdapter });
    await expect(module.CreateCompany(crm.CreateCompanyRequest.create({ name: 'Acme' }))).rejects.toMatchObject({
      canonicalCode: 'CRM_STRUCTURAL_MISSING_REQUIRED_FIELD',
    });
  });

  it('GetDeal calls adapter', async () => {
    const mockAdapter = adapter();
    const module = createAmoCrmModule({ adapter: mockAdapter });
    const deal = await module.GetDeal(crm.GetDealRequest.create({ canonical_id: '789' }));
    expect(deal.ref?.canonical_id).toBe('789');
  });

  it('CreateDeal requires idempotency key', async () => {
    const mockAdapter = adapter();
    const module = createAmoCrmModule({ adapter: mockAdapter });
    await expect(module.CreateDeal(crm.CreateDealRequest.create({ name: 'Deal' }))).rejects.toMatchObject({
      canonicalCode: 'CRM_STRUCTURAL_MISSING_REQUIRED_FIELD',
    });
  });

  it('GetActivity calls adapter', async () => {
    const mockAdapter = adapter();
    const module = createAmoCrmModule({ adapter: mockAdapter });
    const activity = await module.GetActivity(crm.GetActivityRequest.create({ canonical_id: '100' }));
    expect(activity.ref?.canonical_id).toBe('100');
  });

  it('CreateActivity requires idempotency key', async () => {
    const mockAdapter = adapter();
    const module = createAmoCrmModule({ adapter: mockAdapter });
    await expect(module.CreateActivity(crm.CreateActivityRequest.create({ subject: 'Task' }))).rejects.toMatchObject({
      canonicalCode: 'CRM_STRUCTURAL_MISSING_REQUIRED_FIELD',
    });
  });

  it('rejects invalid CreateActivity due_at instead of defaulting to now', async () => {
    const mockAdapter = adapter();
    const module = createAmoCrmModule({ adapter: mockAdapter });

    await expect(
      module.CreateActivity(
        crm.CreateActivityRequest.create({
          context: { idempotency_key: 'idem_due_at' },
          subject: 'Task',
          due_at: { seconds: 'not-a-number' as never },
        }),
      ),
    ).rejects.toMatchObject({
      canonicalCode: 'CRM_STRUCTURAL_MISSING_REQUIRED_FIELD',
    });
    expect(mockAdapter.createTask).not.toHaveBeenCalled();
  });

  it('GetNote calls adapter', async () => {
    const mockAdapter = adapter();
    const module = createAmoCrmModule({ adapter: mockAdapter });
    const note = await module.GetNote(crm.GetNoteRequest.create({ canonical_id: '200' }));
    expect(note.ref?.canonical_id).toBe('200');
  });

  it('CreateNote requires idempotency key', async () => {
    const mockAdapter = adapter();
    const module = createAmoCrmModule({ adapter: mockAdapter });
    await expect(module.CreateNote(crm.CreateNoteRequest.create({ content: 'Note' }))).rejects.toMatchObject({
      canonicalCode: 'CRM_STRUCTURAL_MISSING_REQUIRED_FIELD',
    });
  });

  it('ListPipelines calls adapter', async () => {
    const mockAdapter = adapter();
    const module = createAmoCrmModule({ adapter: mockAdapter });
    const result = await module.ListPipelines(crm.ListPipelinesRequest.create({}));
    expect(result.items).toHaveLength(1);
  });

  it('ListCustomFieldDefinitions calls adapter', async () => {
    const mockAdapter = adapter();
    const module = createAmoCrmModule({ adapter: mockAdapter });
    const result = await module.ListCustomFieldDefinitions(
      crm.ListCustomFieldDefinitionsRequest.create({ entity_type: 'contacts' }),
    );
    expect(result.items).toHaveLength(1);
  });

  it('CreateAssociation rejects labels', async () => {
    const mockAdapter = adapter();
    const module = createAmoCrmModule({ adapter: mockAdapter });
    await expect(
      module.CreateAssociation(
        crm.CreateAssociationRequest.create({
          from: { entity_type: 'contact', canonical_id: '123' },
          to: { entity_type: 'company', canonical_id: '456' },
          label: 'primary',
        }),
      ),
    ).rejects.toMatchObject({
      canonicalCode: 'CRM_STRUCTURAL_MISSING_REQUIRED_FIELD',
    });
  });

  it('CreateAssociation calls adapter for flat associations', async () => {
    const mockAdapter = adapter();
    const module = createAmoCrmModule({ adapter: mockAdapter });
    const result = await module.CreateAssociation(
      crm.CreateAssociationRequest.create({
        from: { entity_type: 'contact', canonical_id: '123' },
        to: { entity_type: 'company', canonical_id: '456' },
      }),
    );
    expect(result.from?.canonical_id).toBe('123');
    expect(result.to?.canonical_id).toBe('456');
    expect(mockAdapter.createAssociation).toHaveBeenCalledWith('contact', 123, 'company', 456);
  });

  it('DeleteAssociation calls adapter', async () => {
    const mockAdapter = adapter();
    const module = createAmoCrmModule({ adapter: mockAdapter });
    await module.DeleteAssociation(
      crm.DeleteAssociationRequest.create({ canonical_id: 'contact:123:company:456' }),
    );
    expect(mockAdapter.deleteAssociation).toHaveBeenCalledWith('contact', 123, 'company', 456);
  });

  it('rejects DeleteAssociation canonical ids with non-numeric entity ids', async () => {
    const mockAdapter = adapter();
    const module = createAmoCrmModule({ adapter: mockAdapter });

    await expect(
      module.DeleteAssociation(crm.DeleteAssociationRequest.create({ canonical_id: 'contact:abc:company:456' })),
    ).rejects.toMatchObject({
      canonicalCode: 'CRM_STRUCTURAL_MISSING_REQUIRED_FIELD',
    });
    expect(mockAdapter.deleteAssociation).not.toHaveBeenCalled();
  });

  it('returns UNIMPLEMENTED for unsupported RPCs', async () => {
    const mockAdapter = adapter();
    const module = createAmoCrmModule({ adapter: mockAdapter });

    await expect(module.UpdateActivity(crm.UpdateActivityRequest.create({ canonical_id: '1' }))).rejects.toMatchObject({
      code: GRPC_STATUS_UNIMPLEMENTED,
    });
    await expect(module.DeleteActivity(crm.DeleteActivityRequest.create({ canonical_id: '1' }))).rejects.toMatchObject({
      code: GRPC_STATUS_UNIMPLEMENTED,
    });
    await expect(module.DeleteNote(crm.DeleteNoteRequest.create({ canonical_id: '1' }))).rejects.toMatchObject({
      code: GRPC_STATUS_UNIMPLEMENTED,
    });
    await expect(module.ListAssociations(crm.ListAssociationsRequest.create({}))).rejects.toMatchObject({
      code: GRPC_STATUS_UNIMPLEMENTED,
    });
    await expect(module.SyncDelta(crm.SyncDeltaRequest.create({}))).rejects.toMatchObject({
      code: GRPC_STATUS_UNIMPLEMENTED,
    });
    await expect(module.SubmitJob(crm.SubmitJobRequest.create({}))).rejects.toMatchObject({
      code: GRPC_STATUS_UNIMPLEMENTED,
    });
    await expect(module.GetJob(crm.GetJobRequest.create({ canonical_id: '1' }))).rejects.toMatchObject({
      code: GRPC_STATUS_UNIMPLEMENTED,
    });
    await expect(module.CancelJob(crm.CancelJobRequest.create({ canonical_id: '1' }))).rejects.toMatchObject({
      code: GRPC_STATUS_UNIMPLEMENTED,
    });
    await expect(module.ListJobs(crm.ListJobsRequest.create({}))).rejects.toMatchObject({
      code: GRPC_STATUS_UNIMPLEMENTED,
    });
  });

  it('maps adapter errors to canonical codes', async () => {
    const mockAdapter = adapter({
      getContact: mock(async () => {
        throw Object.assign(new Error('Not found'), { status: 404 });
      }),
    });
    const module = createAmoCrmModule({ adapter: mockAdapter });

    let thrown: unknown;
    try {
      await module.GetContact(crm.GetContactRequest.create({ canonical_id: '999' }));
    } catch (error) {
      thrown = error;
    }

    expect(isAmoCrmError(thrown)).toBe(true);
    if (isAmoCrmError(thrown)) {
      expect(thrown.canonicalCode).toBe('CRM_REFERENCES_CONTACT_NOT_FOUND');
    }
  });

  it('maps 403 adapter errors to a permission-denied canonical code', async () => {
    const mockAdapter = adapter({
      getContact: mock(async () => {
        throw Object.assign(new Error('Forbidden'), { status: 403 });
      }),
    });
    const module = createAmoCrmModule({ adapter: mockAdapter });

    await expect(module.GetContact(crm.GetContactRequest.create({ canonical_id: '123' }))).rejects.toMatchObject({
      code: 7,
      canonicalCode: 'CRM_VENDOR_FORBIDDEN',
    });
  });
});
