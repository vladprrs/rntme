import { describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadComposedBlueprint } from '../../../../packages/artifacts/blueprint/src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const blueprintRoot = join(here, '..');

describe('platform blueprint', () => {
  it('composes the foundation platform blueprint', async () => {
    const result = await loadComposedBlueprint(blueprintRoot);
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;

    expect(result.value.project.name).toBe('rntme-platform');
    expect(Object.keys(result.value.services).sort()).toEqual(['app', 'audit', 'deployments', 'identity-auth0', 'organizations', 'projects', 'tokens']);
    expect(result.value.bindingRegistry['organizations.listOrganizations']?.path).toBe('/api/organizations');
    expect(result.value.bindingRegistry['projects.listProjects']?.path).toBe('/api/projects');
    expect(result.value.bindingRegistry['projects.listProjectServices']?.path).toBe('/api/projects/{projectId}/services');
    expect(result.value.bindingRegistry['projects.getProjectArtifactSummary']?.path).toBe('/api/projects/{projectId}/artifact-summary');
    expect(result.value.bindingRegistry['projects.getProjectArtifact']?.path).toBe('/api/projects/{projectId}/artifacts');
    expect(result.value.bindingRegistry['projects.listProjectEndpoints']?.path).toBe('/api/projects/{projectId}/endpoints');
    expect(result.value.bindingRegistry['projects.listProjectUiComponents']?.path).toBe('/api/projects/{projectId}/ui-components');
    expect(result.value.bindingRegistry['projects.listProjectGraphs']?.path).toBe('/api/projects/{projectId}/graphs');
    expect(result.value.bindingRegistry['tokens.listTokens']?.path).toBe('/api/tokens');
    expect(result.value.bindingRegistry['audit.listAuditEvents']?.path).toBe('/api/audit');
  });

  it('uses multi-provider edge auth with platform-tokens first', async () => {
    const result = await loadComposedBlueprint(join(here, '..'));
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;

    expect(result.value.project.middleware?.auth).toEqual({
      kind: 'auth',
      providers: [
        {
          provider: 'platform-tokens',
          moduleSlug: 'tokens',
          introspectPath: '/api/tokens/introspect',
          introspectPort: 3000,
        },
        {
          provider: 'auth0',
          audience: '${AUTH0_AUDIENCE}',
          moduleSlug: 'identity-auth0',
        },
      ],
    });
    expect(result.value.bindingRegistry['tokens.introspectToken']?.path).toBe('/api/tokens/introspect');
  });

  it('mounts an edge body limit for project bundle publishing', async () => {
    const result = await loadComposedBlueprint(join(here, '..'));
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;

    expect(result.value.project.middleware?.projectBundleBodyLimit).toEqual({
      kind: 'body-limit',
      policy: 'projectBundle',
    });
    expect(result.value.project.mounts?.find((mount) => mount.target === 'http:/api/projects')?.use).toEqual([
      'requestContext',
      'projectBundleBodyLimit',
      'auth',
    ]);
  });

  it('declares IntrospectToken as a service operation in services/tokens/operations.json', async () => {
    const manifestPath = join(here, '../services/tokens/operations.json');
    expect(existsSync(manifestPath)).toBe(true);
    const raw = await readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe('1');
    expect(parsed.operations).toBeDefined();
    expect(parsed.operations.IntrospectToken).toEqual({
      handler: { kind: 'native', entry: './handlers/introspect-token.ts', export: 'introspectTokenHandler' },
      input: { bearerToken: { type: 'string', mode: 'defaulted', default: null } },
      output: { type: 'IntrospectTokenResult' },
      effect: 'read',
      idempotency: 'none',
    });
    const handlerPath = join(here, '../services/tokens/handlers/introspect-token.ts');
    expect(existsSync(handlerPath)).toBe(true);
  });

  it('registers listProjectServices as a native projects operation + GET binding', async () => {
    const operationsPath = join(here, '../services/projects/operations.json');
    const operations = JSON.parse(await readFile(operationsPath, 'utf8'));
    expect(operations.operations.listProjectServices).toEqual({
      handler: {
        kind: 'native',
        entry: './handlers/list-project-services.ts',
        export: 'listProjectServicesHandler',
      },
      input: {
        projectId: { type: 'string', mode: 'required' },
        sessionSubject: { type: 'string', mode: 'optional' },
        sessionStatus: { type: 'string', mode: 'optional' },
      },
      output: { type: 'ListProjectServicesResult' },
      effect: 'read',
      idempotency: 'none',
    });
    expect(existsSync(join(here, '../services/projects/handlers/list-project-services.ts'))).toBe(true);

    const bindingsPath = join(here, '../services/projects/bindings/bindings.json');
    const bindings = JSON.parse(await readFile(bindingsPath, 'utf8'));
    expect(bindings.bindings.listProjectServices.graph).toBe('listProjectServices');
    expect(bindings.bindings.listProjectServices.target).toEqual({ engine: 'native', dialect: 'platform' });
    expect(bindings.bindings.listProjectServices.http.method).toBe('GET');
    expect(bindings.bindings.listProjectServices.http.path).toBe('/{projectId}/services');
  });

  it('registers getProjectArtifactSummary as a native projects operation + GET binding', async () => {
    const operationsPath = join(here, '../services/projects/operations.json');
    const operations = JSON.parse(await readFile(operationsPath, 'utf8'));
    expect(operations.operations.getProjectArtifactSummary).toEqual({
      handler: {
        kind: 'native',
        entry: './handlers/get-project-artifact-summary.ts',
        export: 'getProjectArtifactSummaryHandler',
      },
      input: {
        projectId: { type: 'string', mode: 'required' },
        sessionSubject: { type: 'string', mode: 'optional' },
        sessionStatus: { type: 'string', mode: 'optional' },
      },
      output: { type: 'GetProjectArtifactSummaryResult' },
      effect: 'read',
      idempotency: 'none',
    });
    expect(existsSync(join(here, '../services/projects/handlers/get-project-artifact-summary.ts'))).toBe(true);

    const bindingsPath = join(here, '../services/projects/bindings/bindings.json');
    const bindings = JSON.parse(await readFile(bindingsPath, 'utf8'));
    expect(bindings.bindings.getProjectArtifactSummary.graph).toBe('getProjectArtifactSummary');
    expect(bindings.bindings.getProjectArtifactSummary.target).toEqual({ engine: 'native', dialect: 'platform' });
    expect(bindings.bindings.getProjectArtifactSummary.http.method).toBe('GET');
    expect(bindings.bindings.getProjectArtifactSummary.http.path).toBe('/{projectId}/artifact-summary');
  });

  it('registers getProjectArtifact as a native projects operation + GET binding', async () => {
    const operationsPath = join(here, '../services/projects/operations.json');
    const operations = JSON.parse(await readFile(operationsPath, 'utf8'));
    expect(operations.operations.getProjectArtifact).toEqual({
      handler: {
        kind: 'native',
        entry: './handlers/get-project-artifact.ts',
        export: 'getProjectArtifactHandler',
      },
      input: {
        projectId: { type: 'string', mode: 'required' },
        artifactPath: { type: 'string', mode: 'required' },
        sessionSubject: { type: 'string', mode: 'optional' },
        sessionStatus: { type: 'string', mode: 'optional' },
      },
      output: { type: 'GetProjectArtifactResult' },
      effect: 'read',
      idempotency: 'none',
    });
    expect(existsSync(join(here, '../services/projects/handlers/get-project-artifact.ts'))).toBe(true);

    const bindingsPath = join(here, '../services/projects/bindings/bindings.json');
    const bindings = JSON.parse(await readFile(bindingsPath, 'utf8'));
    expect(bindings.bindings.getProjectArtifact.graph).toBe('getProjectArtifact');
    expect(bindings.bindings.getProjectArtifact.target).toEqual({ engine: 'native', dialect: 'platform' });
    expect(bindings.bindings.getProjectArtifact.http.method).toBe('GET');
    expect(bindings.bindings.getProjectArtifact.http.path).toBe('/{projectId}/artifacts');
    expect(bindings.bindings.getProjectArtifact.http.parameters).toEqual([
      { name: 'projectId', in: 'path', bindTo: 'projectId', required: true },
      { name: 'artifactPath', in: 'query', bindTo: 'artifactPath', required: true },
    ]);
  });

  it('registers listProjectEndpoints as a native projects operation + GET binding', async () => {
    const operationsPath = join(here, '../services/projects/operations.json');
    const operations = JSON.parse(await readFile(operationsPath, 'utf8'));
    expect(operations.operations.listProjectEndpoints).toEqual({
      handler: {
        kind: 'native',
        entry: './handlers/list-project-endpoints.ts',
        export: 'listProjectEndpointsHandler',
      },
      input: {
        projectId: { type: 'string', mode: 'required' },
        sessionSubject: { type: 'string', mode: 'optional' },
        sessionStatus: { type: 'string', mode: 'optional' },
      },
      output: { type: 'ListProjectEndpointsResult' },
      effect: 'read',
      idempotency: 'none',
    });
    expect(existsSync(join(here, '../services/projects/handlers/list-project-endpoints.ts'))).toBe(true);

    const bindingsPath = join(here, '../services/projects/bindings/bindings.json');
    const bindings = JSON.parse(await readFile(bindingsPath, 'utf8'));
    expect(bindings.bindings.listProjectEndpoints.graph).toBe('listProjectEndpoints');
    expect(bindings.bindings.listProjectEndpoints.target).toEqual({ engine: 'native', dialect: 'platform' });
    expect(bindings.bindings.listProjectEndpoints.http.method).toBe('GET');
    expect(bindings.bindings.listProjectEndpoints.http.path).toBe('/{projectId}/endpoints');
    expect(bindings.bindings.listProjectEndpoints.http.parameters).toEqual([
      { name: 'projectId', in: 'path', bindTo: 'projectId', required: true },
    ]);
  });

  it('registers listProjectUiComponents as a native projects operation + GET binding', async () => {
    const operationsPath = join(here, '../services/projects/operations.json');
    const operations = JSON.parse(await readFile(operationsPath, 'utf8'));
    expect(operations.operations.listProjectUiComponents).toEqual({
      handler: {
        kind: 'native',
        entry: './handlers/list-project-ui-components.ts',
        export: 'listProjectUiComponentsHandler',
      },
      input: {
        projectId: { type: 'string', mode: 'required' },
        sessionSubject: { type: 'string', mode: 'optional' },
        sessionStatus: { type: 'string', mode: 'optional' },
      },
      output: { type: 'ListProjectUiComponentsResult' },
      effect: 'read',
      idempotency: 'none',
    });
    expect(existsSync(join(here, '../services/projects/handlers/list-project-ui-components.ts'))).toBe(true);

    const bindingsPath = join(here, '../services/projects/bindings/bindings.json');
    const bindings = JSON.parse(await readFile(bindingsPath, 'utf8'));
    expect(bindings.bindings.listProjectUiComponents.graph).toBe('listProjectUiComponents');
    expect(bindings.bindings.listProjectUiComponents.target).toEqual({ engine: 'native', dialect: 'platform' });
    expect(bindings.bindings.listProjectUiComponents.http.method).toBe('GET');
    expect(bindings.bindings.listProjectUiComponents.http.path).toBe('/{projectId}/ui-components');
    expect(bindings.bindings.listProjectUiComponents.http.parameters).toEqual([
      { name: 'projectId', in: 'path', bindTo: 'projectId', required: true },
    ]);
  });

  it('registers listProjectGraphs as a native projects operation + GET binding', async () => {
    const operationsPath = join(here, '../services/projects/operations.json');
    const operations = JSON.parse(await readFile(operationsPath, 'utf8'));
    expect(operations.operations.listProjectGraphs).toEqual({
      handler: {
        kind: 'native',
        entry: './handlers/list-project-graphs.ts',
        export: 'listProjectGraphsHandler',
      },
      input: {
        projectId: { type: 'string', mode: 'required' },
        sessionSubject: { type: 'string', mode: 'optional' },
        sessionStatus: { type: 'string', mode: 'optional' },
      },
      output: { type: 'ListProjectGraphsResult' },
      effect: 'read',
      idempotency: 'none',
    });
    expect(existsSync(join(here, '../services/projects/handlers/list-project-graphs.ts'))).toBe(true);

    const bindingsPath = join(here, '../services/projects/bindings/bindings.json');
    const bindings = JSON.parse(await readFile(bindingsPath, 'utf8'));
    expect(bindings.bindings.listProjectGraphs.graph).toBe('listProjectGraphs');
    expect(bindings.bindings.listProjectGraphs.target).toEqual({ engine: 'native', dialect: 'platform' });
    expect(bindings.bindings.listProjectGraphs.http.method).toBe('GET');
    expect(bindings.bindings.listProjectGraphs.http.path).toBe('/{projectId}/graphs');
    expect(bindings.bindings.listProjectGraphs.http.parameters).toEqual([
      { name: 'projectId', in: 'path', bindTo: 'projectId', required: true },
    ]);
  });

  it('lets token introspection map a missing Authorization header to a typed auth error', async () => {
    const bindingsPath = join(here, '../services/tokens/bindings/bindings.json');
    const raw = await readFile(bindingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.bindings.introspectToken.inputFrom.bearerToken).toEqual({
      from: 'header',
      name: 'authorization',
      required: false,
    });
  });
});
