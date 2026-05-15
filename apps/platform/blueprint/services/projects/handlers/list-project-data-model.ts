import { Buffer } from 'node:buffer';
import {
  isOk,
  parseCanonicalBundle,
  type PlatformError,
} from '@rntme/platform-core';
import type {
  ListProjectDataModelHandlerInput,
  ListProjectDataModelHandlerOutput,
  ProjectDataModel,
  ProjectDataModelEndpoint,
  ProjectDataModelEntity,
  ProjectDataModelField,
  ProjectDataModelProjection,
  ProjectDataModelProjectionField,
  ProjectDataModelRelation,
  ProjectDataModelRelationship,
  ProjectDataModelStateMachine,
} from './types.js';

type RuntimeCtx = {
  readonly qsmDb: {
    readonly prepare: <P = unknown, R = unknown>(sql: string) => {
      readonly get: (...args: unknown[]) => R | undefined;
    };
  };
};

type ProjectRow = {
  readonly id: string;
  readonly organization_id: string;
  readonly slug: string;
  readonly status: string;
};

type ProjectVersionRow = {
  readonly id: string;
};

type ProjectVersionBundleRow = {
  readonly bundle_bytes: Uint8Array;
};

type EntityDraft = {
  readonly name: string;
  readonly path: string;
  readonly raw: Record<string, unknown>;
  readonly ownerService: string;
  readonly kind: string;
  readonly table: string;
  readonly keys: readonly string[];
  readonly fieldsRaw: Record<string, unknown>;
  readonly relationsRaw: Record<string, unknown>;
  readonly stateMachine?: ProjectDataModelStateMachine;
};

const EMPTY_DATA_MODEL: ProjectDataModel = {
  summary: {
    entities: 0,
    fields: 0,
    relationships: 0,
    qsmProjections: 0,
    warnings: 0,
    errors: 0,
  },
  entities: [],
  qsmProjections: [],
  relationships: [],
  findings: [],
};

/**
 * Native handler for GET /api/projects/{projectId}/data-model.
 *
 * Reads the latest published canonical bundle and derives a definition
 * inspection model for PDM entities and QSM projections. The model is derived
 * only from bundle artifacts; validation findings remain empty until the
 * platform persists a real validation-report artifact.
 */
export function listProjectDataModelHandler(
  input: ListProjectDataModelHandlerInput,
  ctx: RuntimeCtx,
): ListProjectDataModelHandlerOutput {
  if (input.sessionStatus !== 'ACTIVE' || typeof input.sessionSubject !== 'string') {
    return error('PLATFORM_AUTH_INVALID', 'active edge session is required');
  }
  if (!isRuntimeCtx(ctx)) {
    return error('PLATFORM_INTERNAL', 'runtime project storage is not available');
  }

  const project = resolveRuntimeProject(ctx, input.projectId);
  if (project === null) {
    return error('PLATFORM_TENANCY_PROJECT_NOT_FOUND', input.projectId);
  }

  const latest = ctx.qsmDb.prepare<[string], ProjectVersionRow>(`
    SELECT id
    FROM project_versions
    WHERE project_id = ?
    ORDER BY sequence DESC
    LIMIT 1
  `).get(project.id);
  if (latest === undefined) {
    return { status: 'ok', dataModel: EMPTY_DATA_MODEL };
  }

  const bundleRow = ctx.qsmDb.prepare<[string], ProjectVersionBundleRow>(`
    SELECT bundle_bytes
    FROM project_version_bundles
    WHERE version_id = ?
    LIMIT 1
  `).get(latest.id);
  if (bundleRow === undefined) {
    return { status: 'ok', dataModel: EMPTY_DATA_MODEL };
  }

  const bytes = Buffer.from(
    bundleRow.bundle_bytes.buffer,
    bundleRow.bundle_bytes.byteOffset,
    bundleRow.bundle_bytes.byteLength,
  );
  const parsed = parseCanonicalBundle(bytes);
  if (!isOk(parsed)) {
    return { status: 'error', errors: parsed.errors };
  }

  return { status: 'ok', dataModel: buildDataModel(parsed.value.bundle.files) };
}

