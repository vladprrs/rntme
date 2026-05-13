import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitProto } from '@rntme/bindings-grpc';
import type { ComposedBlueprint } from '@rntme/blueprint';
import type { ComposedProjectInput } from '@rntme/deploy-core';
import {
  buildRuntimeModuleWiringForService,
  buildRuntimeModuleWiringForUiHost,
  buildServiceSlugByModuleKey,
} from './runtime-module-wiring.js';

type LoadedDeployProject = ComposedProjectInput | ComposedBlueprint;

export async function toDeployCoreInput(
  value: LoadedDeployProject,
  rootDir: string,
): Promise<ComposedProjectInput> {
  if (!isComposedBlueprint(value)) return value;

  assertRuntimeArtifactStates(value);

  const uiBuildFiles =
    value.virtualEntrySource === null || value.virtualEntrySource === undefined
      ? {}
      : await bundleVirtualEntrySource(value.virtualEntrySource, rootDir);

  // Build modules map: service slug → { edgeAuth }. catalogManifest is keyed by
  // the resolved module manifest name (for example "@rntme/identity-auth0"),
  // while project.modules may use a local package alias such as
  // "rntme_identity_auth0". categoryToModule bridges the project role key to
  // the canonical manifest name used by the catalog.
  const catalogManifest = value.catalogManifest;
  const moduleEdgeAuth = catalogManifest?.moduleEdgeAuth ?? {};
  const modules: Record<string, { edgeAuth: (typeof moduleEdgeAuth)[string] | null; packageName?: string }> = {};
  for (const [projectKey, moduleRef] of Object.entries(value.project.modules ?? {})) {
    const manifestName = catalogManifest?.categoryToModule[projectKey] ?? moduleRef.package;
    const edgeAuth = moduleEdgeAuth[manifestName] ?? moduleEdgeAuth[moduleRef.package] ?? null;
    const slugs = new Set([manifestName.split('/').pop()!, moduleRef.package.split('/').pop()!]);
    for (const slug of slugs) {
      modules[slug] = { edgeAuth, packageName: manifestName };
    }
  }

  const workflowFiles =
    value.workflows === null || value.workflows === undefined
      ? undefined
      : await readWorkflowDefinitionFiles(value.workflows, rootDir);
  const workflowGrpcServices = workflowGrpcServicesForProject(value);

  return {
    name: value.project.name,
    publicConfigJson: value.publicConfigJson ?? null,
    varsManifest: value.varsManifest,
    services: Object.fromEntries(
      await Promise.all(
        value.project.services.map(async (slug) => [
          slug,
          {
            slug,
            kind: value.services[slug]?.kind ?? 'domain',
            ...(value.services[slug]?.moduleKey === undefined
              ? {}
              : { moduleKey: value.services[slug]!.moduleKey }),
            ...(value.services[slug]?.kind === 'domain'
              ? {
                  runtimeFiles: await buildRuntimeArtifactFiles(
                    value,
                    rootDir,
                    slug,
                    serviceHostsUiRoute(value.project, slug) ? uiBuildFiles : {},
                  ),
                }
              : {}),
          },
        ]),
      ),
    ),
    ...(value.project.routes === undefined ? {} : { routes: value.project.routes }),
    ...(value.project.middleware === undefined ? {} : { middleware: value.project.middleware }),
    ...(value.project.mounts === undefined ? {} : { mounts: value.project.mounts }),
    ...(Object.keys(modules).length > 0 ? { modules } : {}),
    ...(value.workflows === undefined ? {} : { workflows: value.workflows }),
    ...(workflowFiles === undefined ? {} : { workflowFiles }),
    ...(Object.keys(workflowGrpcServices).length === 0 ? {} : { workflowGrpcServices }),
  };
}

function assertRuntimeArtifactStates(project: ComposedBlueprint): void {
  for (const serviceSlug of project.project.services) {
    const service = project.services[serviceSlug];
    if (service === undefined) throw new Error(`DEPLOY_EXECUTOR_SERVICE_ARTIFACTS_NOT_FOUND:${serviceSlug}`);
    const artifactState = domainArtifactState(service);
    if (artifactState.kind === 'partial') {
      throw new Error(
        `DEPLOY_EXECUTOR_SERVICE_ARTIFACTS_PARTIAL:${serviceSlug}:present=${artifactState.present.join(',')}:missing=${artifactState.missing.join(',')}`,
      );
    }
  }
}

