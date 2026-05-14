import { describe, expect, it } from 'bun:test';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import {
  PlatformDataTable,
  PlatformPageHeader,
  PlatformPanel,
  PlatformServicesPanel,
  PlatformSidebar,
  PlatformTokenIssuer,
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

describe('@rntme/platform-ui components', () => {
  it('renders the page header with platform class names', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlatformPageHeader, { eyebrow: 'Project', title: 'Deployments' }),
    );

    expect(html).toContain('rntme-page-head');
    expect(html).toContain('Deployments');
  });

  it('renders panel children through React', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlatformPanel, { title: 'Panel' }, React.createElement('span', null, 'inside')),
    );

    expect(html).toContain('rntme-panel');
    expect(html).toContain('inside');
  });

  it('renders the platform sidebar brand', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlatformSidebar, { brand: 'rntme', items: [{ label: 'Projects', href: '/' }] }),
    );

    expect(html).toContain('rntme-sidebar');
    expect(html).toContain('Projects');
  });

  function renderWithStore(element: React.ReactElement, store: ReturnType<typeof createTestStore>): string {
    return renderToStaticMarkup(
      React.createElement(StoreProvider, { value: store as never }, element),
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
