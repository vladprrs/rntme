import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  parsePdm,
  validatePdm,
  createPdmResolver,
  deriveEventTypes,
  isErr,
  type ValidatedPdm,
  type PdmResolver,
} from '@rntme/pdm';
import {
  parseQsm,
  validateQsm,
  generateProjectionDdl,
  isErr as isQsmErr,
  type ValidatedQsm,
} from '@rntme/qsm';
import {
  parseBindingArtifact,
  validateBindings,
  generateOpenApi,
  type BindingResolvers,
  type GraphSignature,
  type InputType,
  type OutputType,
  type ResolvedShape,
  type ScalarPrimitive,
  type InputMode,
  type ValidatedBindings,
} from '@rntme/bindings';
import { compile, type CompiledArtifact } from '@rntme/ui';
import { compileApplyPlan } from '@rntme/projection-consumer';
import { loadSeed, type ValidatedSeed } from '@rntme/seed';
import { parseManifest } from '../manifest/parse.js';
import { validateManifest, applyEnvOverrides } from '../manifest/validate.js';
import type { GraphSpec, ServiceError, ValidatedService, RuntimeResult } from '../types.js';
import { readJsonFile, readTextFile, readGraphsDir } from './read-dir.js';
import { crossValidateDerivedProjections } from '../projections/cross-validate.js';
import {
  parseAuthoringSpec,
  type DerivedCompileResult,
  type DerivedTableSchema,
} from '@rntme/graph-ir-compiler';
import type { DerivedHandler } from '@rntme/projection-consumer';

// Manifest schema version accepted by this runtime. Bumped manually on
// breaking manifest schema changes — NOT tied to the npm package semver.
const RUNTIME_VERSION = { major: 1, minor: 0, patch: 0 };

type GraphJson = {
  id: string;
  signature: {
    inputs: Record<string, { type: string; mode: InputMode; default?: unknown }>;
    output: { type: string; from: string };
  };
  nodes: unknown[];
};

function parseInputType(raw: string): InputType {
  if (
    raw === 'integer' || raw === 'decimal' || raw === 'string' ||
    raw === 'boolean' || raw === 'date' || raw === 'datetime'
  ) {
    return { kind: 'scalar', primitive: raw };
  }
  const list = /^list<(\w+)>$/.exec(raw);
  if (list) {
    const element = list[1] as ScalarPrimitive;
    if (
      element === 'integer' || element === 'decimal' || element === 'string' ||
      element === 'boolean' || element === 'date' || element === 'datetime'
    ) {
      return { kind: 'list', element };
    }
  }
  const row = /^(rowset|row)<([A-Za-z_][A-Za-z0-9_]*)>$/.exec(raw);
  if (row) {
    return { kind: row[1] as 'rowset' | 'row', shape: row[2] as string };
  }
  throw new Error(`unsupported input type: "${raw}"`);
}

function parseOutputType(raw: string): OutputType {
  if (
    raw === 'integer' || raw === 'decimal' || raw === 'string' ||
    raw === 'boolean' || raw === 'date' || raw === 'datetime'
  ) {
    return { kind: 'scalar', primitive: raw };
  }
  const m = /^(rowset|row)<([A-Za-z_][A-Za-z0-9_]*)>$/.exec(raw);
  if (!m) throw new Error(`unsupported output type: "${raw}"`);
  return { kind: m[1] as 'rowset' | 'row', shape: m[2] as string };
}

function toGraphSignature(g: GraphJson): GraphSignature {
  const inputs: GraphSignature['inputs'] = {};
  for (const [name, decl] of Object.entries(g.signature.inputs)) {
    const base = { type: parseInputType(decl.type), mode: decl.mode };
    inputs[name] = decl.default !== undefined ? { ...base, default: decl.default } : base;
  }
  const hasEmit =
    Array.isArray(g.nodes) &&
    g.nodes.some(
      (n) =>
        typeof n === 'object' &&
        n !== null &&
        (n as { type?: string }).type === 'emit',
    );
  return {
    id: g.id,
    ...(hasEmit ? { role: 'command' as const } : {}),
    inputs,
    output: { type: parseOutputType(g.signature.output.type), from: g.signature.output.from },
  };
}