type WorkflowGrpcServiceRegistry = NonNullable<ComposedProjectInput['workflowGrpcServices']>;
type GrpcShapeRegistry = Parameters<typeof emitProto>[1];
type GrpcResolvedShape = GrpcShapeRegistry[string];

function workflowGrpcServicesForProject(project: ComposedBlueprint): WorkflowGrpcServiceRegistry {
  if (project.workflows === null || project.workflows === undefined) return {};
  const serviceSlugs = new Set(
    project.workflows.serviceTasks
      .map((task) => task.bindingRef.split('.')[0] ?? '')
      .filter((slug) => slug.length > 0),
  );
  const out: Record<string, WorkflowGrpcServiceRegistry[string]> = {};
  for (const serviceSlug of [...serviceSlugs].sort()) {
    const service = project.services[serviceSlug];
    if (service?.bindings === null || service?.bindings === undefined || service.graphSpec === null) continue;
    const packageName = grpcPackageNameForService(serviceSlug);
    const serviceName = grpcServiceNameForService(serviceSlug);
    out[serviceSlug] = {
      packageName,
      serviceName,
      protoSource: emitProto(service.bindings, collectGrpcShapesFromService(service), { packageName, serviceName }),
    };
  }
  return out;
}

function grpcPackageNameForService(serviceSlug: string): string {
  return `rntme.${serviceSlug.trim().toLowerCase().replace(/-/g, '_')}.v1`;
}

function grpcServiceNameForService(serviceSlug: string): string {
  return `${serviceSlug
    .split(/[^A-Za-z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('')}Service`;
}

function collectGrpcShapesFromService(service: ComposedBlueprint['services'][string]): GrpcShapeRegistry {
  const acc: Record<string, GrpcResolvedShape> = {};
  const addCustomShape = (shapeName: string): void => {
    if (acc[shapeName] !== undefined) return;
    const custom = service.graphSpec?.shapes[shapeName];
    if (custom === undefined) return;
    acc[shapeName] = {
      name: shapeName,
      origin: 'custom',
      fields: Object.fromEntries(
        Object.entries(custom.fields).map(([fieldName, field]) => [
          fieldName,
          {
            type: { kind: 'scalar', primitive: field.type },
            nullable: field.nullable,
          },
        ]),
      ),
    } as GrpcResolvedShape;
  };

  for (const resolved of Object.values(service.bindings?.resolved ?? {})) {
    acc[resolved.outputShape.name] = resolved.outputShape as GrpcResolvedShape;
    for (const input of Object.values(resolved.signature.inputs)) {
      if (input.type.kind === 'row' || input.type.kind === 'rowset') {
        addCustomShape(input.type.shape);
      }
    }
  }
  return acc;
}

async function readWorkflowDefinitionFiles(
  workflows: NonNullable<ComposedBlueprint['workflows']>,
  rootDir: string,
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const definition of workflows.definitions) {
    if (Object.hasOwn(files, definition.bpmnFile)) continue;
    const path = workflowDefinitionPath(rootDir, definition.bpmnFile);
    try {
      files[definition.bpmnFile] = await readFile(path, 'utf8');
    } catch (cause) {
      if (errorCode(cause) === 'ENOENT') {
        throw new Error(`DEPLOY_EXECUTOR_WORKFLOW_FILE_NOT_FOUND: workflows/${definition.bpmnFile}`);
      }
      throw cause;
    }
  }
  return files;
}

function workflowDefinitionPath(rootDir: string, relativePath: string): string {
  if (!isSafeWorkflowFilePath(relativePath)) {
    throw new Error(`DEPLOY_EXECUTOR_WORKFLOW_FILE_PATH_INVALID: workflows/${relativePath}`);
  }
  const workflowRoot = join(rootDir, 'workflows');
  const filePath = join(workflowRoot, relativePath);
  const backToRoot = relative(workflowRoot, filePath).split('\\').join('/');
  if (backToRoot === '..' || backToRoot.startsWith('../')) {
    throw new Error(`DEPLOY_EXECUTOR_WORKFLOW_FILE_PATH_INVALID: workflows/${relativePath}`);
  }
  return filePath;
}

