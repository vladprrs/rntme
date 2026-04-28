import { describe, expect, it, vi } from 'vitest';

describe('AmoCrm adapter', () => {
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
        getLeadById: vi.fn().mockResolvedValue(mockLead),
        getLeads: vi.fn().mockResolvedValue({ _embedded: { items: [mockLead] } }),
        addLeads: vi.fn().mockResolvedValue([mockLead]),
        updateLeads: vi.fn().mockResolvedValue([mockLead]),
      },
      contact: {
        getContactById: vi.fn().mockResolvedValue(mockContact),
        getContacts: vi.fn().mockResolvedValue({ _embedded: { items: [mockContact] } }),
        addContacts: vi.fn().mockResolvedValue([mockContact]),
        updateContacts: vi.fn().mockResolvedValue([mockContact]),
      },
      company: {
        getCompanyById: vi.fn().mockResolvedValue(mockCompany),
        getCompanies: vi.fn().mockResolvedValue({ _embedded: { items: [mockCompany] } }),
        addCompanies: vi.fn().mockResolvedValue([mockCompany]),
        updateCompanies: vi.fn().mockResolvedValue([mockCompany]),
      },
      task: {
        getTaskById: vi.fn().mockResolvedValue(mockTask),
        getTasks: vi.fn().mockResolvedValue({ _embedded: { items: [mockTask] } }),
        addTasks: vi.fn().mockResolvedValue([mockTask]),
      },
      note: {
        getNotesById: vi.fn().mockResolvedValue(mockNote),
        getNotesByEntityType: vi.fn().mockResolvedValue({ _embedded: { items: [mockNote] } }),
        addNotes: vi.fn().mockResolvedValue([mockNote]),
      },
      pipeline: {
        getPipelines: vi.fn().mockResolvedValue([mockPipeline]),
      },
      custom_fields: {
        getCustomFields: vi.fn().mockResolvedValue({ _embedded: { items: [mockCustomField] } }),
      },
      user: {
        getUsers: vi.fn().mockResolvedValue({ _embedded: { items: [mockUser] } }),
      },
      link: {
        addLinksByEntityId: vi.fn().mockResolvedValue({}),
        deleteLinksByEntityId: vi.fn().mockResolvedValue(undefined),
      },
    };

    vi.doMock('@shevernitskiy/amo', () => ({
      Amo: vi.fn().mockImplementation(() => mockAmo),
    }));

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

    vi.doUnmock('@shevernitskiy/amo');
  });
});
