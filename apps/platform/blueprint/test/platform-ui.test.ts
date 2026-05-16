import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadComposedBlueprint } from '../../../../packages/artifacts/blueprint/src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const blueprintRoot = join(here, '..');

describe('platform UI artifact', () => {
  it('compiles platform UI routes against platform bindings', async () => {
    const result = await loadComposedBlueprint(blueprintRoot);
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;

    const ui = result.value.services.app?.compiledUi;
    expect(ui).toBeDefined();
    expect(ui?.manifest.routes['/']).toMatchObject({ screen: 'login' });
    expect(ui?.manifest.routes['/auth/callback']).toMatchObject({ screen: 'login' });
    expect(ui?.manifest.routes['/:orgId']).toMatchObject({ screen: 'org' });
    expect(ui?.manifest.routes['/:orgId/deployments/:deploymentId']).toMatchObject({ screen: 'deployment' });
    expect(ui?.manifest.routes['/:orgId/projects/:projectId/data-model']).toMatchObject({ screen: 'data-model' });
    expect(ui?.screens.org?.data?.['/data/projects']?.path).toBe('/api/projects');
    expect(ui?.screens.org?.spec.elements.projects).toMatchObject({
      type: 'PlatformDataTable',
      props: {
        columns: expect.arrayContaining([
          expect.objectContaining({
            key: 'open',
            label: 'Open',
            value: 'Open',
            hrefTemplate: '/{orgId}/projects/{id}',
          }),
        ]),
      },
    });
    expect(ui?.screens.deployment?.data?.['/data/logs']?.path).toBe('/api/deployments/{deploymentId}/logs');
    expect(ui?.screens.project?.data?.['/data/versions']?.path).toBe('/api/projects/{projectId}/versions');
    const projectHeader = ui?.screens.project?.spec.elements.header;
    expect(projectHeader).toMatchObject({
      type: 'PlatformPageHeader',
      props: { statePath: '/data/versions' },
    });
    expect(projectHeader?.props.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Data model',
          hrefTemplate: '/{orgId}/projects/{projectId}/data-model',
        }),
        expect.objectContaining({
          label: 'API',
          hrefTemplate: '/{orgId}/projects/{projectId}/api',
        }),
        expect.objectContaining({
          label: 'UI',
          hrefTemplate: '/{orgId}/projects/{projectId}/ui',
        }),
        expect.objectContaining({
          label: 'Graph',
          hrefTemplate: '/{orgId}/projects/{projectId}/graph',
        }),
      ]),
    );
    expect(ui?.screens.project?.data?.['/data/services']?.path).toBe('/api/projects/{projectId}/services');
    expect(ui?.screens.project?.data?.['/data/summary']?.path).toBe('/api/projects/{projectId}/artifact-summary');
    expect(ui?.screens.project?.spec.elements.servicesPanel).toMatchObject({
      type: 'PlatformServicesPanel',
      props: { statePath: '/data/services' },
    });
    expect(ui?.screens.project?.spec.elements.summary).toMatchObject({
      type: 'PlatformSummaryGrid',
      props: { statePath: '/data/summary' },
    });
    expect(ui?.screens.project?.data?.['/data/deployments']?.path).toBe('/api/deployments');
    expect(ui?.screens.project?.spec.elements.deployTimeline).toMatchObject({
      type: 'PlatformDataTable',
      props: { statePath: '/data/deployments' },
    });
    expect(ui?.screens.project?.data?.['/data/deploy-status']?.path).toBe('/api/deployments/stages');
    expect(ui?.screens.project?.spec.elements.deployStatusTimeline).toMatchObject({
      type: 'PlatformTimeline',
      props: { statePath: '/data/deploy-status' },
    });
    const dataModelScreen = ui?.screens['data-model'];
    if (!dataModelScreen) {
      throw new Error('data-model screen is missing');
    }
    expect(dataModelScreen.data?.['/data/summary']).toBeUndefined();
    expect(dataModelScreen.data?.['/data/model']?.path).toBe('/api/projects/{projectId}/data-model');
    const dataModelPage = dataModelScreen.spec.elements.page;
    if (!dataModelPage) {
      throw new Error('data-model page element is missing');
    }
    expect(dataModelPage.children).toEqual(['header', 'explorer']);
    expect(dataModelScreen.spec.elements.explorer).toMatchObject({
      type: 'PlatformDataModelExplorer',
      props: { statePath: '/data/model' },
    });
    expect(ui?.manifest.routes['/:orgId/projects/:projectId/api']).toMatchObject({ screen: 'api' });
    expect(ui?.screens.api?.data?.['/data/summary']?.path).toBe('/api/projects/{projectId}/artifact-summary');
    expect(ui?.screens.api?.data?.['/data/endpoints']?.path).toBe('/api/projects/{projectId}/endpoints');
    expect(ui?.screens.api?.spec.elements.endpointsExplorer).toMatchObject({
      type: 'PlatformAPIExplorer',
      props: {
        endpointsStatePath: '/data/endpoints',
        summaryStatePath: '/data/summary',
        endpointDetailPathTemplate: '/api/projects/{projectId}/endpoints/{service}/{operation}',
      },
    });
    expect(ui?.manifest.routes['/:orgId/projects/:projectId/ui']).toMatchObject({ screen: 'ui' });
    expect(ui?.screens.ui?.data?.['/data/summary']?.path).toBe('/api/projects/{projectId}/artifact-summary');
    expect(ui?.screens.ui?.data?.['/data/uiComponents']?.path).toBe('/api/projects/{projectId}/ui-components');
    expect(ui?.screens.ui?.spec.elements.uiComponentsTable).toMatchObject({
      type: 'PlatformDataTable',
      props: { statePath: '/data/uiComponents' },
    });
    expect(ui?.manifest.routes['/:orgId/projects/:projectId/graph']).toMatchObject({ screen: 'graph' });
    expect(ui?.screens.graph?.data?.['/data/summary']?.path).toBe('/api/projects/{projectId}/artifact-summary');
    expect(ui?.screens.graph?.data?.['/data/graphs']?.path).toBe('/api/projects/{projectId}/graphs');
    expect(ui?.screens.graph?.spec.elements.graphsTable).toMatchObject({
      type: 'PlatformDataTable',
      props: { statePath: '/data/graphs' },
    });
    expect(JSON.parse(result.value.publicConfigJson ?? '{}')).toMatchObject({
      '@rntme/identity-auth0': {
        postLoginRedirectPath: '/no-org',
        authenticatedRedirectPaths: ['/', '/login', '/auth/callback'],
      },
    });
    expect(result.value.virtualEntrySource).toContain("import('@rntme/identity-auth0/client')");
    expect(result.value.virtualEntrySource).toContain("bootContract: 'identity'");
    expect(result.value.catalogManifest?.components.map((c) => c.type)).toEqual(
      expect.arrayContaining(['PlatformPageHeader', 'PlatformDataTable', 'PlatformDataModelExplorer', 'PlatformSidebar']),
    );
    // PlatformTimeline is driven by `/data/deploy-status`; the catalog must
    // declare the `statePath` prop so the screen spec binding resolves.
    const timelineComponent = result.value.catalogManifest?.components.find(
      (c) => c.type === 'PlatformTimeline',
    );
    expect(timelineComponent?.props).toMatchObject({ statePath: { type: 'string' } });
    expect(result.value.uiAssetManifest?.stylesheets[0]).toMatchObject({
      id: 'platform-ui',
      moduleKey: 'platformUi',
      href: '/assets/modules/platformUi/stylesheets/platform-ui.css',
    });
    expect(result.value.virtualEntrySource).toContain("import('@rntme/platform-ui/client')");

    // Slice A — route-aware nav shell: sidebar items expose `hrefTemplate`
    // (templated against /route/params at render) and the topbar derives its
    // breadcrumbs from /route/path via the `crumbsFromRoute` flag. The
    // hard-coded `active: true` is removed; active-state is now computed by
    // the component from the current route path.
    const mainLayout = ui?.layouts.main;
    if (!mainLayout) throw new Error('main layout is missing');
    const sidebar = mainLayout.spec.elements.sidebar;
    expect(sidebar).toMatchObject({ type: 'PlatformSidebar' });
    const sidebarItems = sidebar?.props.items as Array<Record<string, unknown>> | undefined;
    expect(sidebarItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Dashboard', hrefTemplate: '/{orgId}' }),
        expect.objectContaining({ label: 'Projects', hrefTemplate: '/{orgId}', matchPattern: '/{orgId}/projects' }),
        expect.objectContaining({
          label: 'Deployments',
          hrefTemplate: '/{orgId}/projects/{projectId}/deployments',
        }),
        expect.objectContaining({ label: 'Deploy targets', hrefTemplate: '/{orgId}/deploy-targets' }),
        expect.objectContaining({ label: 'API tokens', hrefTemplate: '/{orgId}/tokens' }),
        expect.objectContaining({ label: 'Audit log', hrefTemplate: '/{orgId}/audit' }),
      ]),
    );
    // No item carries the legacy hard-coded `active: true` flag.
    expect(sidebarItems?.every((item) => item.active === undefined)).toBe(true);
    const topbar = mainLayout.spec.elements.topbar;
    expect(topbar).toMatchObject({
      type: 'PlatformTopbar',
      props: { crumbsFromRoute: true },
    });

    // Slice B — cross-link fill-ins: explorer screens expose lateral siblings
    // and a back-to-project header action; the deployments table id column
    // links to the deployment detail screen; the audit table exposes a
    // dispatched targetId link column; the deployment detail back-link
    // returns to the org dashboard (the route does not carry projectId).
    const dataModelActions = (ui?.screens['data-model']?.spec.elements.header?.props.actions ??
      []) as Array<Record<string, unknown>>;
    expect(dataModelActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Back to project',
          hrefTemplate: '/{orgId}/projects/{projectId}',
        }),
        expect.objectContaining({ label: 'API', hrefTemplate: '/{orgId}/projects/{projectId}/api' }),
        expect.objectContaining({ label: 'UI', hrefTemplate: '/{orgId}/projects/{projectId}/ui' }),
        expect.objectContaining({ label: 'Graph', hrefTemplate: '/{orgId}/projects/{projectId}/graph' }),
      ]),
    );
    // Self-link is intentionally excluded from the lateral siblings list.
    expect(dataModelActions.some((a) => a.label === 'Data model')).toBe(false);
    const apiActions = (ui?.screens.api?.spec.elements.header?.props.actions ?? []) as Array<
      Record<string, unknown>
    >;
    expect(apiActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Back to project' }),
        expect.objectContaining({ label: 'Data model' }),
        expect.objectContaining({ label: 'UI' }),
        expect.objectContaining({ label: 'Graph' }),
      ]),
    );
    expect(apiActions.some((a) => a.label === 'API')).toBe(false);
    const uiActions = (ui?.screens.ui?.spec.elements.header?.props.actions ?? []) as Array<
      Record<string, unknown>
    >;
    expect(uiActions.some((a) => a.label === 'UI')).toBe(false);
    expect(uiActions.some((a) => a.label === 'Back to project')).toBe(true);
    const graphActions = (ui?.screens.graph?.spec.elements.header?.props.actions ?? []) as Array<
      Record<string, unknown>
    >;
    expect(graphActions.some((a) => a.label === 'Graph')).toBe(false);
    expect(graphActions.some((a) => a.label === 'Back to project')).toBe(true);

    const deploymentsCols = (ui?.screens.deployments?.spec.elements.deployments?.props
      .columns ?? []) as Array<Record<string, unknown>>;
    expect(deploymentsCols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'id', hrefTemplate: '/{orgId}/deployments/{id}' }),
      ]),
    );

    // Slice D — audit row link dispatches on `targetType` so non-deployment
    // rows route to their own detail screen (project / deploy target) instead
    // of a non-resolving deployment URL. Rows whose `targetType` is not in
    // the map render as plain text.
    const auditCols = (ui?.screens.audit?.spec.elements.events?.props.columns ?? []) as Array<
      Record<string, unknown>
    >;
    expect(auditCols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'targetId',
          hrefTemplateMap: expect.objectContaining({
            typeField: 'targetType',
            byType: expect.objectContaining({
              deployment: '/{orgId}/deployments/{targetId}',
              project: '/{orgId}/projects/{targetId}',
            }),
          }),
        }),
      ]),
    );

    const deploymentActions = (ui?.screens.deployment?.spec.elements.header?.props.actions ??
      []) as Array<Record<string, unknown>>;
    expect(deploymentActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Back to deployments', hrefTemplate: '/{orgId}' }),
      ]),
    );
    // The dead duplicate `Refresh` header action has been removed; the working
    // refresh button is still on the deployment panel.
    expect(deploymentActions.some((a) => a.label === 'Refresh')).toBe(false);

    // Slice D — project-version (Queue deployment) screen carries a Back
    // header action so the user is not stranded inside the Queue form.
    const versionActions = (ui?.screens['project-version']?.spec.elements.header?.props.actions ??
      []) as Array<Record<string, unknown>>;
    expect(versionActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Back to project',
          hrefTemplate: '/{orgId}/projects/{projectId}',
        }),
        expect.objectContaining({
          label: 'Deployments',
          hrefTemplate: '/{orgId}/projects/{projectId}/deployments',
        }),
      ]),
    );

    // Slice D — API explorer screen passes graph + PDM route templates to
    // PlatformAPIExplorer so the Overview pane can render Handler / Source
    // artifact / Request schema / Response schema as cross-links.
    expect(ui?.screens.api?.spec.elements.endpointsExplorer).toMatchObject({
      type: 'PlatformAPIExplorer',
      props: {
        graphHrefTemplate: '/{orgId}/projects/{projectId}/graph',
        pdmHrefTemplate: '/{orgId}/projects/{projectId}/data-model',
      },
    });
  });
});