function isSafeWorkflowFilePath(path: string): boolean {
  if (path === '') return false;
  if (path.startsWith('/')) return false;
  if (path.includes('\\')) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(path)) return false;
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

async function buildRuntimeArtifactFiles(
  project: ComposedBlueprint,
  rootDir: string,
  serviceSlug: string,
  uiBuildFiles: Record<string, string>,
): Promise<Record<string, string>> {
  const service = project.services[serviceSlug];
  if (service === undefined) throw new Error(`DEPLOY_EXECUTOR_SERVICE_ARTIFACTS_NOT_FOUND:${serviceSlug}`);
  const artifactState = domainArtifactState(service);
  if (artifactState.kind === 'partial') {
    throw new Error(
      `DEPLOY_EXECUTOR_SERVICE_ARTIFACTS_PARTIAL:${serviceSlug}:present=${artifactState.present.join(',')}:missing=${artifactState.missing.join(',')}`,
    );
  }
  if (artifactState.kind === 'ui-only') {
    return buildUiHostRuntimeArtifactFiles(project, rootDir, serviceSlug, uiBuildFiles);
  }

  if (service.graphSpec === null) throw new Error(`DEPLOY_EXECUTOR_SERVICE_GRAPHS_NOT_FOUND:${serviceSlug}`);
  if (service.qsmValidated === null) throw new Error(`DEPLOY_EXECUTOR_SERVICE_QSM_NOT_FOUND:${serviceSlug}`);
  if (service.bindings === null) throw new Error(`DEPLOY_EXECUTOR_SERVICE_BINDINGS_NOT_FOUND:${serviceSlug}`);

  const files: Record<string, string> = {};
  const wiring = buildRuntimeModuleWiringForService(
    project,
    serviceSlug,
    buildServiceSlugByModuleKey(project),
  );
  addJsonFile(files, 'manifest.json', {
    rntmeVersion: '1.0',
    service: { name: serviceSlug, version: '1.0.0' },
    surface: { http: { enabled: true, port: 3000 }, grpc: { enabled: true, port: 50051 } },
    seed: { enabled: service.seed !== null, path: 'seed.json' },
    modules: wiring.modules,
  });
  Object.assign(files, wiring.files);
  addJsonFile(files, 'pdm.json', project.pdm);
  addJsonFile(files, 'qsm.json', service.qsmValidated);
  addJsonFile(files, 'bindings.json', service.bindings.artifact);
  addJsonFile(files, 'shapes.json', service.graphSpec.shapes);

  for (const [graphId, graph] of Object.entries(service.graphSpec.graphs)) {
    addJsonFile(files, `graphs/${graphId}.json`, graph);
  }

  const hasServiceUi = await addOptionalDirectoryFiles(files, rootDir, `services/${serviceSlug}/ui`, 'ui');
  if (!hasServiceUi) addDefaultUiFiles(files, serviceSlug);
  Object.assign(files, uiBuildFiles);
  // Only emit UI module assets for the service that hosts the UI route.
  if (Object.keys(uiBuildFiles).length > 0) await addUiModuleAssetFiles(files, project);
  if (service.seed !== null) {
    await addOptionalTextFile(files, rootDir, `services/${serviceSlug}/seed/seed.json`, 'seed.json');
  }

  return files;
}

function domainArtifactState(service: ComposedBlueprint['services'][string]):
  | { kind: 'full' }
  | { kind: 'ui-only' }
  | { kind: 'partial'; present: string[]; missing: string[] } {
  const artifacts = [
    ['graphSpec', service.graphSpec !== null],
    ['qsm', service.qsmValidated !== null],
    ['bindings', service.bindings !== null],
  ] as const;
  const present = artifacts.filter(([, isPresent]) => isPresent).map(([name]) => name);
  const missing = artifacts.filter(([, isPresent]) => !isPresent).map(([name]) => name);
  if (present.length === artifacts.length) return { kind: 'full' };
  if (present.length === 0) return { kind: 'ui-only' };
  return { kind: 'partial', present, missing };
}