function buildDataModel(files: Readonly<Record<string, unknown>>): ProjectDataModel {
  const entityDrafts = collectEntityDrafts(files);
  const entityMap = new Map(entityDrafts.map((entity) => [entity.name, entity]));
  const endpointByGraph = collectEndpoints(files);
  const graphRefsByProjection = collectGraphRefs(files);
  const projections = collectQsmProjections(files, entityMap, endpointByGraph, graphRefsByProjection);
  const projectionsByEntity = groupProjectionsByEntity(projections);
  const endpointsByEntity = groupEndpointsByEntity(projections);
  const entities = entityDrafts.map((entity) =>
    buildEntity(entity, entityMap, projectionsByEntity, endpointsByEntity),
  );
  const relationships = entities.flatMap((entity) =>
    entity.relations.map((relation) => ({
      source: entity.name,
      name: relation.name,
      target: relation.target,
      cardinality: relation.cardinality,
      localKey: relation.localKey,
      foreignKey: relation.foreignKey,
      path: entity.path,
      missingTarget: relation.missingTarget,
    })),
  );
  return {
    summary: {
      entities: entities.length,
      fields: entities.reduce((sum, entity) => sum + entity.fields.length, 0),
      relationships: relationships.length,
      qsmProjections: projections.length,
      warnings: 0,
      errors: 0,
    },
    entities,
    qsmProjections: projections,
    relationships,
    findings: [],
  };
}

function collectEntityDrafts(files: Readonly<Record<string, unknown>>): EntityDraft[] {
  const entities: EntityDraft[] = [];
  for (const [path, raw] of Object.entries(files)) {
    if (!path.startsWith('pdm/entities/') || !path.endsWith('.json') || !isRecord(raw)) continue;
    const name = artifactName(path);
    const stateMachine = stateMachineFromRaw(raw.stateMachine);
    entities.push({
      name,
      path,
      raw,
      ownerService: stringValue(raw.ownerService) ?? 'project',
      kind: stringValue(raw.kind) ?? 'owned',
      table: stringValue(raw.table) ?? '',
      keys: stringArray(raw.keys),
      fieldsRaw: isRecord(raw.fields) ? raw.fields : {},
      relationsRaw: isRecord(raw.relations) ? raw.relations : {},
      ...(stateMachine === undefined ? {} : { stateMachine }),
    });
  }
  return entities.sort((a, b) => a.name.localeCompare(b.name));
}

function collectQsmProjections(
  files: Readonly<Record<string, unknown>>,
  entityMap: ReadonlyMap<string, EntityDraft>,
  endpointByGraph: ReadonlyMap<string, readonly ProjectDataModelEndpoint[]>,
  graphRefsByProjection: ReadonlyMap<string, ReadonlySet<string>>,
): ProjectDataModelProjection[] {
  const projections: ProjectDataModelProjection[] = [];
  for (const [path, raw] of Object.entries(files)) {
    const match = /^services\/([^/]+)\/qsm\/projections\/([^/]+)\.json$/.exec(path);
    if (match === null || !isRecord(raw)) continue;
    const service = match[1]!;
    const name = match[2]!;
    const source = isRecord(raw.source) ? raw.source : {};
    const sourceEntity = stringValue(source.entity) ?? '';
    const entity = sourceEntity.length > 0 ? entityMap.get(sourceEntity) : undefined;
    const exposed = stringArray(raw.exposed);
    const graphRefs = graphRefsByProjection.get(name) ?? new Set<string>();
    const endpoints = uniqueEndpoints(
      Array.from(graphRefs).flatMap((graph) => endpointByGraph.get(graph) ?? []),
    );
    const table = stringValue(raw.table);
    const projection: ProjectDataModelProjection = {
      name,
      service,
      path,
      backing: stringValue(raw.backing) ?? 'entity-mirror',
      sourceEntity,
      keys: stringArray(raw.keys),
      grain: stringArray(raw.grain),
      exposed,
      ...(table === undefined ? {} : { table }),
      fields: exposed.map((field) => projectionField(sourceEntity, field, entity)),
      endpoints,
      raw,
    };
    projections.push(projection);
  }
  return projections.sort((a, b) =>
    a.service !== b.service ? a.service.localeCompare(b.service) : a.name.localeCompare(b.name),
  );
}