// Drift detector: every prop a screen or layout spec passes to a component
// declared by `@rntme/platform-ui/module.json` must be present in that
// module's component schema. Adding an unknown prop to a screen spec must
// fail CI here — silent drift between specs and module.json is what F040
// (simplify-monorepo-audit Q6) was chartered to eliminate.
describe('platform UI module.json schema drift', () => {
  type ModuleComponent = { type: string; props?: Record<string, unknown> };
  type ModuleManifest = { client?: { components?: ModuleComponent[] } };

  function readJson(path: string): unknown {
    return JSON.parse(readFileSync(path, 'utf8'));
  }

  function collectSpecPropPairs(): Map<string, Map<string, Set<string>>> {
    // type -> propName -> Set<spec file label>
    const pairs = new Map<string, Map<string, Set<string>>>();
    const specDirs = [
      join(blueprintRoot, 'services/app/ui/screens'),
      join(blueprintRoot, 'services/app/ui/layouts'),
    ];
    function walk(node: unknown, fileLabel: string): void {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (const item of node) walk(item, fileLabel);
        return;
      }
      const obj = node as Record<string, unknown>;
      const type = obj.type;
      const props = obj.props;
      if (
        typeof type === 'string'
        && props
        && typeof props === 'object'
        && !Array.isArray(props)
      ) {
        let perType = pairs.get(type);
        if (!perType) {
          perType = new Map();
          pairs.set(type, perType);
        }
        for (const prop of Object.keys(props as Record<string, unknown>)) {
          let usedIn = perType.get(prop);
          if (!usedIn) {
            usedIn = new Set();
            perType.set(prop, usedIn);
          }
          usedIn.add(fileLabel);
        }
      }
      for (const key of Object.keys(obj)) walk(obj[key], fileLabel);
    }
    for (const dir of specDirs) {
      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.spec.json')) continue;
        const fullPath = join(dir, file);
        walk(readJson(fullPath), `${dir.split('/').slice(-2).join('/')}/${file}`);
      }
    }
    return pairs;
  }

  it('declares every component prop that any screen or layout spec passes', () => {
    const moduleManifestPath = join(here, '../../ui-module/module.json');
    const manifest = readJson(moduleManifestPath) as ModuleManifest;
    const declared = new Map<string, Set<string>>();
    for (const component of manifest.client?.components ?? []) {
      const propNames = new Set<string>(
        component.props && typeof component.props === 'object'
          ? Object.keys(component.props as Record<string, unknown>)
          : [],
      );
      declared.set(component.type, propNames);
    }

    const pairs = collectSpecPropPairs();
    const violations: string[] = [];
    for (const [type, propMap] of pairs) {
      const declaredProps = declared.get(type);
      // Skip types not declared by @rntme/platform-ui — those belong to other
      // modules (Button, Input, LoginScreen, Slot, etc.) whose schemas are
      // out of scope for this drift check.
      if (!declaredProps) continue;
      for (const [prop, usedIn] of propMap) {
        if (!declaredProps.has(prop)) {
          violations.push(
            `${type}.${prop} is passed by ${[...usedIn].sort().join(', ')} but is not declared in ui-module/module.json`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
