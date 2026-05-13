import { describe, expect, it } from 'bun:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PlatformDataTable,
  PlatformPageHeader,
  PlatformPanel,
  PlatformSidebar,
} from '../src/client.js';

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

  it('renders the product data table marker', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlatformDataTable, { statePath: '/data/projects' }),
    );

    expect(html).toContain('data-rntme-component="DataTable"');
    expect(html).toContain('/data/projects');
  });
});