function projectionField(
  entityName: string,
  fieldName: string,
  entity: EntityDraft | undefined,
): ProjectDataModelProjectionField {
  const field = isRecord(entity?.fieldsRaw[fieldName]) ? entity.fieldsRaw[fieldName] : {};
  return {
    name: fieldName,
    type: stringValue(field.type) ?? '',
    source: entityName.length > 0 ? `${entityName}.${fieldName}` : fieldName,
    nullable: booleanValue(field.nullable) ?? true,
    computed: false,
  };
}

function buildEntity(
  entity: EntityDraft,
  entityMap: ReadonlyMap<string, EntityDraft>,
  projectionsByEntity: ReadonlyMap<string, readonly ProjectDataModelProjection[]>,
  endpointsByEntity: ReadonlyMap<string, readonly ProjectDataModelEndpoint[]>,
): ProjectDataModelEntity {
  const entityProjections = projectionsByEntity.get(entity.name) ?? [];
  const qsmProjections = entityProjections.map((projection) => projection.name);
  const fields = Object.entries(entity.fieldsRaw).map(([name, raw]) =>
    buildField(name, raw, entity, entityProjections),
  );
  const relations = Object.entries(entity.relationsRaw)
    .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
    .map(([name, raw]) => buildRelation(name, raw, entityMap));
  return {
    name: entity.name,
    ownerService: entity.ownerService,
    kind: entity.kind,
    table: entity.table,
    path: entity.path,
    keys: entity.keys,
    fields,
    relations,
    ...(entity.stateMachine === undefined ? {} : { stateMachine: entity.stateMachine }),
    qsmProjections,
    endpoints: endpointsByEntity.get(entity.name) ?? [],
    raw: entity.raw,
  };
}

function buildField(
  name: string,
  raw: unknown,
  entity: EntityDraft,
  projectionsForEntity: readonly ProjectDataModelProjection[],
): ProjectDataModelField {
  const field = isRecord(raw) ? raw : {};
  const generated = stringValue(field.generated);
  return {
    name,
    type: stringValue(field.type) ?? '',
    nullable: booleanValue(field.nullable) ?? true,
    column: stringValue(field.column) ?? name,
    ...(generated === undefined ? {} : { generated }),
    primaryKey: entity.keys.includes(name),
    stateField: entity.stateMachine?.stateField === name,
    qsmProjections: projectionsForEntity.filter((projection) =>
      projection.exposed.includes(name),
    ).map((projection) => projection.name),
  };
}

function buildRelation(
  name: string,
  raw: Record<string, unknown>,
  entityMap: ReadonlyMap<string, EntityDraft>,
): ProjectDataModelRelation {
  const target = stringValue(raw.to) ?? '';
  return {
    name,
    target,
    cardinality: stringValue(raw.cardinality) ?? '',
    localKey: stringValue(raw.localKey) ?? '',
    foreignKey: stringValue(raw.foreignKey) ?? '',
    missingTarget: target.length > 0 && !entityMap.has(target),
  };
}

function groupProjectionsByEntity(
  projections: readonly ProjectDataModelProjection[],
): Map<string, readonly ProjectDataModelProjection[]> {
  const grouped = new Map<string, ProjectDataModelProjection[]>();
  for (const projection of projections) {
    if (projection.sourceEntity.length === 0) continue;
    const list = grouped.get(projection.sourceEntity) ?? [];
    list.push(projection);
    grouped.set(projection.sourceEntity, list);
  }
  return grouped;
}

function groupEndpointsByEntity(
  projections: readonly ProjectDataModelProjection[],
): Map<string, readonly ProjectDataModelEndpoint[]> {
  const grouped = new Map<string, ProjectDataModelEndpoint[]>();
  for (const projection of projections) {
    if (projection.sourceEntity.length === 0) continue;
    const list = grouped.get(projection.sourceEntity) ?? [];
    list.push(...projection.endpoints);
    grouped.set(projection.sourceEntity, uniqueEndpoints(list));
  }
  return grouped;
}

