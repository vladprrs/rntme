import { afterEach, describe, expect, it, mock } from 'bun:test';

let currentAmo: unknown;
const AmoMock = mock(() => currentAmo);

mock.module('@shevernitskiy/amo', () => ({
  Amo: AmoMock,
}));

describe('AmoCrm adapter', () => {
  afterEach(() => {
    AmoMock.mockClear();
    currentAmo = undefined;
  });

  it('wraps SDK methods', async () => {
    const mockLead = { id: 1, name: 'Test Lead' };
    const mockContact = { id: 2, name: 'Test Contact' };
    const mockCompany = { id: 3, name: 'Test Company' };
    const mockTask = { id: 4, text: 'Test Task' };
    const mockNote = { id: 5, text: 'Test Note' };
    const mockPipeline = { id: 6, name: 'Test Pipeline' };
    const mockCustomField = { id: 7, name: 'Test Field' };
    const mockUser = { id: 8, name: 'Test User' };

    const mockAmo = {
      lead: {
        getLeadById: mock(async () => mockLead),
        getLeads: mock(async () => ({ _embedded: { items: [mockLead] } })),
        addLeads: mock(async () => [mockLead]),
        updateLeads: mock(async () => [mockLead]),
      },
      contact: {
        getContactById: mock(async () => mockContact),
        getContacts: mock(async () => ({ _embedded: { items: [mockContact] } })),
        addContacts: mock(async () => [mockContact]),
        updateContacts: mock(async () => [mockContact]),
      },
      company: {
        getCompanyById: mock(async () => mockCompany),
        getCompanies: mock(async () => ({ _embedded: { items: [mockCompany] } })),
        addCompanies: mock(async () => [mockCompany]),
        updateCompanies: mock(async () => [mockCompany]),
      },
      task: {
        getTaskById: mock(async () => mockTask),
        getTasks: mock(async () => ({ _embedded: { items: [mockTask] } })),
        addTasks: mock(async () => [mockTask]),
      },
      note: {
        getNotesById: mock(async () => mockNote),
        getNotesByEntityType: mock(async () => ({ _embedded: { items: [mockNote] } })),
        addNotes: mock(async () => [mockNote]),
      },
      pipeline: {
        getPipelines: mock(async () => [mockPipeline]),
      },
      custom_fields: {
        getCustomFields: mock(async () => ({ _embedded: { items: [mockCustomField] } })),
      },
      user: {
        getUsers: mock(async () => ({ _embedded: { items: [mockUser] } })),
      },
      link: {
        addLinksByEntityId: mock(async () => ({})),
        deleteLinksByEntityId: mock(async () => undefined),
      },
    };

    currentAmo = mockAmo;

    const { createAmoCrmAdapter: createAdapter } = await import('../../src/adapter.js');

    const adapter = createAdapter({
      subdomain: 'test',
      auth: { access_token: 'token', refresh_token: 'refresh', token_type: 'Bearer', expires_in: 3600, expires_at: Date.now() + 3600000, client_id: 'client', client_secret: 'secret', redirect_uri: 'http://localhost' },
    });

    const lead = await adapter.getLead(1);
    expect(lead).toEqual(mockLead);

    const leads = await adapter.listLeads();
    expect(leads.data).toHaveLength(1);

    const contact = await adapter.getContact(2);
    expect(contact).toEqual(mockContact);

    const company = await adapter.getCompany(3);
    expect(company).toEqual(mockCompany);

    const task = await adapter.getTask(4);
    expect(task).toEqual(mockTask);

    const note = await adapter.getNote('leads', 5);
    expect(note).toEqual(mockNote);

    const pipelines = await adapter.getPipelines();
    expect(pipelines).toHaveLength(1);

    const users = await adapter.getUsers();
    expect(users.data).toHaveLength(1);

    await adapter.createAssociation('contacts', 1, 'companies', 2);
    expect(mockAmo.link.addLinksByEntityId).toHaveBeenCalledWith(1, 'contacts', [{ to_entity_id: 2, to_entity_type: 'companies' }]);

    await adapter.deleteAssociation('contacts', 1, 'companies', 2);
    expect(mockAmo.link.deleteLinksByEntityId).toHaveBeenCalledWith(1, 'contacts', [{ to_entity_id: 2, to_entity_type: 'companies' }]);
  });

  it('does not treat array SDK responses as records', async () => {
    const mockAmo = {
      lead: {
        getLeadById: mock(async () => []),
      },
    };

    currentAmo = mockAmo;

    const { createAmoCrmAdapter: createAdapter } = await import('../../src/adapter.js');
    const adapter = createAdapter({
      subdomain: 'test',
      auth: { access_token: 'token', refresh_token: 'refresh', token_type: 'Bearer', expires_in: 3600, expires_at: Date.now() + 3600000, client_id: 'client', client_secret: 'secret', redirect_uri: 'http://localhost' },
    });

    await expect(adapter.getLead(1)).resolves.toEqual({});
  });
});