async function buildUiHostRuntimeArtifactFiles(
  project: ComposedBlueprint,
  rootDir: string,
  serviceSlug: string,
  uiBuildFiles: Record<string, string>,
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const wiring = buildRuntimeModuleWiringForUiHost(project, buildServiceSlugByModuleKey(project));
  addJsonFile(files, 'manifest.json', {
    rntmeVersion: '1.0',
    service: { name: serviceSlug, version: '1.0.0' },
    surface: { http: { enabled: true, port: 3000 }, grpc: { enabled: false, port: 50051 } },
    seed: { enabled: false, path: 'seed.json' },
    modules: wiring.modules,
  });
  Object.assign(files, wiring.files);
  addJsonFile(files, 'pdm.json', project.pdm);
  addJsonFile(files, 'qsm.json', buildUiHostQsmArtifact(project));

  const synthetic = buildUiHostBindingArtifacts(project);
  addJsonFile(files, 'shapes.json', synthetic.shapes);
  addJsonFile(files, 'bindings.json', synthetic.bindings);
  for (const [graphId, graph] of Object.entries(synthetic.graphs)) {
    addJsonFile(files, `graphs/${graphId}.json`, graph);
  }

  const hasServiceUi = await addOptionalDirectoryFiles(files, rootDir, `services/${serviceSlug}/ui`, 'ui');
  if (!hasServiceUi) addDefaultUiFiles(files, serviceSlug);
  Object.assign(files, uiBuildFiles);
  // Only emit UI module assets for the service that hosts the UI route.
  if (Object.keys(uiBuildFiles).length > 0) await addUiModuleAssetFiles(files, project);
  return files;
}

function buildUiHostBindingArtifacts(project: ComposedBlueprint): {
  readonly shapes: Record<string, unknown>;
  readonly graphs: Record<string, unknown>;
  readonly bindings: Record<string, unknown>;
} {
  const shapes: Record<string, unknown> = {};
  const graphs: Record<string, unknown> = {};
  const bindings: Record<string, unknown> = {};

  for (const entry of Object.values(project.bindingRegistry)) {
    const sourceService = project.services[entry.service];
    const sourceBindings = sourceService?.bindings;
    const sourceGraphSpec = sourceService?.graphSpec;
    if (sourceBindings === null || sourceBindings === undefined || sourceGraphSpec === null || sourceGraphSpec === undefined) {
      continue;
    }

    Object.assign(shapes, sourceGraphSpec.shapes);
    const sourceBinding = sourceBindings.artifact.bindings[entry.bindingId];
    if (sourceBinding === undefined) continue;

    const sourceGraph = sourceGraphSpec.graphs[sourceBinding.graph];
    if (sourceGraph === undefined) continue;

    const graphId = `${entry.service}.${sourceBinding.graph}`;
    graphs[graphId] = { ...sourceGraph, id: graphId };
    bindings[entry.qualifiedId] = {
      ...sourceBinding,
      graph: graphId,
      http: {
        ...sourceBinding.http,
        method: entry.method,
        path: pathForRuntimeHttpMap(entry.path),
      },
    };
  }

  return {
    shapes,
    graphs,
    bindings: {
      version: '1.0',
      graphSpecRef: 'ui-host.graphs.v1',
      pdmRef: 'ui-host.domain.v1',
      qsmRef: 'ui-host.read.v1',
      bindings,
    },
  };
}

function buildUiHostQsmArtifact(project: ComposedBlueprint): Record<string, unknown> {
  const projections: Record<string, unknown> = {};
  const relations: Record<string, unknown> = {};
  const sourceServices = new Set(Object.values(project.bindingRegistry).map((entry) => entry.service));
  for (const serviceSlug of [...sourceServices].sort()) {
    const qsm = project.services[serviceSlug]?.qsmValidated;
    if (qsm === null || qsm === undefined) continue;
    Object.assign(projections, qsm.projections);
    Object.assign(relations, qsm.relations);
  }
  return { projections, relations };
}

function pathForRuntimeHttpMap(projectPath: string): string {
  if (projectPath === '/api') return '/';
  if (projectPath.startsWith('/api/')) return projectPath.slice('/api'.length);
  return projectPath;
}