function collectEndpoints(files: Readonly<Record<string, unknown>>): Map<string, readonly ProjectDataModelEndpoint[]> {
  const endpointsByGraph = new Map<string, ProjectDataModelEndpoint[]>();
  for (const [path, raw] of Object.entries(files)) {
    if (!path.endsWith('/bindings/bindings.json') || !isRecord(raw) || !isRecord(raw.bindings)) continue;
    const service = serviceNameFromPath(path);
    for (const [operation, entry] of Object.entries(raw.bindings)) {
      if (!isRecord(entry) || !isRecord(entry.http)) continue;
      const graph = stringValue(entry.graph);
      const method = stringValue(entry.http.method);
      const endpointPath = stringValue(entry.http.path);
      if (graph === undefined || method === undefined || endpointPath === undefined) continue;
      const list = endpointsByGraph.get(graph) ?? [];
      list.push({ service, operation, method, path: endpointPath, graph });
      endpointsByGraph.set(graph, list);
    }
  }
  return endpointsByGraph;
}

function collectGraphRefs(files: Readonly<Record<string, unknown>>): Map<string, Set<string>> {
  const refsByProjection = new Map<string, Set<string>>();
  for (const [path, raw] of Object.entries(files)) {
    const match = /^services\/[^/]+\/graphs\/([^/]+)\.json$/.exec(path);
    if (match === null || match[1] === 'shapes') continue;
    const graph = match[1]!;
    for (const projection of projectionRefs(raw)) {
      const refs = refsByProjection.get(projection) ?? new Set<string>();
      refs.add(graph);
      refsByProjection.set(projection, refs);
    }
  }
  return refsByProjection;
}

function projectionRefs(value: unknown): string[] {
  const refs: string[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isRecord(node)) return;
    const config = isRecord(node.config) ? node.config : {};
    const source = isRecord(config.source) ? config.source : {};
    const projection = stringValue(source.projection);
    if (node.type === 'findMany' && projection !== undefined) refs.push(projection);
    for (const child of Object.values(node)) visit(child);
  };
  visit(value);
  return Array.from(new Set(refs));
}

function stateMachineFromRaw(value: unknown): ProjectDataModelStateMachine | undefined {
  if (!isRecord(value)) return undefined;
  const stateField = stringValue(value.stateField);
  const transitions = isRecord(value.transitions) ? Object.keys(value.transitions) : [];
  if (stateField === undefined && transitions.length === 0 && !Array.isArray(value.states)) return undefined;
  return {
    stateField: stateField ?? '',
    states: stringArray(value.states),
    transitions,
  };
}

function uniqueEndpoints(endpoints: readonly ProjectDataModelEndpoint[]): ProjectDataModelEndpoint[] {
  const seen = new Set<string>();
  const out: ProjectDataModelEndpoint[] = [];
  for (const endpoint of endpoints) {
    const key = `${endpoint.service}\0${endpoint.operation}\0${endpoint.method}\0${endpoint.path}\0${endpoint.graph}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(endpoint);
  }
  return out.sort((a, b) =>
    a.service !== b.service
      ? a.service.localeCompare(b.service)
      : a.operation.localeCompare(b.operation),
  );
}

function serviceNameFromPath(path: string): string {
  const segments = path.split('/');
  const service = segments[1];
  if (segments[0] === 'services' && service !== undefined && service.length > 0) {
    return service;
  }
  return path;
}

function artifactName(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  return base.endsWith('.json') ? base.slice(0, -'.json'.length) : base;
}

function resolveRuntimeProject(ctx: RuntimeCtx, projectIdOrSlug: string): ProjectRow | null {
  const byId = ctx.qsmDb.prepare<[string], ProjectRow>(`
    SELECT id, organization_id, slug, status
    FROM projects
    WHERE id = ?
    LIMIT 1
  `).get(projectIdOrSlug);
  if (byId !== undefined) return byId;

  return ctx.qsmDb.prepare<[string], ProjectRow>(`
    SELECT id, organization_id, slug, status
    FROM projects
    WHERE slug = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(projectIdOrSlug) ?? null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRuntimeCtx(value: unknown): value is RuntimeCtx {
  return value !== null
    && typeof value === 'object'
    && typeof (value as { qsmDb?: { prepare?: unknown } }).qsmDb?.prepare === 'function';
}

function error(code: PlatformError['code'], message: string): ListProjectDataModelHandlerOutput {
  return { status: 'error', errors: [{ code, message }] };
}