export function loadService(dir: string): RuntimeResult<ValidatedService, ServiceError[]> {
  // 1. Manifest
  let manifestText: string;
  try {
    manifestText = readTextFile(dir, 'manifest.json');
  } catch (e) {
    return {
      ok: false,
      errors: [{ code: 'IO_ERROR', details: { message: e instanceof Error ? e.message : String(e) } }],
    };
  }

  const parsedManifest = parseManifest(manifestText);
  if (!parsedManifest.ok) {
    return { ok: false, errors: [{ code: 'MANIFEST_INVALID', details: parsedManifest.errors }] };
  }
  const validatedManifest = validateManifest(parsedManifest.value, RUNTIME_VERSION);
  if (!validatedManifest.ok) {
    return { ok: false, errors: [{ code: 'MANIFEST_INVALID', details: validatedManifest.errors }] };
  }
  const envApplied = applyEnvOverrides(validatedManifest.value, process.env as Record<string, string | undefined>);
  if (!envApplied.ok) {
    return { ok: false, errors: [{ code: 'MANIFEST_INVALID', details: envApplied.errors }] };
  }
  const manifest = envApplied.value;

  // 2. PDM
  let validatedPdm: ValidatedPdm;
  let pdmResolver: PdmResolver;
  let rawPdm: unknown;
  try {
    rawPdm = readJsonFile(dir, 'pdm.json');
  } catch (e) {
    return { ok: false, errors: [{ code: 'IO_ERROR', details: { message: e instanceof Error ? e.message : String(e) } }] };
  }

  try {
    const pdmParsed = parsePdm(rawPdm);
    if (isErr(pdmParsed)) {
      return { ok: false, errors: [{ code: 'PDM_INVALID', details: pdmParsed.errors }] };
    }
    const v = validatePdm(pdmParsed.value);
    if (isErr(v)) {
      return { ok: false, errors: [{ code: 'PDM_INVALID', details: v.errors }] };
    }
    validatedPdm = v.value;
    pdmResolver = createPdmResolver(validatedPdm);
  } catch (e) {
    return { ok: false, errors: [{ code: 'PDM_INVALID', details: [{ message: e instanceof Error ? e.message : String(e) }] }] };
  }

  // 3. QSM
  let validatedQsm: ValidatedQsm;
  let rawQsm: unknown;
  try {
    rawQsm = readJsonFile(dir, 'qsm.json');
  } catch (e) {
    return { ok: false, errors: [{ code: 'IO_ERROR', details: { message: e instanceof Error ? e.message : String(e) } }] };
  }

  try {
    const qsmParsed = parseQsm(rawQsm);
    if (isQsmErr(qsmParsed)) {
      return { ok: false, errors: [{ code: 'QSM_INVALID', details: qsmParsed.errors }] };
    }
    const v = validateQsm(qsmParsed.value, pdmResolver);
    if (isQsmErr(v)) {
      return { ok: false, errors: [{ code: 'QSM_INVALID', details: v.errors }] };
    }
    validatedQsm = v.value;
  } catch (e) {
    return { ok: false, errors: [{ code: 'QSM_INVALID', details: [{ message: e instanceof Error ? e.message : String(e) }] }] };
  }

  const eventTypes = deriveEventTypes(validatedPdm);

  let validatedSeed: ValidatedSeed | null = null;
  const seedPath = join(dir, manifest.seed.path);
  if (manifest.seed.enabled && existsSync(seedPath)) {
    const seedResult = loadSeed(seedPath, {
      pdm: pdmResolver,
      events: eventTypes,
      serviceName: manifest.service.name,
    });
    if (!seedResult.ok) {
      return { ok: false, errors: [{ code: 'SEED_INVALID', details: seedResult.errors }] };
    }
    validatedSeed = seedResult.value;
  }

  // 4. Graphs + shapes
  let graphsById: Record<string, GraphJson>;
  let shapes: GraphSpec['shapes'];
  try {
    graphsById = readGraphsDir(dir) as Record<string, GraphJson>;
    shapes = readJsonFile<GraphSpec['shapes']>(dir, 'shapes.json');
  } catch (e) {
    return { ok: false, errors: [{ code: 'IO_ERROR', details: { message: e instanceof Error ? e.message : String(e) } }] };
  }

  const serviceName = manifest.service.name;
  const serviceVersion = manifest.service.version;
  const graphSpecResult = parseAuthoringSpec({
    version: '1.0-rc7',
    pdmRef: `${serviceName}.domain.${serviceVersion}`,
    qsmRef: `${serviceName}.read.${serviceVersion}`,
    shapes,
    graphs: graphsById,
  });
  if (!graphSpecResult.ok) {
    return { ok: false, errors: [{ code: 'GRAPH_INVALID', details: graphSpecResult.errors }] };
  }
  const graphSpec: GraphSpec = graphSpecResult.value;

  // 5. Binding resolvers (mirrors demo/issue-tracker-api/src/artifacts.ts)
  const bindingResolvers: BindingResolvers = {
    resolveGraphSignature: (id) => {
      const g = graphsById[id];
      return g !== undefined ? toGraphSignature(g) : null;
    },
    resolveShape: (name) => {
      const custom = shapes[name];
      if (custom !== undefined) {
        const fields: ResolvedShape['fields'] = {};
        for (const [fn, f] of Object.entries(custom.fields)) {
          fields[fn] = {
            type: { kind: 'scalar', primitive: f.type as ScalarPrimitive },
            nullable: f.nullable,
          };
        }
        return { name, origin: 'custom', fields };
      }
      const e = pdmResolver.resolveEntity(name);
      if (e === null || e === undefined) return null;
      const fields: ResolvedShape['fields'] = {};
      for (const f of e.fields) {
        fields[f.name] = {
          type: { kind: 'scalar', primitive: f.type as ScalarPrimitive },
          nullable: f.nullable,
        };
      }
      return { name, origin: 'pdm', fields };
    },
  };

  // 6. Bindings
  let validatedBindings: ValidatedBindings;
  let bRaw: unknown;
  try {
    bRaw = readJsonFile(dir, 'bindings.json');
  } catch (e) {
    return { ok: false, errors: [{ code: 'IO_ERROR', details: { message: e instanceof Error ? e.message : String(e) } }] };
  }

  try {
    const bParsed = parseBindingArtifact(bRaw);
    if (!bParsed.ok) {
      return { ok: false, errors: [{ code: 'BINDINGS_INVALID', details: bParsed.errors }] };
    }
    const declaredModules = new Set(manifest.modules?.map((m) => m.name) ?? []);
    const v = validateBindings(bParsed.value, bindingResolvers, { declaredModules });
    if (!v.ok) {
      return { ok: false, errors: [{ code: 'BINDINGS_INVALID', details: v.errors }] };
    }
    validatedBindings = v.value;
  } catch (e) {
    return { ok: false, errors: [{ code: 'BINDINGS_INVALID', details: [{ message: e instanceof Error ? e.message : String(e) }] }] };
  }

  // 7. UI v2 — compile from source format (ui/ directory)
  let compiledUi: CompiledArtifact;
  const uiSourceDir = join(dir, 'ui');
  const uiBuildDir = join(dir, 'ui-build');
  const uiAssetsDir = existsSync(uiBuildDir) ? uiBuildDir : null;
  if (!existsSync(uiSourceDir)) {
    return { ok: false, errors: [{ code: 'UI_INVALID', details: [{ message: 'ui/ source directory not found' }] }] };
  }
  try {
    const httpMap: Record<string, { method: 'GET' | 'POST'; path: string }> = {};
    for (const [id, rb] of Object.entries(validatedBindings.resolved)) {
      httpMap[id] = { method: rb.entry.http.method, path: `/api${rb.entry.http.path}` };
    }

    const uiResult = compile({
      sourceDir: uiSourceDir,
      httpMap,
      resolvers: {
        resolveBinding: (id) => validatedBindings.resolved[id] ?? undefined,
        resolveComponent: () => ({ childrenModel: 'list' as const, props: {} }),
        resolveRoute: () => true,
        resolveOperation: () => undefined,
        resolveCategoryToModule: () => undefined,
      },
    });
    if (!uiResult.ok) {
      return { ok: false, errors: [{ code: 'UI_INVALID', details: uiResult.errors }] };
    }
    compiledUi = uiResult.value;
  } catch (e) {
    return { ok: false, errors: [{ code: 'IO_ERROR', details: { message: e instanceof Error ? e.message : String(e) } }] };
  }

  // 8. OpenAPI
  const openapi = generateOpenApi(validatedBindings, bindingResolvers);
  if (!openapi.ok) {
    return { ok: false, errors: [{ code: 'OPENAPI_INVALID', details: openapi.errors }] };
  }

  // 9. Cross-artifact validation for derived projections.
  //    For each QSM projection with `backing: 'derived'`, locate its graph in
  //    the authoring spec, compile it via graph-ir, and verify keys/exposed
  //    alignment. Returns a map used to seed DDL + apply-plan compilation.
  const xr = crossValidateDerivedProjections({
    qsm: validatedQsm,
    authoringSpec: graphSpec,
    pdm: validatedPdm,
  });
  if (!xr.ok) {
    return {
      ok: false,
      errors: [{ code: 'DERIVED_PROJECTION_INVALID', details: xr.errors }],
    };
  }
  const derivedResults = xr.value;

  // 10. Projection DDL + consumer apply plan — derived projections flow
  //     through via the schemas/handlers derived from `compileProjectionGraph`.
  const projectionDdls = generateProjectionDdl(validatedQsm, pdmResolver, {
    derivedSchemas: derivedSchemasFor(derivedResults),
  });
  const projectionApplyPlan = compileApplyPlan({
    pdm: pdmResolver,
    qsm: validatedQsm,
    events: eventTypes,
    derivedHandlers: derivedHandlersFor(derivedResults),
  });

  return {
    ok: true,
    value: {
      artifactDir: resolve(dir),
      manifest,
      pdm: validatedPdm,
      qsm: validatedQsm,
      bindings: validatedBindings,
      compiledUi,
      uiAssetsDir,
      graphSpec,
      openApiDoc: openapi.value,
      projectionApplyPlan,
      projectionDdls,
      eventTypes,
      seed: validatedSeed,
    },
  };
}