async function bundleVirtualEntrySource(
  virtualEntrySource: string,
  rootDir: string,
): Promise<Record<string, string>> {
  const workspaceRoot = findWorkspaceRoot();
  const outdir = join(rootDir, '.rntme-ui-build');
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
  const entrypoint = join(outdir, '__rntme_ui_entry.tsx');
  await writeFile(entrypoint, virtualEntrySource);

  const result = await Bun.build({
    entrypoints: [entrypoint],
    root: workspaceRoot,
    target: 'browser',
    format: 'esm',
    splitting: true,
    sourcemap: 'none',
    minify: true,
    outdir,
    naming: { entry: 'main.js', chunk: 'chunks/[name]-[hash].[ext]' },
    env: 'disable',
    plugins: [workspacePackageResolver(workspaceRoot)],
    throw: false,
  });
  if (!result.success) {
    const logs = result.logs.map((log) => log.message).join('\n');
    throw new Error(`DEPLOY_EXECUTOR_UI_BUNDLE_FAILED${logs === '' ? '' : `:${logs}`}`);
  }

  const js = result.outputs.find((file) => file.path.endsWith('/main.js') || file.path.endsWith('\\main.js'));
  if (js === undefined) throw new Error('DEPLOY_EXECUTOR_UI_BUNDLE_MISSING_MAIN_JS');

  const files: Record<string, string> = { 'ui-build/main.css': readUiRuntimeCss(workspaceRoot) };
  for (const file of result.outputs) {
    const rel = relative(outdir, file.path).split('\\').join('/');
    if (rel.startsWith('..') || rel === '') continue;
    files[`ui-build/${rel}`] = await file.text();
  }
  return files;
}

function workspacePackageResolver(workspaceRoot: string): Bun.BunPlugin {
  const packageDirs = discoverWorkspacePackageDirs(workspaceRoot);
  return {
    name: 'rntme-workspace-package-resolver',
    setup(buildApi) {
      buildApi.onResolve({ filter: /^@rntme\// }, (args) => {
        const packageName = packageNameFromImport(args.path);
        const packageDir = packageDirs.get(packageName);
        if (packageDir === undefined) return undefined;
        const subpath = args.path.slice(packageName.length);
        const resolved = resolveWorkspaceExport(packageDir, subpath.length === 0 ? '.' : `.${subpath}`);
        // Only return the workspace resolution if the file actually exists.
        // If the dist hasn't been built (e.g. an unbuilt module stub), fall
        // through so the bundler can find it via node_modules instead.
        if (!existsSync(resolved)) return undefined;
        return { path: resolved };
      });
      buildApi.onResolve({ filter: /^\..*\.js$/ }, (args) => {
        const jsPath = join(args.resolveDir, args.path);
        if (existsSync(jsPath)) return undefined;
        const withoutJs = jsPath.slice(0, -'.js'.length);
        for (const candidate of [`${withoutJs}.ts`, `${withoutJs}.tsx`]) {
          if (existsSync(candidate)) return { path: candidate };
        }
        return undefined;
      });
      buildApi.onResolve({ filter: /^[^./].*/ }, (args) => {
        if (args.path.startsWith('@rntme/')) return undefined;
        if (args.path.startsWith('node:') || args.path.startsWith('bun:')) return undefined;
        const parents = [
          ...(args.resolveDir === '' ? [] : [join(args.resolveDir, '__rntme_resolve_parent.js')]),
          ...[...packageDirs.values()].map((packageDir) => join(packageDir, 'package.json')),
        ];
        for (const parent of parents) {
          try {
            return { path: createRequire(parent).resolve(args.path) };
          } catch {
            try {
              return { path: Bun.resolveSync(args.path, parent) };
            } catch {
              // Try the next workspace package root.
            }
          }
        }
        return undefined;
      });
      buildApi.onResolve({ filter: /\.css$/ }, (args) => ({
        path: args.path,
        namespace: 'rntme-empty-css',
      }));
      buildApi.onLoad({ filter: /.*/, namespace: 'rntme-empty-css' }, () => ({
        contents: '',
        loader: 'js',
      }));
    },
  };
}

