import { existsSync } from 'node:fs';
import { join } from 'node:path';
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
import { validateUi, type ValidatedUiArtifact } from '@rntme/ui';
import { compileApplyPlan } from '@rntme/projection-consumer';
import { loadSeed, type ValidatedSeed } from '@rntme/seed';
import { buildBindingResolver, buildComponentResolver } from '@rntme/ui-runtime';
import { parseManifest } from '../manifest/parse.js';
import { validateManifest, applyEnvOverrides } from '../manifest/validate.js';
import type { GraphSpec, ServiceError, ValidatedService, RuntimeResult } from '../types.js';
import { readJsonFile, readTextFile, readGraphsDir } from './read-dir.js';

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
  throw new Error(`unsupported input type: "${raw}"`);
}

function parseOutputType(raw: string): OutputType {
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
  try {
    const pdmParsed = parsePdm(readJsonFile(dir, 'pdm.json'));
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
    return { ok: false, errors: [{ code: 'IO_ERROR', details: { message: e instanceof Error ? e.message : String(e) } }] };
  }

  // 3. QSM
  let validatedQsm: ValidatedQsm;
  try {
    const qsmParsed = parseQsm(readJsonFile(dir, 'qsm.json'));
    if (isQsmErr(qsmParsed)) {
      return { ok: false, errors: [{ code: 'QSM_INVALID', details: qsmParsed.errors }] };
    }
    const v = validateQsm(qsmParsed.value, pdmResolver);
    if (isQsmErr(v)) {
      return { ok: false, errors: [{ code: 'QSM_INVALID', details: v.errors }] };
    }
    validatedQsm = v.value;
  } catch (e) {
    return { ok: false, errors: [{ code: 'IO_ERROR', details: { message: e instanceof Error ? e.message : String(e) } }] };
  }

  const eventTypes = deriveEventTypes(validatedPdm);

  let validatedSeed: ValidatedSeed | null = null;
  const seedPath = join(dir, manifest.seed.path);
  if (manifest.seed.enabled && existsSync(seedPath)) {
    const seedResult = loadSeed(seedPath, { pdm: pdmResolver, events: eventTypes });
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
  const graphSpec: GraphSpec = {
    version: '1.0-rc7',
    pdmRef: `${serviceName}.domain.${serviceVersion}`,
    qsmRef: `${serviceName}.read.${serviceVersion}`,
    shapes,
    graphs: graphsById as Record<string, unknown>,
  };

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
  try {
    const bRaw = readJsonFile(dir, 'bindings.json');
    const bParsed = parseBindingArtifact(bRaw);
    if (!bParsed.ok) {
      return { ok: false, errors: [{ code: 'BINDINGS_INVALID', details: bParsed.errors }] };
    }
    const v = validateBindings(bParsed.value, bindingResolvers);
    if (!v.ok) {
      return { ok: false, errors: [{ code: 'BINDINGS_INVALID', details: v.errors }] };
    }
    validatedBindings = v.value;
  } catch (e) {
    return { ok: false, errors: [{ code: 'IO_ERROR', details: { message: e instanceof Error ? e.message : String(e) } }] };
  }

  // 7. UI — validateUi handles parsing internally
  let validatedUi: ValidatedUiArtifact;
  try {
    const uRaw = readJsonFile(dir, 'ui.json');
    const uiResolvers = {
      resolveBinding: buildBindingResolver(validatedBindings, bindingResolvers.resolveShape),
      resolveComponent: buildComponentResolver(),
      resolveRoute: (p: string) => {
        const uiRoutes = (uRaw as { routes?: Record<string, unknown> }).routes;
        return uiRoutes !== undefined && p in uiRoutes;
      },
    };
    const v = validateUi(uRaw, uiResolvers);
    if (!v.ok) {
      return { ok: false, errors: [{ code: 'UI_INVALID', details: v.errors }] };
    }
    validatedUi = v.value;
  } catch (e) {
    return { ok: false, errors: [{ code: 'IO_ERROR', details: { message: e instanceof Error ? e.message : String(e) } }] };
  }

  // 8. OpenAPI
  const openapi = generateOpenApi(validatedBindings, bindingResolvers);
  if (!openapi.ok) {
    return { ok: false, errors: [{ code: 'OPENAPI_INVALID', details: openapi.errors }] };
  }

  // 9. Derived projection specs + apply plan
  const projectionDdls = generateProjectionDdl(validatedQsm, pdmResolver);
  const projectionApplyPlan = compileApplyPlan({
    pdm: pdmResolver,
    qsm: validatedQsm,
    events: eventTypes,
  });

  return {
    ok: true,
    value: {
      manifest,
      pdm: validatedPdm,
      qsm: validatedQsm,
      bindings: validatedBindings,
      ui: validatedUi,
      graphSpec,
      openApiDoc: openapi.value,
      projectionApplyPlan,
      projectionDdls,
      eventTypes,
      seed: validatedSeed,
    },
  };
}
