import { describe, expect, it } from 'bun:test';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import {
  PlatformAPIExplorer,
  PlatformDataModelExplorer,
  PlatformDataTable,
  PlatformPageHeader,
  PlatformPanel,
  PlatformServicesPanel,
  PlatformSidebar,
  PlatformSummaryGrid,
  PlatformTimeline,
  PlatformTokenIssuer,
  PlatformTopbar,
} from '../src/client.js';
import {
  createTransportChain,
  StoreProvider,
  TransportProvider,
} from '@rntme/contracts-client-runtime-v1';

function createTestStore(initial: Record<string, unknown>) {
  let snapshot = { ...initial };
  const listeners = new Set<() => void>();
  const read = (path: string) => {
    const parts = path.replace(/^\//, '').split('/').filter(Boolean);
    let value: unknown = snapshot;
    for (const part of parts) {
      if (!value || typeof value !== 'object') return undefined;
      value = (value as Record<string, unknown>)[part];
    }
    return value;
  };
  return {
    get: read,
    set: (path: string, value: unknown) => {
      const parts = path.replace(/^\//, '').split('/').filter(Boolean);
      if (parts.length === 0) return;
      const next = { ...snapshot };
      let target: Record<string, unknown> = next;
      for (const part of parts.slice(0, -1)) {
        const current = target[part];
        const child = current && typeof current === 'object' ? { ...(current as Record<string, unknown>) } : {};
        target[part] = child;
        target = child;
      }
      target[parts[parts.length - 1]!] = value;
      snapshot = next;
      for (const listener of listeners) listener();
    },
    update: (updates: Record<string, unknown>) => {
      snapshot = { ...snapshot, ...updates };
      for (const listener of listeners) listener();
    },
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function richDataModelFixture() {
  return {
    summary: {
      entities: 3,
      fields: 7,
      relationships: 3,
      qsmProjections: 1,
      warnings: 0,
      errors: 0,
    },
    entities: [
      {
        name: 'Customer',
        ownerService: 'crm',
        kind: 'owned',
        table: 'customers',
        path: 'pdm/entities/customer.json',
        keys: ['id'],
        fields: [
          { name: 'id', type: 'uuid', nullable: false, column: 'id', primaryKey: true, stateField: false, qsmProjections: [] },
          { name: 'name', type: 'string', nullable: false, column: 'name', primaryKey: false, stateField: false, qsmProjections: ['DealList'] },
        ],
        relations: [],
        qsmProjections: ['DealList'],
        endpoints: [{ service: 'crm', operation: 'listDeals', method: 'GET', path: '/deals', graph: 'listDeals' }],
        raw: { name: 'Customer' },
      },
      {
        name: 'Deal',
        ownerService: 'crm',
        kind: 'owned',
        table: 'deals',
        path: 'pdm/entities/deal.json',
        keys: ['id'],
        fields: [
          { name: 'id', type: 'uuid', nullable: false, column: 'id', primaryKey: true, stateField: false, qsmProjections: [] },
          { name: 'customerId', type: 'uuid', nullable: false, column: 'customer_id', primaryKey: false, stateField: false, qsmProjections: ['DealList'] },
          { name: 'status', type: 'string', nullable: false, column: 'status', primaryKey: false, stateField: true, qsmProjections: ['DealList'] },
        ],
        relations: [
          { name: 'customer', target: 'Customer', cardinality: 'many-to-one', localKey: 'customerId', foreignKey: 'id', missingTarget: false },
          { name: 'primaryContact', target: 'ContactPerson', cardinality: 'many-to-one', localKey: 'primaryContactId', foreignKey: 'id', missingTarget: true },
        ],
        stateMachine: { stateField: 'status', states: ['open', 'won'], transitions: ['create'] },
        qsmProjections: ['DealList'],
        endpoints: [{ service: 'crm', operation: 'listDeals', method: 'GET', path: '/deals', graph: 'listDeals' }],
        raw: { name: 'Deal' },
      },
      {
        name: 'Call',
        ownerService: 'calls',
        kind: 'owned',
        table: 'calls',
        path: 'pdm/entities/call.json',
        keys: ['id'],
        fields: [
          { name: 'id', type: 'uuid', nullable: false, column: 'id', primaryKey: true, stateField: false, qsmProjections: [] },
          { name: 'dealId', type: 'uuid', nullable: false, column: 'deal_id', primaryKey: false, stateField: false, qsmProjections: [] },
        ],
        relations: [
          { name: 'deal', target: 'Deal', cardinality: 'many-to-one', localKey: 'dealId', foreignKey: 'id', missingTarget: false },
        ],
        qsmProjections: [],
        endpoints: [],
        raw: { name: 'Call' },
      },
    ],
    qsmProjections: [
      {
        name: 'DealList',
        service: 'crm',
        path: 'services/crm/qsm/projections/deal-list.json',
        backing: 'entity-mirror',
        sourceEntity: 'Deal',
        keys: ['id'],
        grain: ['id'],
        exposed: ['status'],
        fields: [
          { name: 'status', type: 'string', nullable: false, source: 'Deal.status', computed: false },
          { name: 'customerName', type: 'string', nullable: false, source: 'Customer.name', computed: true },
        ],
        endpoints: [{ service: 'crm', operation: 'listDeals', method: 'GET', path: '/deals', graph: 'listDeals' }],
        raw: { name: 'DealList' },
      },
    ],
    relationships: [
      { source: 'Deal', name: 'customer', target: 'Customer', cardinality: 'many-to-one', path: 'pdm/entities/deal.json#/relations/customer', missingTarget: false },
      { source: 'Deal', name: 'primaryContact', target: 'ContactPerson', cardinality: 'many-to-one', path: 'pdm/entities/deal.json#/relations/primaryContact', missingTarget: true },
      { source: 'Call', name: 'deal', target: 'Deal', cardinality: 'many-to-one', path: 'pdm/entities/call.json#/relations/deal', missingTarget: false },
    ],
    findings: [
      {
        kind: 'warning',
        entity: 'Deal',
        artifact: 'pdm/entities/deal.json',
        jsonPath: '$.relations.primaryContact',
        message: 'Missing relationship target ContactPerson.',
        suggestedAction: 'Create ContactPerson or update the relationship target.',
      },
    ],
  };
}

describe('@rntme/platform-ui components', () => {
  it('renders the page header with platform class names', () => {
    const store = createTestStore({});
    const html = renderToStaticMarkup(
      React.createElement(
        StoreProvider,
        { value: store as never },
        React.createElement(PlatformPageHeader, { eyebrow: 'Project', title: 'Deployments' }),
      ),
    );

    expect(html).toContain('rntme-page-head');
    expect(html).toContain('Deployments');
  });

  it('renders page header meta from a statePath, deriving Blueprint/Status from the latest version', () => {
    const store = createTestStore({
      data: {
        versions: [
          { projectId: 'p1', sequence: 1, status: 'published' },
          { projectId: 'p1', sequence: 3, status: 'published' },
          { projectId: 'p1', sequence: 2, status: 'rejected' },
        ],
      },
    });
    const html = renderWithStore(
      React.createElement(PlatformPageHeader, {
        eyebrow: 'Project',
        title: 'Project overview',
        statePath: '/data/versions',
        meta: [
          { label: 'Environment', value: 'Preview' },
          { label: 'Published by', value: 'CLI' },
        ],
      }),
      store,
    );

    expect(html).toContain('v3');
    expect(html).toContain('Ready');
    expect(html).toContain('Environment');
    expect(html).toContain('Published by');
    expect(html).not.toContain('v0.3.2');
  });

  it('renders page header version meta as placeholders when the statePath is missing', () => {
    const store = createTestStore({});
    const html = renderWithStore(
      React.createElement(PlatformPageHeader, {
        title: 'Project overview',
        statePath: '/data/versions',
      }),
      store,
    );

    expect(html).toContain('Blueprint');
    expect(html).toContain('Status');
    expect(html).toContain('—');
  });

  it('renders page header from literal props.meta when no statePath is given', () => {
    const store = createTestStore({});
    const html = renderWithStore(
      React.createElement(PlatformPageHeader, {
        title: 'Project overview',
        meta: [{ label: 'Blueprint', value: 'v0.3.2' }],
      }),
      store,
    );

    expect(html).toContain('Blueprint');
    expect(html).toContain('v0.3.2');
  });

  it('renders page header actions as route-aware links when hrefTemplate is provided', () => {
    const store = createTestStore({
      route: {
        params: {
          orgId: 'org_uZUWhpWgK54VWC2X',
          projectId: 'p1',
        },
      },
    });
    const actions = [
      { label: 'Data model', hrefTemplate: '/{orgId}/projects/{projectId}/data-model' },
      { label: 'API', hrefTemplate: '/{orgId}/projects/{projectId}/api', variant: 'primary' },
    ];
    const html = renderWithStore(
      React.createElement(PlatformPageHeader, {
        title: 'Project overview',
        actions,
      }),
      store,
    );

    expect(html).toContain('<a href="/org_uZUWhpWgK54VWC2X/projects/p1/data-model"');
    expect(html).toContain('<a href="/org_uZUWhpWgK54VWC2X/projects/p1/api"');
    expect(html).not.toContain('<button');
  });

  it('renders panel children through React', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlatformPanel, { title: 'Panel' }, React.createElement('span', null, 'inside')),
    );

    expect(html).toContain('rntme-panel');
    expect(html).toContain('inside');
  });

  it('renders the platform sidebar brand', () => {
    const store = createTestStore({});
    const html = renderWithStore(
      React.createElement(PlatformSidebar, { brand: 'rntme', items: [{ label: 'Projects', href: '/' }] }),
      store,
    );

    expect(html).toContain('rntme-sidebar');
    expect(html).toContain('Projects');
  });

  it('resolves sidebar item hrefTemplate against route params', () => {
    const store = createTestStore({
      route: { path: '/org_X', params: { orgId: 'org_X' } },
    });
    const html = renderWithStore(
      React.createElement(PlatformSidebar, {
        brand: 'rntme',
        items: [
          { label: 'Dashboard', hrefTemplate: '/{orgId}', section: 'Project' },
          { label: 'Audit log', hrefTemplate: '/{orgId}/audit', section: 'Account' },
        ],
      }),
      store,
    );

    expect(html).toContain('href="/org_X"');
    expect(html).toContain('href="/org_X/audit"');
  });

  it('marks the sidebar item active when the resolved href matches /route/path exactly', () => {
    const store = createTestStore({
      route: { path: '/org_X/audit', params: { orgId: 'org_X' } },
    });
    const html = renderWithStore(
      React.createElement(PlatformSidebar, {
        brand: 'rntme',
        items: [
          { label: 'Dashboard', hrefTemplate: '/{orgId}', section: 'Project' },
          { label: 'Audit log', hrefTemplate: '/{orgId}/audit', section: 'Account' },
        ],
      }),
      store,
    );

    // Audit log is the current path; Dashboard must not be active.
    expect(html).toContain('href="/org_X/audit" class="is-active" aria-current="page"');
    expect(html).not.toContain('href="/org_X" class="is-active"');
  });

  it('marks the sidebar item active via matchPattern startsWith on nested routes', () => {
    const store = createTestStore({
      route: {
        path: '/org_X/projects/p1/data-model',
        params: { orgId: 'org_X', projectId: 'p1' },
      },
    });
    const html = renderWithStore(
      React.createElement(PlatformSidebar, {
        brand: 'rntme',
        items: [
          {
            label: 'Projects',
            hrefTemplate: '/{orgId}',
            matchPattern: '/{orgId}/projects',
            section: 'Project',
          },
        ],
      }),
      store,
    );

    // matchPattern resolves with route params and a startsWith match keeps the
    // Projects entry active under any /projects/* sub-path.
    expect(html).toContain('class="is-active"');
  });

  it('renders the platform topbar with literal crumbs when crumbsFromRoute is absent', () => {
    const store = createTestStore({});
    const html = renderWithStore(
      React.createElement(PlatformTopbar, {
        crumbs: [
          { label: 'platform' },
          { label: 'dashboard', current: true },
        ],
      }),
      store,
    );

    expect(html).toContain('rntme-topbar');
    expect(html).toContain('platform');
    expect(html).toContain('<b>dashboard</b>');
  });

  it('derives topbar crumbs from /route/path when crumbsFromRoute is true', () => {
    const store = createTestStore({
      route: {
        path: '/org_uZUWhpWgK54VWC2X/projects/p1/data-model',
        params: { orgId: 'org_uZUWhpWgK54VWC2X', projectId: 'p1' },
      },
    });
    const html = renderWithStore(
      React.createElement(PlatformTopbar, { crumbsFromRoute: true }),
      store,
    );

    expect(html).toContain('platform');
    expect(html).toContain('Projects');
    expect(html).toContain('<b>Data model</b>');
  });

  it('skips auth-flow path segments when deriving topbar crumbs', () => {
    const store = createTestStore({
      route: { path: '/auth/callback', params: {} },
    });
    const html = renderWithStore(
      React.createElement(PlatformTopbar, { crumbsFromRoute: true }),
      store,
    );

    // `auth` and `callback` segments are explicitly skipped so the topbar
    // renders only the leading `platform` crumb on the SPA bootstrap route.
    expect(html).toContain('platform');
    expect(html).not.toContain('callback');
    expect(html).not.toContain('>auth<');
  });

  it('resolves topbar action hrefTemplate against route params', () => {
    const store = createTestStore({
      route: { path: '/org_X', params: { orgId: 'org_X' } },
    });
    const html = renderWithStore(
      React.createElement(PlatformTopbar, {
        crumbsFromRoute: true,
        actions: [
          { label: 'Org settings', hrefTemplate: '/{orgId}/tokens', variant: 'ghost' },
        ],
      }),
      store,
    );

    expect(html).toContain('href="/org_X/tokens"');
  });

  function renderWithStore(element: React.ReactElement, store: ReturnType<typeof createTestStore>): string {
    // Provide a no-op transport so components that conditionally call
    // `useTransport` (e.g. PlatformAPIExplorer detail-fetch effect) can render
    // statically without throwing. The transport is never invoked from
    // `renderToStaticMarkup` because no effects run.
    const noopTransport = createTransportChain(async () =>
      new globalThis.Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    return renderToStaticMarkup(
      React.createElement(
        StoreProvider,
        { value: store as never },
        React.createElement(TransportProvider, { value: noopTransport }, element),
      ),
    );
  }

  it('renders the product data table marker', () => {
    const store = createTestStore({});
    const html = renderWithStore(
      React.createElement(PlatformDataTable, { statePath: '/data/projects' }),
      store,
    );

    expect(html).toContain('data-rntme-component="DataTable"');
    expect(html).toContain('/data/projects');
  });

  it('renders data table rows from an envelope-wrapped statePath', () => {
    const store = createTestStore({
      data: {
        projects: {
          status: 'ok',
          projects: [
            { id: 'p1', slug: 'cv-extract', displayName: 'CV Extract', status: 'active' },
          ],
        },
      },
    });
    const html = renderWithStore(
      React.createElement(PlatformDataTable, {
        statePath: '/data/projects',
        columns: [
          { key: 'slug', label: 'Slug' },
          { key: 'displayName', label: 'Name' },
          { key: 'status', label: 'Status' },
        ],
      }),
      store,
    );

    expect(html).toContain('<td>cv-extract</td>');
    expect(html).toContain('<td>CV Extract</td>');
    expect(html).toContain('<td>active</td>');
  });

  it('renders data table link columns from row fields and route params', () => {
    const store = createTestStore({
      route: { params: { orgId: 'org_uZUWhpWgK54VWC2X' } },
      data: {
        projects: {
          status: 'ok',
          projects: [
            { id: 'p1', slug: 'cv-extract', displayName: 'CV Extract', status: 'active' },
          ],
        },
      },
    });
    const columns = [
      { key: 'displayName', label: 'Name' },
      {
        key: 'open',
        label: 'Open',
        value: 'Open',
        hrefTemplate: '/{orgId}/projects/{id}',
      },
    ];
    const html = renderWithStore(
      React.createElement(PlatformDataTable, {
        statePath: '/data/projects',
        columns,
      }),
      store,
    );

    expect(html).toContain('<a href="/org_uZUWhpWgK54VWC2X/projects/p1">Open</a>');
  });

  it('dispatches data table link template per row via hrefTemplateMap', () => {
    // Simulates the platform audit table: each row has a `targetType`
    // (`deployment` / `project` / `deploy-target`) and a `targetId`; the
    // column should route each row to a different detail screen and leave
    // unknown types as plain text without producing a non-resolving URL.
    const store = createTestStore({
      route: { params: { orgId: 'org_X' } },
      data: {
        events: [
          { id: 'a1', targetType: 'deployment', targetId: 'dep-1' },
          { id: 'a2', targetType: 'project', targetId: 'p1' },
          { id: 'a3', targetType: 'membership', targetId: 'm1' },
        ],
      },
    });
    const columns = [
      {
        key: 'targetId',
        label: 'Target',
        hrefTemplateMap: {
          typeField: 'targetType',
          byType: {
            deployment: '/{orgId}/deployments/{targetId}',
            project: '/{orgId}/projects/{targetId}',
          },
        },
      },
    ];
    const html = renderWithStore(
      React.createElement(PlatformDataTable, {
        statePath: '/data/events',
        columns,
      }),
      store,
    );

    expect(html).toContain('<a href="/org_X/deployments/dep-1">dep-1</a>');
    expect(html).toContain('<a href="/org_X/projects/p1">p1</a>');
    // The unknown targetType row renders as plain text — no anchor wrapper
    // and no non-resolving deployment URL.
    expect(html).toContain('<td>m1</td>');
    expect(html).not.toContain('href="/org_X/deployments/m1"');
  });

  it('renders data table rows from a bare-array statePath', () => {
    const store = createTestStore({
      data: { versions: [{ sequence: 1, status: 'published' }] },
    });
    const html = renderWithStore(
      React.createElement(PlatformDataTable, {
        statePath: '/data/versions',
        columns: [
          { key: 'sequence', label: '#' },
          { key: 'status', label: 'Status' },
        ],
      }),
      store,
    );

    expect(html).toContain('<td>1</td>');
    expect(html).toContain('<td>published</td>');
  });

  it('renders a data table with no rows when state is missing without throwing', () => {
    const store = createTestStore({});
    const html = renderWithStore(
      React.createElement(PlatformDataTable, {
        statePath: '/data/projects',
        columns: [{ key: 'slug', label: 'Slug' }],
      }),
      store,
    );

    expect(html).toContain('data-rntme-component="DataTable"');
    expect(html).not.toContain('<td>cv-extract</td>');
  });

  it('renders services panel cards from a statePath', () => {
    const store = createTestStore({
      data: {
        services: [
          { name: 'svc-app', status: 'Ready', description: 'Domain service.' },
          { name: 'mod-openrouter', status: 'Ready' },
        ],
      },
    });
    const html = renderWithStore(
      React.createElement(PlatformServicesPanel, {
        title: 'Services',
        statePath: '/data/services',
      }),
      store,
    );

    expect(html).toContain('svc-app');
    expect(html).toContain('mod-openrouter');
  });

  it('renders per-service artifact counts on each service card', () => {
    const store = createTestStore({
      data: {
        services: [
          {
            name: 'projects',
            status: 'Ready',
            schemas: 1,
            graphs: 2,
            endpoints: 3,
            uiComponents: 0,
            entities: 0,
          },
        ],
      },
    });
    const html = renderWithStore(
      React.createElement(PlatformServicesPanel, {
        title: 'Services',
        statePath: '/data/services',
      }),
      store,
    );

    expect(html).toContain('projects');
    expect(html).toContain('rntme-artifact-chip');
    // schemas / graphs / endpoints / entities counts surface as chips.
    expect(html).toContain('schemas');
    expect(html).toContain('graphs');
    expect(html).toContain('endpoints');
    expect(html).toContain('>2<');
    expect(html).toContain('>3<');
  });

  it('renders services panel from literal props.services when no statePath is given', () => {
    const store = createTestStore({});
    const html = renderWithStore(
      React.createElement(PlatformServicesPanel, {
        title: 'Services',
        services: [{ name: 'projects', status: 'Ready' }],
      }),
      store,
    );

    expect(html).toContain('projects');
  });

  it('renders summary grid counts from an envelope-wrapped statePath', () => {
    const store = createTestStore({
      data: {
        summary: {
          status: 'ok',
          summary: {
            versions: 3,
            services: 2,
            entities: 7,
            schemas: 2,
            graphs: 5,
            endpoints: 11,
            uiComponents: 4,
          },
        },
      },
    });
    const html = renderWithStore(
      React.createElement(PlatformSummaryGrid, { statePath: '/data/summary' }),
      store,
    );

    expect(html).toContain('Versions');
    expect(html).toContain('>3<');
    expect(html).toContain('Endpoints');
    expect(html).toContain('>11<');
    expect(html).toContain('UI components');
    expect(html).toContain('>4<');
  });

  it('renders summary grid zeros when the statePath is missing without throwing', () => {
    const store = createTestStore({});
    const html = renderWithStore(
      React.createElement(PlatformSummaryGrid, { statePath: '/data/summary' }),
      store,
    );

    expect(html).toContain('rntme-summary');
    expect(html).toContain('Entities');
    expect(html).toContain('>0<');
  });

  it('renders summary grid from literal props.items when no statePath is given', () => {
    const store = createTestStore({});
    const html = renderWithStore(
      React.createElement(PlatformSummaryGrid, {
        items: [{ label: 'Versions', value: '—' }],
      }),
      store,
    );

    expect(html).toContain('Versions');
    expect(html).toContain('—');
  });

  it('renders the data model explorer from a statePath-backed model', () => {
    const store = createTestStore({
      data: {
        model: {
          status: 'ok',
          dataModel: {
            summary: {
              entities: 1,
              fields: 3,
              relationships: 0,
              qsmProjections: 1,
              warnings: 0,
              errors: 0,
            },
            entities: [
              {
                name: 'Customer',
                ownerService: 'sales',
                kind: 'owned',
                table: 'customers',
                path: 'pdm/entities/Customer.json',
                keys: ['id'],
                fields: [
                  {
                    name: 'id',
                    type: 'string',
                    nullable: false,
                    column: 'id',
                    generated: 'id',
                    primaryKey: true,
                    stateField: false,
                    qsmProjections: [],
                  },
                  {
                    name: 'name',
                    type: 'string',
                    nullable: false,
                    column: 'name',
                    primaryKey: false,
                    stateField: false,
                    qsmProjections: ['CustomerView'],
                  },
                  {
                    name: 'status',
                    type: 'string',
                    nullable: false,
                    column: 'status',
                    primaryKey: false,
                    stateField: true,
                    qsmProjections: ['CustomerView'],
                  },
                ],
                relations: [],
                stateMachine: { stateField: 'status', states: ['active'], transitions: ['create'] },
                qsmProjections: ['CustomerView'],
                endpoints: [
                  { service: 'sales', operation: 'listCustomers', method: 'GET', path: '/customers', graph: 'listCustomers' },
                ],
                raw: {},
              },
            ],
            qsmProjections: [
              {
                name: 'CustomerView',
                service: 'sales',
                path: 'services/sales/qsm/projections/CustomerView.json',
                backing: 'entity-mirror',
                sourceEntity: 'Customer',
                keys: ['id'],
                grain: ['id'],
                exposed: ['name', 'status'],
                fields: [
                  { name: 'name', type: 'string', nullable: false, source: 'Customer.name', computed: false },
                ],
                endpoints: [
                  { service: 'sales', operation: 'listCustomers', method: 'GET', path: '/customers', graph: 'listCustomers' },
                ],
                raw: {},
              },
            ],
            relationships: [],
            findings: [],
          },
        },
      },
    });
    const html = renderWithStore(
      React.createElement(PlatformDataModelExplorer, { statePath: '/data/model' }),
      store,
    );

    expect(html).toContain('rntme-data-model-explorer');
    expect(html).toContain('PDM entities');
    expect(html).toContain('QSM projections');
    expect(html).toContain('Customer');
    expect(html).toContain('CustomerView');
    expect(html).toContain('Used by');
    expect(html).toContain('pdm/entities/Customer.json');
  });

  it('renders data model explorer prototype controls, findings, and relationship diagram', () => {
    const store = createTestStore({
      data: { model: { status: 'ok', dataModel: richDataModelFixture() } },
    });
    const html = renderWithStore(
      React.createElement(PlatformDataModelExplorer, { statePath: '/data/model' }),
      store,
    );

    expect(html).toContain('Data-model findings');
    expect(html).toContain('Missing relationship target');
    expect(html).toContain('Search PDM entities');
    expect(html).toContain('All services');
    expect(html).toContain('All statuses');
    expect(html).toContain('Fields');
    expect(html).toContain('Relationships');
    expect(html).toContain('Used by');
    expect(html).toContain('Raw artifact');
    expect(html).toContain('rntme-dm-diagram');
    expect(html).toContain('Relationship diagram');
    expect(html).toContain('ContactPerson');
    expect(html).toContain('missing target');
  });

  it('supports data model explorer search, relationship navigation, field sheet, and copy toast', async () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
      url: 'https://platform.rntme.com/org/projects/p1/data-model',
    });
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousHTMLElement = globalThis.HTMLElement;
    const previousEvent = globalThis.Event;
    const previousActEnvironment = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    const copied: string[] = [];
    Object.defineProperties(globalThis, {
      window: { configurable: true, value: dom.window },
      document: { configurable: true, value: dom.window.document },
      HTMLElement: { configurable: true, value: dom.window.HTMLElement },
      Event: { configurable: true, value: dom.window.Event },
      navigator: { configurable: true, value: { clipboard: { writeText: (text: string) => copied.push(text) } } },
    });
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    const store = createTestStore({
      data: { model: { status: 'ok', dataModel: richDataModelFixture() } },
    });

    try {
      const rootEl = document.querySelector('#root') as Parameters<typeof createRoot>[0] | null;
      if (!rootEl) throw new Error('missing test root');
      const root = createRoot(rootEl);

      await act(async () => {
        root.render(
          React.createElement(
            StoreProvider,
            { value: store as never },
            React.createElement(PlatformDataModelExplorer, { statePath: '/data/model' }),
          ),
        );
      });

      const search = document.querySelector('input[aria-label="Search PDM entities"]');
      if (!(search instanceof dom.window.HTMLInputElement)) throw new Error('missing entity search');
      await act(async () => {
        search.value = 'deal';
        search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
      expect(Boolean(document.querySelector('[data-dm-entity="Customer"]'))).toBe(false);
      expect(Boolean(document.querySelector('[data-dm-entity="Deal"]'))).toBe(true);

      const deal = document.querySelector('[data-dm-entity="Deal"]');
      if (!(deal instanceof dom.window.HTMLButtonElement)) throw new Error('missing Deal button');
      await act(async () => {
        deal.click();
      });
      expect(rootEl.textContent).toContain('Deal');

      const statusField = document.querySelector('[data-dm-field="status"]');
      if (!(statusField instanceof dom.window.HTMLTableRowElement)) throw new Error('missing status field row');
      await act(async () => {
        statusField.click();
      });
      expect(rootEl.textContent).toContain('Field detail');
      expect(rootEl.textContent).toContain('Copy field path');

      const copyFieldPath = document.querySelector('[data-dm-copy-field-path]');
      if (!(copyFieldPath instanceof dom.window.HTMLButtonElement)) throw new Error('missing copy field path button');
      await act(async () => {
        copyFieldPath.click();
      });
      expect(copied).toContain('pdm/entities/deal.json#/fields/status');
      expect(rootEl.textContent).toContain('Copied field path');

      const relationshipsTab = document.querySelector('[data-dm-subtab="relationships"]');
      if (!(relationshipsTab instanceof dom.window.HTMLButtonElement)) throw new Error('missing relationships tab');
      await act(async () => {
        relationshipsTab.click();
      });
      const customerTarget = document.querySelector('[data-dm-relation-target="Customer"]');
      if (!(customerTarget instanceof dom.window.HTMLButtonElement)) throw new Error('missing relationship target button');
      await act(async () => {
        customerTarget.click();
      });
      expect(rootEl.textContent).toContain('pdm/entities/customer.json');

      await act(async () => {
        root.unmount();
      });
    } finally {
      (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      Object.defineProperties(globalThis, {
        window: { configurable: true, value: previousWindow },
        document: { configurable: true, value: previousDocument },
        HTMLElement: { configurable: true, value: previousHTMLElement },
        Event: { configurable: true, value: previousEvent },
      });
    }
  });

  it('renders the data model explorer empty state when no bundle model exists', () => {
    const store = createTestStore({});
    const html = renderWithStore(
      React.createElement(PlatformDataModelExplorer, { statePath: '/data/model' }),
      store,
    );

    expect(html).toContain('No data model published');
    expect(html).toContain('pdm/entities/*.json');
  });

  it('renders the deployment timeline from a listDeployStages statePath', () => {
    const store = createTestStore({
      data: {
        'deploy-status': {
          status: 'ok',
          deploymentId: 'dep-1',
          stages: [
            {
              stage: 'compose',
              status: 'succeeded',
              startedAt: '2026-05-14T14:32:06.000Z',
              finishedAt: '2026-05-14T14:32:08.000Z',
            },
            {
              stage: 'provision',
              status: 'running',
              startedAt: '2026-05-14T14:32:18.000Z',
            },
          ],
        },
      },
    });
    const html = renderWithStore(
      React.createElement(PlatformTimeline, { statePath: '/data/deploy-status' }),
      store,
    );

    // All five UX steps render in order.
    expect(html).toContain('Queued');
    expect(html).toContain('Validating');
    expect(html).toContain('Building');
    expect(html).toContain('Deploying');
    expect(html).toContain('Ready');
    // Queued is done (a stage row exists), Validating done (compose succeeded),
    // Building is current (provision running), Deploying/Ready still pending.
    expect(html).toContain('rntme-timeline-step is-done');
    expect(html).toContain('rntme-timeline-step is-current');
    expect(html).toContain('rntme-timeline-step is-pending');
    expect(html).toContain('14:32:08');
  });

  it('flags the deployment timeline as errored when a stage failed', () => {
    const store = createTestStore({
      data: {
        'deploy-status': {
          status: 'ok',
          deploymentId: 'dep-2',
          stages: [
            { stage: 'compose', status: 'succeeded', finishedAt: '2026-05-14T14:32:08.000Z' },
            {
              stage: 'apply',
              status: 'failed',
              errorCode: 'APPLY_FAILED',
              errorMessage: 'Dokploy apply rejected the plan',
              startedAt: '2026-05-14T14:33:00.000Z',
              finishedAt: '2026-05-14T14:33:10.000Z',
            },
          ],
        },
      },
    });
    const html = renderWithStore(
      React.createElement(PlatformTimeline, { statePath: '/data/deploy-status' }),
      store,
    );

    expect(html).toContain('rntme-timeline-step is-error');
    expect(html).toContain('Dokploy apply rejected the plan');
  });

  it('renders the deployment timeline pending when the statePath is empty without throwing', () => {
    const store = createTestStore({ data: { 'deploy-status': { status: 'ok', deploymentId: null, stages: [] } } });
    const html = renderWithStore(
      React.createElement(PlatformTimeline, { statePath: '/data/deploy-status' }),
      store,
    );

    expect(html).toContain('rntme-timeline');
    expect(html).toContain('Queued');
    expect(html).not.toContain('is-done');
    expect(html).not.toContain('is-error');
  });

  it('renders the deployment timeline from literal props.steps when no statePath is given', () => {
    const store = createTestStore({});
    const html = renderWithStore(
      React.createElement(PlatformTimeline, {
        steps: [{ label: 'Queued', state: 'done' }, { label: 'Ready', state: 'pending' }],
      }),
      store,
    );

    expect(html).toContain('Queued');
    expect(html).toContain('Ready');
    expect(html).toContain('rntme-timeline-step is-done');
  });

  it('renders the API explorer catalogue grouped by service with method badges and an Overview pane', () => {
    const store = createTestStore({
      data: {
        endpoints: {
          status: 'ok',
          endpoints: [
            { service: 'projects', operation: 'listProjects', method: 'GET', path: '/api/projects' },
            { service: 'projects', operation: 'publishProjectBundle', method: 'POST', path: '/api/projects/{projectId}/versions' },
            { service: 'tokens', operation: 'createToken', method: 'POST', path: '/api/tokens' },
            { service: 'tokens', operation: 'introspectToken', method: 'GET', path: '/api/tokens/introspect' },
          ],
        },
        summary: {
          status: 'ok',
          summary: { endpoints: 4, services: 2 },
        },
      },
    });
    const html = renderWithStore(
      React.createElement(PlatformAPIExplorer, {
        endpointsStatePath: '/data/endpoints',
        summaryStatePath: '/data/summary',
      }),
      store,
    );

    // Component shell + state path attribution
    expect(html).toContain('data-rntme-component="APIExplorer"');
    expect(html).toContain('data-state-path="/data/endpoints"');
    expect(html).toContain('data-summary-path="/data/summary"');

    // Catalogue groups by service
    expect(html).toContain('projects');
    expect(html).toContain('tokens');

    // HTTP method badges
    expect(html).toContain('rntme-pae-method-GET');
    expect(html).toContain('rntme-pae-method-POST');

    // Endpoint rows include operation + path text
    expect(html).toContain('listProjects');
    expect(html).toContain('/api/projects');
    expect(html).toContain('introspectToken');

    // Default selection lands on the first endpoint and renders Overview rows
    expect(html).toContain('Service');
    expect(html).toContain('Operation');
    expect(html).toContain('Method');
    expect(html).toContain('Path');

    // Handler-backed Overview rows (populated when detail loads, fall back to
    // placeholders during static markup before the fetch-on-selection effect
    // runs).
    expect(html).toContain('Auth');
    expect(html).toContain('Source artifact');
    expect(html).toContain('Handler');
    expect(html).toContain('Request schema');
    expect(html).toContain('Response schema');
    // Deferred Overview rows that always render the placeholder copy in B1.
    expect(html).toContain('Summary');
    expect(html).toContain('Examples');
    expect(html).toContain('Dependencies');
    expect(html).toContain('Not yet exposed by handler');
    expect(html).toContain('is-placeholder');
    // Tab bar for the new Overview / Raw split.
    expect(html).toContain('data-pae-tab="overview"');
    expect(html).toContain('data-pae-tab="raw"');
  });

  it('renders an empty state in the API explorer catalogue when no endpoints exist', () => {
    const store = createTestStore({
      data: {
        endpoints: { status: 'ok', endpoints: [] },
        summary: { status: 'ok', summary: { endpoints: 0 } },
      },
    });
    const html = renderWithStore(
      React.createElement(PlatformAPIExplorer, {
        endpointsStatePath: '/data/endpoints',
        summaryStatePath: '/data/summary',
      }),
      store,
    );

    expect(html).toContain('No endpoints found');
    // No detail card when no endpoint can be selected.
    expect(html).toContain('Select an endpoint to inspect it.');
  });

  it('selects an endpoint and updates the API explorer Overview pane', async () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
      url: 'https://platform.rntme.com/org/projects/p1/api',
    });
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousHTMLElement = globalThis.HTMLElement;
    const previousEvent = globalThis.Event;
    const previousActEnvironment = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    Object.defineProperties(globalThis, {
      window: { configurable: true, value: dom.window },
      document: { configurable: true, value: dom.window.document },
      HTMLElement: { configurable: true, value: dom.window.HTMLElement },
      Event: { configurable: true, value: dom.window.Event },
    });
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    const store = createTestStore({
      data: {
        endpoints: {
          status: 'ok',
          endpoints: [
            { service: 'projects', operation: 'listProjects', method: 'GET', path: '/api/projects' },
            { service: 'tokens', operation: 'createToken', method: 'POST', path: '/api/tokens' },
          ],
        },
        summary: { status: 'ok', summary: { endpoints: 2 } },
      },
      route: { params: { projectId: 'p1' } },
    });
    const detailRequests: string[] = [];
    const transport = createTransportChain(async (req) => {
      const url = new globalThis.URL(req.url);
      detailRequests.push(url.pathname);
      const segments = url.pathname.split('/').filter(Boolean);
      const operation = segments[segments.length - 1] ?? 'op';
      const service = segments[segments.length - 2] ?? 'svc';
      return globalThis.Response.json({
        status: 'ok',
        detail: {
          service: decodeURIComponent(service),
          operation: decodeURIComponent(operation),
          method: operation === 'createToken' ? 'POST' : 'GET',
          path: operation === 'createToken' ? '/api/tokens' : '/api/projects',
          summary: null,
          auth: 'required',
          sourceArtifact: { file: `services/${service}/bindings/bindings.json`, key: operation },
          handler: { engine: 'native', dialect: 'platform', graph: operation },
          request: { pathParams: [], queryParams: [], body: null },
          response: {
            successStatus: null,
            schemaName: null,
            fields: [],
            example: null,
            errors: [],
          },
          examples: { curl: '', fetch: '', openapi: '' },
          rawBinding: { graph: operation },
        },
      });
    });

    try {
      const rootEl = document.querySelector('#root') as Parameters<typeof createRoot>[0] | null;
      if (!rootEl) throw new Error('missing test root');
      const root = createRoot(rootEl);

      await act(async () => {
        root.render(
          React.createElement(
            StoreProvider,
            { value: store as never },
            React.createElement(
              TransportProvider,
              { value: transport },
              React.createElement(PlatformAPIExplorer, {
                endpointsStatePath: '/data/endpoints',
                summaryStatePath: '/data/summary',
              }),
            ),
          ),
        );
      });

      // Default selection is the first endpoint.
      expect(rootEl.textContent).toContain('listProjects');
      expect(rootEl.textContent).toContain('/api/projects');

      const tokensRow = document.querySelector('[data-pae-endpoint="tokens:createToken"]');
      if (!(tokensRow instanceof dom.window.HTMLButtonElement)) {
        throw new Error('missing tokens:createToken row');
      }
      await act(async () => {
        tokensRow.click();
      });

      // Overview pane updates to the newly selected endpoint.
      expect(rootEl.textContent).toContain('createToken');
      expect(rootEl.textContent).toContain('/api/tokens');

      // Method filter chip narrows the catalogue.
      const postChip = document.querySelector('[data-pae-method-filter="POST"]');
      if (!(postChip instanceof dom.window.HTMLButtonElement)) {
        throw new Error('missing POST filter chip');
      }
      await act(async () => {
        postChip.click();
      });
      expect(Boolean(document.querySelector('[data-pae-endpoint="projects:listProjects"]'))).toBe(false);
      expect(Boolean(document.querySelector('[data-pae-endpoint="tokens:createToken"]'))).toBe(true);

      // Real handler-backed Overview rows light up after the detail fetch.
      expect(rootEl.textContent).toContain('Required');
      expect(rootEl.textContent).toContain('services/tokens/bindings/bindings.json');
      expect(rootEl.textContent).toContain('native / platform');
      expect(detailRequests.length).toBeGreaterThan(0);
      expect(detailRequests[detailRequests.length - 1]).toContain('/api/projects/p1/endpoints/tokens/createToken');

      // Switching to the Raw tab shows the JSON dump of the rawBinding.
      const rawTab = document.querySelector('[data-pae-tab="raw"]');
      if (!(rawTab instanceof dom.window.HTMLButtonElement)) {
        throw new Error('missing Raw tab button');
      }
      await act(async () => {
        rawTab.click();
      });
      const rawPre = document.querySelector('[data-pae-raw="true"]');
      expect(rawPre?.textContent ?? '').toContain('"graph": "createToken"');

      await act(async () => {
        root.unmount();
      });
    } finally {
      (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      Object.defineProperties(globalThis, {
        window: { configurable: true, value: previousWindow },
        document: { configurable: true, value: previousDocument },
        HTMLElement: { configurable: true, value: previousHTMLElement },
        Event: { configurable: true, value: previousEvent },
      });
    }
  });

  // -------------------------------------------------------------------------
  // PlatformAPIExplorer B2 surfaces — Request / Response / Examples / side-sheet
  // -------------------------------------------------------------------------

  // Helper that wires up a JSDOM environment, a single-endpoint store, and a
  // canned-detail transport so each B2 surface test can focus on the assertion
  // it cares about. The canned detail mirrors the shape returned by the live
  // platform-projects handler (B1), with B2-relevant fields populated.
  function setupExplorerB2Harness(input: {
    detail: Record<string, unknown>;
    url?: string;
    routeParams?: Record<string, unknown>;
  }) {
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
      url: input.url ?? 'https://platform.rntme.com/org/projects/p1/api',
    });
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousHTMLElement = globalThis.HTMLElement;
    const previousEvent = globalThis.Event;
    const previousActEnvironment =
      (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
        .IS_REACT_ACT_ENVIRONMENT;
    Object.defineProperties(globalThis, {
      window: { configurable: true, value: dom.window },
      document: { configurable: true, value: dom.window.document },
      HTMLElement: { configurable: true, value: dom.window.HTMLElement },
      Event: { configurable: true, value: dom.window.Event },
    });
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;

    const store = createTestStore({
      data: {
        endpoints: {
          status: 'ok',
          endpoints: [
            {
              service: 'projects',
              operation: 'listProjects',
              method: 'GET',
              path: '/api/projects',
            },
          ],
        },
        summary: { status: 'ok', summary: { endpoints: 1 } },
      },
      route: { params: { projectId: 'p1', ...(input.routeParams ?? {}) } },
    });
    const transport = createTransportChain(async () =>
      globalThis.Response.json({ status: 'ok', detail: input.detail }),
    );

    const teardown = () => {
      (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
        .IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      Object.defineProperties(globalThis, {
        window: { configurable: true, value: previousWindow },
        document: { configurable: true, value: previousDocument },
        HTMLElement: { configurable: true, value: previousHTMLElement },
        Event: { configurable: true, value: previousEvent },
      });
    };

    return { dom, store, transport, teardown };
  }

  // Mounts the explorer, waits for the auto-fetched detail to settle, then
  // clicks the named tab so callers can assert against the freshly-rendered
  // pane. Returns the JSDOM root so each test can issue further queries.
  async function mountExplorerAndOpenTab(input: {
    dom: JSDOM;
    store: ReturnType<typeof createTestStore>;
    transport: ReturnType<typeof createTransportChain>;
    tab: 'overview' | 'request' | 'response' | 'examples' | 'raw';
    extraProps?: Record<string, unknown>;
  }) {
    const rootEl = document.querySelector('#root') as Parameters<typeof createRoot>[0] | null;
    if (!rootEl) throw new Error('missing test root');
    const root = createRoot(rootEl);

    await act(async () => {
      root.render(
        React.createElement(
          StoreProvider,
          { value: input.store as never },
          React.createElement(
            TransportProvider,
            { value: input.transport },
            React.createElement(PlatformAPIExplorer, {
              endpointsStatePath: '/data/endpoints',
              summaryStatePath: '/data/summary',
              ...(input.extraProps ?? {}),
            }),
          ),
        ),
      );
    });

    // Flush the detail-fetch effect so the request/response/examples panes
    // render against the real cached detail rather than the loading fallback.
    await act(async () => {
      await Promise.resolve();
    });

    if (input.tab !== 'overview') {
      const tabBtn = document.querySelector(`[data-pae-tab="${input.tab}"]`);
      if (!(tabBtn instanceof input.dom.window.HTMLButtonElement)) {
        throw new Error(`missing ${input.tab} tab button`);
      }
      await act(async () => {
        tabBtn.click();
      });
    }

    return { root, rootEl };
  }

  // Canned detail with non-empty path/query/body params so the Request tab and
  // the side-sheet have something concrete to render against.
  function requestCannedDetail(): Record<string, unknown> {
    return {
      service: 'projects',
      operation: 'listProjects',
      method: 'GET',
      path: '/api/projects/{projectId}',
      summary: null,
      auth: 'required',
      sourceArtifact: {
        file: 'services/projects/bindings/bindings.json',
        key: 'listProjects',
      },
      handler: { engine: 'native', dialect: 'platform', graph: 'listProjects' },
      request: {
        pathParams: [
          { name: 'projectId', in: 'path', required: true, description: null },
        ],
        queryParams: [
          { name: 'limit', in: 'query', required: false, description: null },
        ],
        body: {
          schemaName: 'CreateNoteInput',
          fields: [
            { name: 'title', in: 'body', required: true, description: null },
          ],
        },
      },
      response: {
        successStatus: null,
        schemaName: null,
        fields: [],
        example: null,
        errors: [],
      },
      examples: { curl: '', fetch: '', openapi: '' },
      rawBinding: { graph: 'listProjects' },
    };
  }

  it('renders Request tab parameter rows for path / query / body sections', async () => {
    const detail = requestCannedDetail();
    const harness = setupExplorerB2Harness({ detail });
    try {
      const { root } = await mountExplorerAndOpenTab({
        dom: harness.dom,
        store: harness.store,
        transport: harness.transport,
        tab: 'request',
      });

      // Each section renders with its expected `data-pae-req-section` marker.
      const pathSection = document.querySelector('[data-pae-req-section="path"]');
      const querySection = document.querySelector('[data-pae-req-section="query"]');
      const bodySection = document.querySelector('[data-pae-req-section="body"]');
      expect(pathSection).not.toBeNull();
      expect(querySection).not.toBeNull();
      expect(bodySection).not.toBeNull();

      // Each parameter row is keyed by `${section}:${name}` and the visible
      // name appears inside the row. We assert the row exists AND contains
      // the parameter name so a future refactor that drops either signal
      // (button vs. text) still trips this test.
      const pathRow = document.querySelector('[data-pae-param-row="path:projectId"]');
      const queryRow = document.querySelector('[data-pae-param-row="query:limit"]');
      const bodyRow = document.querySelector('[data-pae-param-row="body:title"]');
      expect(pathRow).not.toBeNull();
      expect(queryRow).not.toBeNull();
      expect(bodyRow).not.toBeNull();
      expect(pathRow?.textContent ?? '').toContain('projectId');
      expect(queryRow?.textContent ?? '').toContain('limit');
      expect(bodyRow?.textContent ?? '').toContain('title');

      // Body section caption shows the schema name when non-null.
      expect(bodySection?.textContent ?? '').toContain('CreateNoteInput');

      await act(async () => {
        root.unmount();
      });
    } finally {
      harness.teardown();
    }
  });

  it('omits the body section caption when body.schemaName is null', async () => {
    const detail = requestCannedDetail();
    // Override only the body schema name; keep fields populated so the body
    // section still renders.
    (detail.request as { body: { schemaName: string | null } }).body.schemaName = null;
    const harness = setupExplorerB2Harness({ detail });
    try {
      const { root } = await mountExplorerAndOpenTab({
        dom: harness.dom,
        store: harness.store,
        transport: harness.transport,
        tab: 'request',
      });

      const bodySection = document.querySelector('[data-pae-req-section="body"]');
      expect(bodySection).not.toBeNull();
      // No caption span when schemaName is null.
      expect(
        bodySection?.querySelector('.rntme-pae-req-section-caption'),
      ).toBeNull();

      await act(async () => {
        root.unmount();
      });
    } finally {
      harness.teardown();
    }
  });

  it('opens the parameter side-sheet, shows the location chip, and closes via Escape', async () => {
    const detail = requestCannedDetail();
    const harness = setupExplorerB2Harness({ detail });
    try {
      const { root } = await mountExplorerAndOpenTab({
        dom: harness.dom,
        store: harness.store,
        transport: harness.transport,
        tab: 'request',
      });

      const pathRow = document.querySelector('[data-pae-param-row="path:projectId"]');
      if (!(pathRow instanceof harness.dom.window.HTMLButtonElement)) {
        throw new Error('missing path:projectId param row');
      }
      await act(async () => {
        pathRow.click();
      });

      // Side-sheet opens with the param name and a `path` location chip.
      const sheet = document.querySelector('[data-pae-side-sheet="open"]');
      expect(sheet).not.toBeNull();
      const chip = document.querySelector('[data-pae-side-sheet-chip="path"]');
      expect(chip).not.toBeNull();
      expect(chip?.textContent ?? '').toContain('path');
      expect(sheet?.textContent ?? '').toContain('projectId');

      // Escape on document closes the sheet. The implementation listens via
      // doc.addEventListener('keydown'), so we dispatch a real KeyboardEvent.
      await act(async () => {
        document.dispatchEvent(
          new harness.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );
      });
      expect(document.querySelector('[data-pae-side-sheet="open"]')).toBeNull();

      await act(async () => {
        root.unmount();
      });
    } finally {
      harness.teardown();
    }
  });

  it('closes the parameter side-sheet when the backdrop is clicked', async () => {
    const detail = requestCannedDetail();
    const harness = setupExplorerB2Harness({ detail });
    try {
      const { root } = await mountExplorerAndOpenTab({
        dom: harness.dom,
        store: harness.store,
        transport: harness.transport,
        tab: 'request',
      });

      const queryRow = document.querySelector('[data-pae-param-row="query:limit"]');
      if (!(queryRow instanceof harness.dom.window.HTMLButtonElement)) {
        throw new Error('missing query:limit param row');
      }
      await act(async () => {
        queryRow.click();
      });
      expect(document.querySelector('[data-pae-side-sheet="open"]')).not.toBeNull();
      // Confirm the chip reflects the row's section so the open/close test
      // doesn't rely solely on existence of the sheet.
      const chip = document.querySelector('[data-pae-side-sheet-chip="query"]');
      expect(chip).not.toBeNull();

      const backdrop = document.querySelector('[data-pae-side-sheet-backdrop="true"]');
      if (!(backdrop instanceof harness.dom.window.HTMLButtonElement)) {
        throw new Error('missing side-sheet backdrop');
      }
      await act(async () => {
        backdrop.click();
      });
      expect(document.querySelector('[data-pae-side-sheet="open"]')).toBeNull();

      await act(async () => {
        root.unmount();
      });
    } finally {
      harness.teardown();
    }
  });

  it('renders Response tab schema fields and placeholder rows for status / example / errors', async () => {
    const detail = requestCannedDetail();
    // Populate response schema/fields but keep B1's pinned placeholder
    // signals (null status, null example, empty errors) so the tab continues
    // to surface "Not yet exposed by handler" copy for those slots.
    (detail.response as Record<string, unknown>) = {
      successStatus: null,
      schemaName: 'ProjectListResponse',
      fields: [
        { name: 'projects', in: 'body', required: true, description: null },
        { name: 'total', in: 'body', required: false, description: null },
      ],
      example: null,
      errors: [],
    };
    const harness = setupExplorerB2Harness({ detail });
    try {
      const { root } = await mountExplorerAndOpenTab({
        dom: harness.dom,
        store: harness.store,
        transport: harness.transport,
        tab: 'response',
      });

      // Schema fields render by name with the schema caption populated.
      const schemaSection = document.querySelector('[data-pae-res-section="schema"]');
      expect(schemaSection).not.toBeNull();
      expect(schemaSection?.textContent ?? '').toContain('ProjectListResponse');
      expect(document.querySelector('[data-pae-res-field="projects"]')).not.toBeNull();
      expect(document.querySelector('[data-pae-res-field="total"]')).not.toBeNull();

      // Status / example / errors sections all render their placeholder copy
      // because the canned detail leaves those slots unset.
      const statusSection = document.querySelector('[data-pae-res-section="status"]');
      const exampleSection = document.querySelector('[data-pae-res-section="example"]');
      const errorsSection = document.querySelector('[data-pae-res-section="errors"]');
      expect(statusSection?.textContent ?? '').toContain('Not yet exposed by handler');
      expect(exampleSection?.textContent ?? '').toContain('Not yet exposed by handler');
      expect(errorsSection?.textContent ?? '').toContain('Not yet exposed by handler');

      await act(async () => {
        root.unmount();
      });
    } finally {
      harness.teardown();
    }
  });

  it('Examples tab renders curl / fetch / openapi snippets via sub-tabs', async () => {
    const detail = requestCannedDetail();
    (detail.examples as Record<string, string>) = {
      curl: 'curl -X GET https://example.test/api',
      fetch: 'fetch("/test")',
      openapi: 'paths:\n  /test:',
    };
    const harness = setupExplorerB2Harness({ detail });
    try {
      const { root } = await mountExplorerAndOpenTab({
        dom: harness.dom,
        store: harness.store,
        transport: harness.transport,
        tab: 'examples',
      });

      // Default sub-tab is curl; the snippet `<pre>` carries a
      // `data-pae-example-snippet` attribute that flips with the active tab.
      const initialSnippet = document.querySelector('[data-pae-example-snippet="curl"]');
      expect(initialSnippet).not.toBeNull();
      expect(initialSnippet?.textContent ?? '').toContain('curl -X GET');

      // Switch to the fetch sub-tab.
      const fetchSubtab = document.querySelector('[data-pae-example-tab="fetch"]');
      if (!(fetchSubtab instanceof harness.dom.window.HTMLButtonElement)) {
        throw new Error('missing fetch sub-tab button');
      }
      await act(async () => {
        fetchSubtab.click();
      });
      const fetchSnippet = document.querySelector('[data-pae-example-snippet="fetch"]');
      expect(fetchSnippet).not.toBeNull();
      expect(fetchSnippet?.textContent ?? '').toContain('fetch("/test")');
      // The curl snippet element is no longer in the DOM after switching.
      expect(document.querySelector('[data-pae-example-snippet="curl"]')).toBeNull();

      // Switch to the openapi sub-tab.
      const openapiSubtab = document.querySelector('[data-pae-example-tab="openapi"]');
      if (!(openapiSubtab instanceof harness.dom.window.HTMLButtonElement)) {
        throw new Error('missing openapi sub-tab button');
      }
      await act(async () => {
        openapiSubtab.click();
      });
      const openapiSnippet = document.querySelector('[data-pae-example-snippet="openapi"]');
      expect(openapiSnippet).not.toBeNull();
      expect(openapiSnippet?.textContent ?? '').toContain('paths:');

      await act(async () => {
        root.unmount();
      });
    } finally {
      harness.teardown();
    }
  });

  it('renders Overview cross-links to graph and PDM screens when templates are provided', async () => {
    // Slice D — when api.spec.json passes `graphHrefTemplate` and
    // `pdmHrefTemplate`, the Overview pane wraps the Handler / Source
    // artifact / Request schema / Response schema values in anchor tags
    // pointing at the project graph and data-model screens. Substitutions
    // pull `orgId` / `projectId` from /route/params, the handler graph from
    // the fetched detail, and the schema name per row.
    const detail = requestCannedDetail();
    (detail.response as Record<string, unknown>) = {
      successStatus: null,
      schemaName: 'ProjectListResponse',
      fields: [{ name: 'projects', in: 'body', required: true, description: null }],
      example: null,
      errors: [],
    };
    const harness = setupExplorerB2Harness({
      detail,
      routeParams: { orgId: 'org_X' },
    });
    try {
      const { root } = await mountExplorerAndOpenTab({
        dom: harness.dom,
        store: harness.store,
        transport: harness.transport,
        tab: 'overview',
        extraProps: {
          graphHrefTemplate: '/{orgId}/projects/{projectId}/graph',
          pdmHrefTemplate: '/{orgId}/projects/{projectId}/data-model',
        },
      });

      // Handler / Source artifact rows link to the Graph screen with the
      // handler's `graph` value substituted in (also exposed as a path
      // segment in case a future graph route surfaces it). Both rows share
      // the same Graph link target because they both originate from the
      // handler reference.
      const handlerLink = document.querySelector(
        '[data-pae-overview-link="Handler"]',
      );
      const sourceLink = document.querySelector(
        '[data-pae-overview-link="Source artifact"]',
      );
      expect(handlerLink).not.toBeNull();
      expect(sourceLink).not.toBeNull();
      expect(handlerLink?.getAttribute('href')).toBe('/org_X/projects/p1/graph');
      expect(sourceLink?.getAttribute('href')).toBe('/org_X/projects/p1/graph');

      // Both Request and Response schemas have names in this canned detail,
      // so both render PDM links. Templates that omit `{schemaName}`
      // (as the data-model screen does today) still resolve correctly —
      // the PDM screen is per-project, not per-schema.
      const requestSchemaLink = document.querySelector(
        '[data-pae-overview-link="Request schema"]',
      );
      expect(requestSchemaLink).not.toBeNull();
      expect(requestSchemaLink?.getAttribute('href')).toBe(
        '/org_X/projects/p1/data-model',
      );
      const responseSchemaLink = document.querySelector(
        '[data-pae-overview-link="Response schema"]',
      );
      expect(responseSchemaLink).not.toBeNull();
      expect(responseSchemaLink?.getAttribute('href')).toBe(
        '/org_X/projects/p1/data-model',
      );

      await act(async () => {
        root.unmount();
      });
    } finally {
      harness.teardown();
    }
  });

  it('falls back to plain text in the Overview pane when cross-link templates are absent', async () => {
    // Sanity check — without the new templates, Overview rows stay as
    // plain text so existing screens that do not opt into cross-links keep
    // their current (non-link) behaviour.
    const detail = requestCannedDetail();
    const harness = setupExplorerB2Harness({ detail });
    try {
      const { root } = await mountExplorerAndOpenTab({
        dom: harness.dom,
        store: harness.store,
        transport: harness.transport,
        tab: 'overview',
      });

      expect(document.querySelector('[data-pae-overview-link="Handler"]'))
        .toBeNull();
      expect(document.querySelector('[data-pae-overview-link="Source artifact"]'))
        .toBeNull();

      await act(async () => {
        root.unmount();
      });
    } finally {
      harness.teardown();
    }
  });

  it('declares the PlatformAPIExplorer prop schema in module.json', async () => {
    const moduleManifest = (await import('../module.json', { with: { type: 'json' } })).default as {
      client: { components: Array<{ type: string; props: Record<string, unknown> }> };
    };
    const explorer = moduleManifest.client.components.find(
      (component) => component.type === 'PlatformAPIExplorer',
    );
    expect(explorer?.props).toMatchObject({
      endpointsStatePath: { type: 'string' },
      summaryStatePath: { type: 'string' },
      endpointDetailPathTemplate: { type: 'string' },
    });
  });

  it('declares the PlatformSummaryGrid statePath prop in module.json', async () => {
    const moduleManifest = (await import('../module.json', { with: { type: 'json' } })).default as {
      client: { components: Array<{ type: string; props: Record<string, unknown> }> };
    };
    const summaryGrid = moduleManifest.client.components.find(
      (component) => component.type === 'PlatformSummaryGrid',
    );
    expect(summaryGrid?.props).toMatchObject({
      items: { type: 'array' },
      statePath: { type: 'string' },
    });
  });

  it('declares the PlatformPageHeader statePath prop in module.json', async () => {
    const moduleManifest = (await import('../module.json', { with: { type: 'json' } })).default as {
      client: { components: Array<{ type: string; props: Record<string, unknown> }> };
    };
    const pageHeader = moduleManifest.client.components.find(
      (component) => component.type === 'PlatformPageHeader',
    );
    expect(pageHeader?.props).toMatchObject({
      meta: { type: 'array' },
      statePath: { type: 'string' },
    });
  });

  it('declares the PlatformDataModelExplorer statePath prop in module.json', async () => {
    const moduleManifest = (await import('../module.json', { with: { type: 'json' } })).default as {
      client: { components: Array<{ type: string; props: Record<string, unknown> }> };
    };
    const explorer = moduleManifest.client.components.find(
      (component) => component.type === 'PlatformDataModelExplorer',
    );
    expect(explorer?.props).toMatchObject({
      statePath: { type: 'string' },
    });
  });

  it('mints a browser-session PAT and displays plaintext only locally', async () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
      url: 'https://platform.rntme.com/org_uZUWhpWgK54VWC2X/tokens',
    });
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousActEnvironment = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    Object.defineProperties(globalThis, {
      window: { configurable: true, value: dom.window },
      document: { configurable: true, value: dom.window.document },
      HTMLElement: { configurable: true, value: dom.window.HTMLElement },
      Event: { configurable: true, value: dom.window.Event },
      Request: { configurable: true, value: globalThis.Request },
      Response: { configurable: true, value: globalThis.Response },
    });
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    const requests: Array<{ path: string; body: unknown }> = [];
    const transport = createTransportChain(async (req) => {
      requests.push({
        path: new globalThis.URL(req.url).pathname,
        body: JSON.parse(await req.text()) as unknown,
      });
      return globalThis.Response.json({
        plaintext: 'rntme_pat_testplaintext0000000000',
        token: {
          id: 'tok_1',
          organizationId: 'org_uZUWhpWgK54VWC2X',
          accountId: 'acct_1',
          name: 'cv deploy',
          prefix: 'rntme_pat_te',
          scopesJson: '["project:read"]',
          status: 'active',
          expiresAt: null,
          lastUsedAt: null,
          revokedAt: null,
          createdAt: '2026-05-13T00:00:00.000Z',
        },
      });
    });
    const store = createTestStore({
      route: { params: { orgId: 'org_uZUWhpWgK54VWC2X' } },
    });

    try {
      const rootEl = document.querySelector('#root') as Parameters<typeof createRoot>[0] | null;
      if (!rootEl) throw new Error('missing test root');
      const root = createRoot(rootEl);

      await act(async () => {
        root.render(
          React.createElement(
            StoreProvider,
            { value: store as never },
            React.createElement(
              TransportProvider,
              { value: transport },
              React.createElement(PlatformTokenIssuer, {
                defaultName: 'cv deploy',
                defaultScopesJson: '["project:read"]',
              }),
            ),
          ),
        );
      });

      const form = document.querySelector('form');
      if (!form) throw new Error('missing token form');
      await act(async () => {
        form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
      });

      expect(requests).toEqual([
        {
          path: '/api/tokens',
          body: {
            organizationId: 'org_uZUWhpWgK54VWC2X',
            name: 'cv deploy',
            scopesJson: '["project:read"]',
          },
        },
      ]);
      expect(rootEl.textContent).toContain('rntme_pat_testplaintext0000000000');
      expect(JSON.stringify(store.getSnapshot())).not.toContain('rntme_pat_testplaintext0000000000');
      await act(async () => {
        root.unmount();
      });
    } finally {
      (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      Object.defineProperties(globalThis, {
        window: { configurable: true, value: previousWindow },
        document: { configurable: true, value: previousDocument },
      });
    }
  });
});