function discoverWorkspacePackageDirs(workspaceRoot: string): Map<string, string> {
  const dirs = new Map<string, string>();
  for (const parent of ['packages', 'modules', 'apps']) {
    collectPackageDirs(join(workspaceRoot, parent), dirs);
  }
  return dirs;
}

function collectPackageDirs(dir: string, output: Map<string, string>): void {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    // Skip node_modules entirely — we only want workspace source packages.
    if (entry.name === 'node_modules') continue;
    const path = join(dir, entry.name);
    const packageJsonPath = join(path, 'package.json');
    if (existsSync(packageJsonPath)) {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { name?: unknown };
      if (typeof pkg.name === 'string') output.set(pkg.name, path);
      // Continue recursing: nested workspace dirs (e.g. apps/platform/ui-module)
      // may sit inside a directory that also has its own package.json.
      collectPackageDirs(path, output);
    } else {
      collectPackageDirs(path, output);
    }
  }
}

function packageNameFromImport(value: string): string {
  const [scope, name] = value.split('/');
  return `${scope}/${name}`;
}

function resolveWorkspaceExport(packageDir: string, subpath: string): string {
  const packageJsonPath = join(packageDir, 'package.json');
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    exports?: unknown;
    main?: unknown;
  };
  const target = exportTargetForSubpath(pkg.exports, subpath) ?? (subpath === '.' ? pkg.main : undefined);
  if (typeof target === 'string') return resolveWorkspaceTarget(packageDir, target);
  return join(packageDir, subpath === '.' ? 'index.js' : subpath.slice(2));
}

function resolveWorkspaceTarget(packageDir: string, target: string): string {
  const normalized = target.replace(/^\.\//, '');
  const direct = join(packageDir, normalized);
  if (existsSync(direct)) return direct;

  for (const candidate of sourceFallbacks(packageDir, normalized)) {
    if (existsSync(candidate)) return candidate;
  }

  return direct;
}

function sourceFallbacks(packageDir: string, normalized: string): string[] {
  const withoutJs = normalized.endsWith('.js') ? normalized.slice(0, -'.js'.length) : normalized;
  const candidates: string[] = [];

  if (withoutJs.startsWith('dist/client/')) {
    const rest = withoutJs.slice('dist/client/'.length);
    candidates.push(join(packageDir, 'client', `${rest}.ts`));
    candidates.push(join(packageDir, 'client', `${rest}.tsx`));
    candidates.push(join(packageDir, 'src', 'client', `${rest}.ts`));
    candidates.push(join(packageDir, 'src', 'client', `${rest}.tsx`));
  }

  if (withoutJs.startsWith('dist/')) {
    const rest = withoutJs.slice('dist/'.length);
    candidates.push(join(packageDir, 'src', `${rest}.ts`));
    candidates.push(join(packageDir, 'src', `${rest}.tsx`));
  }

  return candidates;
}

function exportTargetForSubpath(exportsField: unknown, subpath: string): string | undefined {
  if (typeof exportsField === 'string' && subpath === '.') return exportsField;
  if (typeof exportsField !== 'object' || exportsField === null) return undefined;
  const exportsMap = exportsField as Record<string, unknown>;
  const value = exportsMap[subpath];
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const conditionMap = value as Record<string, unknown>;
    if (typeof conditionMap.import === 'string') return conditionMap.import;
    if (typeof conditionMap.default === 'string') return conditionMap.default;
  }
  return undefined;
}

