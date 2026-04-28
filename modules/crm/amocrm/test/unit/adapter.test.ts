import { describe, it, expect } from 'vitest';
import { createAmoCrmAdapter } from '../../src/adapter.js';
import type { AmoCrmConfig } from '../../src/types.js';

const mockConfig: AmoCrmConfig = {
  subdomain: 'test.amocrm.ru',
  auth: {
    client_id: 'test-client',
    client_secret: 'test-secret',
    redirect_uri: 'https://test.local',
    access_token: 'test-token',
    refresh_token: 'test-refresh',
  },
};

describe('createAmoCrmAdapter', () => {
  it('creates an adapter instance', () => {
    const adapter = createAmoCrmAdapter({ config: mockConfig });
    expect(adapter).toBeDefined();
    expect(typeof adapter.getContact).toBe('function');
    expect(typeof adapter.listContacts).toBe('function');
    expect(typeof adapter.addContacts).toBe('function');
    expect(typeof adapter.updateContacts).toBe('function');
    expect(typeof adapter.getLead).toBe('function');
    expect(typeof adapter.listLeads).toBe('function');
    expect(typeof adapter.addLeads).toBe('function');
    expect(typeof adapter.updateLeads).toBe('function');
    expect(typeof adapter.getCompany).toBe('function');
    expect(typeof adapter.listCompanies).toBe('function');
    expect(typeof adapter.addCompanies).toBe('function');
    expect(typeof adapter.updateCompanies).toBe('function');
    expect(typeof adapter.getTask).toBe('function');
    expect(typeof adapter.listTasks).toBe('function');
    expect(typeof adapter.addTasks).toBe('function');
    expect(typeof adapter.updateTasks).toBe('function');
    expect(typeof adapter.getNote).toBe('function');
    expect(typeof adapter.listNotes).toBe('function');
    expect(typeof adapter.addNotes).toBe('function');
    expect(typeof adapter.listPipelines).toBe('function');
    expect(typeof adapter.listCustomFields).toBe('function');
    expect(typeof adapter.listUsers).toBe('function');
    expect(typeof adapter.listLinks).toBe('function');
    expect(typeof adapter.addLinks).toBe('function');
    expect(typeof adapter.deleteLinks).toBe('function');
    expect(typeof adapter.webhookHandler).toBe('function');
  });
});