/**
 * Pull the `tableSchema` out of each compiled derived projection so it can be
 * fed into `generateProjectionDdl` via its `derivedSchemas` option.
 */
function derivedSchemasFor(
  map: ReadonlyMap<string, DerivedCompileResult>,
): Record<string, DerivedTableSchema> {
  const out: Record<string, DerivedTableSchema> = {};
  for (const [projName, compiled] of map) {
    out[projName] = compiled.tableSchema;
  }
  return out;
}

/**
 * Build the `DerivedHandler[]` consumed by `compileApplyPlan`. One entry per
 * compiled derived projection; `projectionName` / `tableName` come from the
 * QSM/ projection compile-table, the rest from the compiled result.
 */
function derivedHandlersFor(
  map: ReadonlyMap<string, DerivedCompileResult>,
): DerivedHandler[] {
  const out: DerivedHandler[] = [];
  for (const [projName, compiled] of map) {
    out.push({
      kind: 'derived',
      projectionName: projName,
      tableName: compiled.tableSchema.tableName,
      aggregateType: compiled.aggregateType,
      eventType: compiled.eventType,
      deltaSql: compiled.deltaSql,
      bootstrapSql: compiled.bootstrapSql,
      deltaBindings: compiled.deltaBindings,
      filter: compiled.filter,
    });
  }
  return out;
}