function findWorkspaceRoot(): string {
  for (const start of [process.cwd(), dirname(fileURLToPath(import.meta.url))]) {
    let current = start;
    while (true) {
      if (
        (existsSync(join(current, 'packages', 'runtime', 'ui-runtime', 'package.json')) ||
          existsSync(join(current, 'packages', 'ui-runtime', 'package.json'))) &&
        existsSync(join(current, 'modules'))
      ) {
        return current;
      }
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return process.cwd();
}

export function readUiRuntimeCss(workspaceRoot: string): string {
  for (const cssPath of [
    join(workspaceRoot, 'packages', 'runtime', 'ui-runtime', 'build', 'main.css'),
    join(workspaceRoot, 'packages', 'ui-runtime', 'build', 'main.css'),
  ]) {
    if (existsSync(cssPath)) return readFileSync(cssPath, 'utf8');
  }
  return '/* rntme ui runtime styles unavailable at deploy bundle time */\n';
}

function serviceHostsUiRoute(project: ComposedBlueprint['project'], serviceSlug: string): boolean {
  return Object.values(project.routes?.ui ?? {}).includes(serviceSlug);
}

function addDefaultUiFiles(files: Record<string, string>, serviceSlug: string): void {
  const title = serviceSlug
    .split(/[^A-Za-z0-9]+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ') || 'Service';
  addJsonFile(files, 'ui/manifest.json', {
    version: '2.0',
    pdmRef: `${serviceSlug}.domain.v1`,
    qsmRef: `${serviceSlug}.read.v1`,
    graphSpecRef: `${serviceSlug}.graphs.v1`,
    bindingsRef: `${serviceSlug}.bindings.v1`,
    metadata: { title },
    layouts: { main: 'layouts/main' },
    routes: {
      '/': {
        layout: 'main',
        screen: 'screens/home',
      },
    },
  });
  addJsonFile(files, 'ui/layouts/main.screen.json', {});
  addJsonFile(files, 'ui/layouts/main.spec.json', {
    root: 'shell',
    elements: {
      shell: {
        type: 'Stack',
        props: { direction: 'vertical' },
        children: ['header'],
      },
      header: {
        type: 'Heading',
        props: { level: 1, text: title },
      },
    },
  });
  addJsonFile(files, 'ui/screens/home.screen.json', {
    metadata: { title },
  });
  addJsonFile(files, 'ui/screens/home.spec.json', {
    root: 'page',
    elements: {
      page: {
        type: 'Heading',
        props: { level: 1, text: title },
        children: [],
      },
    },
  });
}

async function addOptionalDirectoryFiles(
  files: Record<string, string>,
  rootDir: string,
  sourceRel: string,
  targetRel: string,
): Promise<boolean> {
  const sourceRoot = join(rootDir, sourceRel);
  try {
    await addDirectoryFilesFrom(files, sourceRoot, sourceRoot, targetRel);
    return true;
  } catch (cause) {
    if (errorCode(cause) === 'ENOENT') return false;
    throw cause;
  }
}

async function addDirectoryFilesFrom(
  files: Record<string, string>,
  sourceRoot: string,
  currentDir: string,
  targetRel: string,
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await addDirectoryFilesFrom(files, sourceRoot, sourcePath, targetRel);
      continue;
    }
    if (entry.isFile()) {
      files[join(targetRel, relative(sourceRoot, sourcePath))] = await readFile(sourcePath, 'utf8');
    }
  }
}

async function addOptionalTextFile(
  files: Record<string, string>,
  rootDir: string,
  sourceRel: string,
  targetRel: string,
): Promise<void> {
  try {
    files[targetRel] = await readFile(join(rootDir, sourceRel), 'utf8');
  } catch (cause) {
    if (errorCode(cause) === 'ENOENT') return;
    throw cause;
  }
}

async function addUiModuleAssetFiles(
  files: Record<string, string>,
  project: ComposedBlueprint,
): Promise<void> {
  if (project.uiAssetManifest !== null && project.uiAssetManifest !== undefined) {
    addJsonFile(files, 'ui-assets.json', project.uiAssetManifest);
  }
  for (const source of project.uiAssetSources ?? []) {
    files[source.runtimePath] = readFileSync(source.sourcePath, 'utf8');
  }
}

function addJsonFile(files: Record<string, string>, targetRel: string, value: unknown): void {
  files[targetRel] = `${JSON.stringify(value, null, 2)}\n`;
}

function errorCode(cause: unknown): string | undefined {
  if (typeof cause !== 'object' || cause === null || !('code' in cause)) return undefined;
  const code = (cause as { readonly code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function isComposedBlueprint(value: LoadedDeployProject): value is ComposedBlueprint {
  return (
    typeof value === 'object' &&
    value !== null &&
    'project' in value &&
    'pdm' in value &&
    'routing' in value &&
    'bindingRegistry' in value
  );
}
