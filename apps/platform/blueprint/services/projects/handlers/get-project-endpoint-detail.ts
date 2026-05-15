import { Buffer } from 'node:buffer';
import {
  isOk,
  parseCanonicalBundle,
  type PlatformError,
} from '@rntme/platform-core';
import type {
  GetProjectEndpointDetailHandlerInput,
  GetProjectEndpointDetailHandlerOutput,
  ProjectEndpointDetail,
  ProjectEndpointParameter,
  ProjectEndpointRequestSchema,
  ProjectEndpointResponseSchema,
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

/**
 * Native handler for GET /api/projects/{projectId}/endpoints/{service}/{operation}.
 *
 * Runtime-native read: resolves the project, locates the latest published
 * bundle, and walks `services/<service>/bindings/bindings.json` for the named
 * operation. Builds a single `ProjectEndpointDetail` row that carries the
 * fields the API explorer Overview pane populates today (auth, source artifact,
 * handler reference, request/response schema names) plus a `rawBinding` JSON
 * dump for the Raw tab.
 *
 * Fields with no source artifact in the bundle (`summary`, `response.example`,
 * `response.successStatus`, `response.errors`, per-field `description`) ship
 * pinned constants so the UI's "Not yet exposed by handler" placeholders stay
 * accurate; this handler must not invent values for them.
 *
 * Response schema lookup: the graph file's `signature.output.type` is parsed
 * for the single supported wrapper `row<X>` or a bare identifier `X`. When `X`
 * is a key in the per-service `graphs/shapes.json`, its `fields` map populates
 * `response.fields`. Any other wrapper (`rowset<...>`, `Map<...>`, etc.) is
 * recorded as not-yet-exposed (`schemaName: null`, `fields: []`) — see the
 * Slice B1 stop_if rules.
 */
export function getProjectEndpointDetailHandler(
  input: GetProjectEndpointDetailHandlerInput,
  ctx: RuntimeCtx,
): GetProjectEndpointDetailHandlerOutput {
  if (input.sessionStatus !== 'ACTIVE' || typeof input.sessionSubject !== 'string') {
    return error('PLATFORM_AUTH_INVALID', 'active edge session is required');
  }
  if (!isRuntimeCtx(ctx)) {
    return error('PLATFORM_INTERNAL', 'runtime project storage is not available');
  }
  if (typeof input.service !== 'string' || input.service.length === 0) {
    return error('PLATFORM_PARSE_PATH_INVALID', 'service is required');
  }
  if (typeof input.operation !== 'string' || input.operation.length === 0) {
    return error('PLATFORM_PARSE_PATH_INVALID', 'operation is required');
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
    return error(
      'PROJECT_VERSION_NOT_FOUND',
      `project has no published version; endpoint "${input.service}/${input.operation}" is unavailable`,
    );
  }

  const bundleRow = ctx.qsmDb.prepare<[string], ProjectVersionBundleRow>(`
    SELECT bundle_bytes
    FROM project_version_bundles
    WHERE version_id = ?
    LIMIT 1
  `).get(latest.id);
  if (bundleRow === undefined) {
    return error(
      'PROJECT_VERSION_NOT_FOUND',
      `published version has no stored bundle; endpoint "${input.service}/${input.operation}" is unavailable`,
    );
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

  const files = parsed.value.bundle.files;
  const bindingsPath = `services/${input.service}/bindings/bindings.json`;
  const bindingsFile = files[bindingsPath];
  if (!isRecord(bindingsFile)) {
    return error(
      'PROJECT_VERSION_BUNDLE_INVALID_SHAPE',
      `service "${input.service}" is not present in the published bundle`,
    );
  }
  const bindings = bindingsFile.bindings;
  if (!isRecord(bindings)) {
    return error(
      'PROJECT_VERSION_BUNDLE_INVALID_SHAPE',
      `service "${input.service}" has no bindings declared`,
    );
  }
  const entry = bindings[input.operation];
  if (!isRecord(entry)) {
    return error(
      'PROJECT_VERSION_BUNDLE_INVALID_SHAPE',
      `operation "${input.operation}" is not declared in service "${input.service}"`,
    );
  }

  const detail = buildEndpointDetail(input.service, input.operation, entry, files, bindingsPath);
  return { status: 'ok', detail };
}

function buildEndpointDetail(
  service: string,
  operation: string,
  entry: Record<string, unknown>,
  files: Readonly<Record<string, unknown>>,
  bindingsPath: string,
): ProjectEndpointDetail {
  const http = isRecord(entry.http) ? entry.http : {};
  const method = stringValue(http.method) ?? '';
  const httpPath = stringValue(http.path) ?? '';
  const target = isRecord(entry.target) ? entry.target : {};
  const engine = stringValue(target.engine) ?? '';
  const dialect = stringValue(target.dialect) ?? '';
  const graph = stringValue(entry.graph) ?? null;

  const inputFrom = isRecord(entry.inputFrom) ? entry.inputFrom : {};
  const authorization = isRecord(inputFrom.authorization) ? inputFrom.authorization : null;
  const auth: 'required' | 'public' = authorization?.required === true ? 'required' : 'public';

  const parameters = Array.isArray(http.parameters) ? http.parameters : [];
  const pathParams: ProjectEndpointParameter[] = [];
  const queryParams: ProjectEndpointParameter[] = [];
  const bodyParams: ProjectEndpointParameter[] = [];
  for (const raw of parameters) {
    if (!isRecord(raw)) continue;
    const name = stringValue(raw.name);
    const slot = stringValue(raw.in);
    if (name === undefined) continue;
    const required = raw.required === true;
    const param: ProjectEndpointParameter = { name, in: 'query', required, description: null };
    if (slot === 'path') {
      pathParams.push({ ...param, in: 'path' });
    } else if (slot === 'body') {
      bodyParams.push({ ...param, in: 'body' });
    } else {
      // Default any unknown / `query` slot to query params, matching the
      // bindings runtime's behaviour for unannotated declarations.
      queryParams.push(param);
    }
  }

  const graphFile =
    graph !== null && graph.length > 0
      ? files[`services/${service}/graphs/${graph}.json`]
      : undefined;
  const shapesFile = files[`services/${service}/graphs/shapes.json`];
  const shapes = isRecord(shapesFile) ? shapesFile : {};

  const responseSchemaName = extractResponseSchemaName(graphFile);
  const responseFields = responseSchemaName === null
    ? []
    : extractShapeFields(shapes, responseSchemaName);

  const request: ProjectEndpointRequestSchema = {
    pathParams,
    queryParams,
    body: bodyParams.length === 0
      ? null
      : { schemaName: extractRequestBodySchemaName(graphFile, bodyParams, shapes), fields: bodyParams },
  };

  const response: ProjectEndpointResponseSchema = {
    successStatus: null,
    schemaName: responseSchemaName,
    fields: responseFields,
    example: null,
    errors: [],
  };

  return {
    service,
    operation,
    method,
    path: httpPath,
    summary: null,
    auth,
    sourceArtifact: { file: bindingsPath, key: operation },
    handler: { engine, dialect, graph },
    request,
    response,
    examples: buildExamples(method, httpPath, parameters),
    rawBinding: entry,
  };
}

/**
 * Returns the bare type name from a graph `signature.output.type` of the form
 * `row<X>` or `X` (a bare identifier). Anything else (`rowset<...>`,
 * `Map<...,...>`, etc.) returns `null` so the UI can keep its "Not yet exposed
 * by handler" placeholder rather than invent a generic-type parser.
 */
function extractResponseSchemaName(graphFile: unknown): string | null {
  if (!isRecord(graphFile)) return null;
  const signature = isRecord(graphFile.signature) ? graphFile.signature : {};
  const output = isRecord(signature.output) ? signature.output : {};
  const type = stringValue(output.type);
  if (type === undefined) return null;
  const rowMatch = /^row<([A-Za-z_][A-Za-z0-9_]*)>$/.exec(type);
  if (rowMatch !== null) return rowMatch[1] ?? null;
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(type)) return type;
  return null;
}

/**
 * Body schema name lookup: the graph's `signature.inputs` is an object keyed by
 * parameter name, with each value carrying `{ type, mode }`. The body schema
 * name is reported only when every body parameter shares a single non-primitive
 * type that is also a key in `shapes.json` — typical handler-style graphs use
 * primitive inputs, so this is `null` for now in line with the Slice B1 stop
 * conditions.
 */
function extractRequestBodySchemaName(
  graphFile: unknown,
  bodyParams: readonly ProjectEndpointParameter[],
  shapes: Readonly<Record<string, unknown>>,
): string | null {
  if (!isRecord(graphFile) || bodyParams.length === 0) return null;
  const signature = isRecord(graphFile.signature) ? graphFile.signature : {};
  const inputs = isRecord(signature.inputs) ? signature.inputs : {};
  const types = new Set<string>();
  for (const param of bodyParams) {
    const inputDecl = inputs[param.name];
    if (!isRecord(inputDecl)) continue;
    const type = stringValue(inputDecl.type);
    if (type === undefined) continue;
    types.add(type);
  }
  if (types.size !== 1) return null;
  const onlyType = Array.from(types)[0]!;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(onlyType)) return null;
  if (!isRecord(shapes[onlyType])) return null;
  return onlyType;
}

