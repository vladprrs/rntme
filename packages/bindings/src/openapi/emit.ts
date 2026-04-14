import type { ResolvedBinding, ValidatedBindings } from '../types/artifact.js';
import type { BindingResolvers } from '../types/resolvers.js';
import type {
  InfoObject,
  OpenApiDoc,
  OperationObject,
  ParameterObject,
  PathItem,
  ResponseObject,
  ServerObject,
  JsonSchema,
} from '../types/openapi.js';
import type { Result } from '../types/result.js';
import { ok } from '../types/result.js';
import { shapeToJsonSchema, type ShapeEmitOptions } from './shapes.js';
import { collectRequestBody, inputToParameter } from './parameters.js';
import { COMMAND_RESULT_SHAPE_NAME, commandResultJsonSchema } from './command-result.js';
import { successResponse } from './responses.js';
import {
  ERROR_RESPONSE_SCHEMA_NAME,
  errorResponseSchema,
  standardErrorResponses,
} from './errors.js';
import { deepMerge } from './passthrough.js';

export type OpenApiGenOptions = {
  decimalEncoding?: 'string' | 'number';
  standardErrors?: false;
  info?: { title?: string; version?: string; description?: string };
  servers?: ServerObject[];
};

const DEFAULT_INFO: InfoObject = { title: 'API', version: '0.0.0' };

function resolveInfo(artifact: ValidatedBindings['artifact'], options: OpenApiGenOptions): InfoObject {
  const artifactInfo = artifact.openapi?.info;
  const optInfo = options.info;
  const title = artifactInfo?.title ?? optInfo?.title ?? DEFAULT_INFO.title;
  const version = artifactInfo?.version ?? optInfo?.version ?? DEFAULT_INFO.version;
  const description = artifactInfo?.description ?? optInfo?.description;
  const result: InfoObject = { title, version };
  if (description !== undefined) result.description = description;
  return result;
}

function resolveServers(
  artifact: ValidatedBindings['artifact'],
  options: OpenApiGenOptions,
): ServerObject[] | undefined {
  return artifact.openapi?.servers ?? options.servers;
}

function buildOperation(
  id: string,
  binding: ResolvedBinding,
  shapeOptions: ShapeEmitOptions,
  includeStandardErrors: boolean,
): OperationObject {
  const { entry, signature, outputShape } = binding;
  const { http } = entry;
  const kind = entry.kind ?? 'query';
  const outputKind: 'row' | 'rowset' =
    signature.output.type.kind === 'row' ? 'row' : 'rowset';

  const baseParameters: ParameterObject[] = http.parameters
    .filter((p) => p.in !== 'body')
    .map((p) => {
      const input = signature.inputs[p.bindTo];
      if (input === undefined) {
        // Unreachable after validateReferences emits BINDINGS_UNKNOWN_BIND_TO.
        // Spec §7 reserves BINDINGS_INTERNAL; throw here keeps the hot path total.
        throw new Error(
          `Internal invariant: parameter "${p.name}" in binding "${id}" resolved past validation with unknown bindTo`,
        );
      }
      const base = inputToParameter(p, input, shapeOptions);
      if (p.openapi !== undefined) {
        return deepMerge(base as unknown as Record<string, unknown>, p.openapi) as unknown as ParameterObject;
      }
      return base;
    });

  const requestBody = collectRequestBody(http.parameters, signature.inputs, shapeOptions);

  const responses: Record<string, ResponseObject> = {
    '200': successResponse(outputShape.name, outputKind),
  };
  if (includeStandardErrors) {
    Object.assign(responses, standardErrorResponses({ commandErrors: kind === 'command' }));
  }

  const operation: OperationObject = {
    operationId: http.operationId ?? id,
    responses,
  };
  if (http.summary !== undefined) operation.summary = http.summary;
  if (http.description !== undefined) operation.description = http.description;
  if (http.tags !== undefined) operation.tags = http.tags;
  if (baseParameters.length > 0) operation.parameters = baseParameters;
  if (requestBody !== undefined) operation.requestBody = requestBody;

  if (http.openapi !== undefined) {
    return deepMerge(operation as unknown as Record<string, unknown>, http.openapi) as unknown as OperationObject;
  }
  return operation;
}

export function generateOpenApi(
  validated: ValidatedBindings,
  _resolvers: BindingResolvers,
  options: OpenApiGenOptions = {},
): Result<OpenApiDoc> {
  const shapeOptions: ShapeEmitOptions = {
    decimalEncoding: options.decimalEncoding ?? 'string',
  };
  const includeStandardErrors = options.standardErrors !== false;

  const paths: Record<string, PathItem> = {};
  const schemas: Record<string, JsonSchema> = {};

  for (const [id, binding] of Object.entries(validated.resolved)) {
    const methodKey = binding.entry.http.method === 'GET' ? 'get' : 'post';
    const op = buildOperation(id, binding, shapeOptions, includeStandardErrors);
    const pathItem: PathItem = paths[binding.entry.http.path] ?? {};
    pathItem[methodKey] = op;
    paths[binding.entry.http.path] = pathItem;

    if ((binding.entry.kind ?? 'query') === 'command') {
      schemas[COMMAND_RESULT_SHAPE_NAME] = commandResultJsonSchema();
    } else {
      schemas[binding.outputShape.name] = shapeToJsonSchema(binding.outputShape, shapeOptions);
    }
  }

  if (includeStandardErrors) {
    schemas[ERROR_RESPONSE_SCHEMA_NAME] = errorResponseSchema();
  }

  const doc: OpenApiDoc = {
    openapi: '3.1.0',
    info: resolveInfo(validated.artifact, options),
    paths,
    components: { schemas },
  };
  const servers = resolveServers(validated.artifact, options);
  if (servers !== undefined) doc.servers = servers;

  return ok(doc);
}