function extractShapeFields(
  shapes: Readonly<Record<string, unknown>>,
  schemaName: string,
): ProjectEndpointParameter[] {
  const shape = isRecord(shapes[schemaName]) ? shapes[schemaName] : null;
  if (shape === null) return [];
  const fields = isRecord(shape.fields) ? shape.fields : null;
  if (fields === null) return [];
  return Object.keys(fields).map((name) => {
    const decl = isRecord(fields[name]) ? fields[name] : {};
    const nullable = decl.nullable === true;
    return {
      name,
      in: 'body' as const,
      required: !nullable,
      description: null,
    };
  });
}

function buildExamples(
  method: string,
  path: string,
  parameters: readonly unknown[],
): { readonly curl: string; readonly fetch: string; readonly openapi: string } {
  const fullPath = `https://api.rntme.com/api/projects/<projectId>${path.startsWith('/') ? path : `/${path}`}`;
  const curl = `curl -X ${method || 'GET'} "${fullPath}"`;
  const fetchSnippet = `await fetch("${fullPath}", { method: "${method || 'GET'}" });`;
  const openapi = JSON.stringify(
    {
      [`/api/projects/<projectId>${path.startsWith('/') ? path : `/${path}`}`]: {
        [(method || 'get').toLowerCase()]: {
          parameters,
        },
      },
    },
    null,
    2,
  );
  return { curl, fetch: fetchSnippet, openapi };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRuntimeCtx(value: unknown): value is RuntimeCtx {
  return value !== null
    && typeof value === 'object'
    && typeof (value as { qsmDb?: { prepare?: unknown } }).qsmDb?.prepare === 'function';
}

function error(code: PlatformError['code'], message: string): GetProjectEndpointDetailHandlerOutput {
  return { status: 'error', errors: [{ code, message }] };
}
