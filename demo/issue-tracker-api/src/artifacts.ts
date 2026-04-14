import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parsePdm,
  validatePdm,
  createPdmResolver,
  deriveEventTypes,
  isErr,
  type PdmResolver,
  type ValidatedPdm,
  type EventTypeSpec,
} from '@rntme/pdm';
import {
  parseQsm,
  validateQsm,
  createQsmResolver,
  generateProjectionDdl,
  isErr as isQsmErr,
  type QsmResolver,
  type ValidatedQsm,
  type ProjectionDdlSpec,
} from '@rntme/qsm';
import type {
  BindingResolvers,
  GraphSignature,
  ResolvedShape,
  InputType,
  OutputType,
  InputMode,
  ScalarPrimitive,
} from '@rntme/bindings';

type GraphJson = {
  id: string;
  signature: {
    inputs: Record<string, { type: string; mode: InputMode; default?: unknown }>;
    output: { type: string; from: string };
  };
  nodes: unknown[];
};

type ShapesJson = Record<string, { fields: Record<string, { type: string; nullable: boolean }> }>;

const here = dirname(fileURLToPath(import.meta.url));
const artifactsDir = join(here, 'artifacts');
const readText = (name: string): string => readFileSync(join(artifactsDir, name), 'utf8');
const readJson = <T>(name: string): T => JSON.parse(readText(name)) as T;

// ---- PDM -----------------------------------------------------------------
const pdmParsed = parsePdm(readText('pdm.json'));
if (isErr(pdmParsed)) {
  throw new Error(`PDM parse failed: ${JSON.stringify(pdmParsed.errors, null, 2)}`);
}
const pdmValidatedR = validatePdm(pdmParsed.value);
if (isErr(pdmValidatedR)) {
  throw new Error(`PDM validation failed: ${JSON.stringify(pdmValidatedR.errors, null, 2)}`);
}
export const validatedPdm: ValidatedPdm = pdmValidatedR.value;
export const pdmResolver: PdmResolver = createPdmResolver(validatedPdm);
/** Raw PDM passed to graph-ir-compiler; compiler re-parses via @rntme/pdm, so the full object is fine. */
export const pdm: ValidatedPdm = validatedPdm;

// ---- QSM -----------------------------------------------------------------
const qsmRaw = readJson<unknown>('qsm.json');
const qsmParsed = parseQsm(qsmRaw);
if (isQsmErr(qsmParsed)) {
  throw new Error(`QSM parse failed: ${JSON.stringify(qsmParsed.errors, null, 2)}`);
}
const qsmValidatedR = validateQsm(qsmParsed.value, pdmResolver);
if (isQsmErr(qsmValidatedR)) {
  throw new Error(`QSM validation failed: ${JSON.stringify(qsmValidatedR.errors, null, 2)}`);
}
export const validatedQsm: ValidatedQsm = qsmValidatedR.value;
export const qsmResolver: QsmResolver = createQsmResolver(validatedQsm);
export const qsm: ValidatedQsm = validatedQsm;

// ---- Derived specs --------------------------------------------------------
export const projectionDdls: readonly ProjectionDdlSpec[] =
  generateProjectionDdl(validatedQsm, pdmResolver);
export const eventTypes: readonly EventTypeSpec[] = deriveEventTypes(validatedPdm);

// ---- Bindings + graph spec ------------------------------------------------
export const bindingsArtifact = readJson<Record<string, unknown>>('bindings.json');
export const shapes = readJson<ShapesJson>('shapes.json');

const graphsDir = join(artifactsDir, 'graphs');
const graphFiles = readdirSync(graphsDir).filter((f) => f.endsWith('.json'));
const graphEntries = graphFiles.map((f) => {
  const g = JSON.parse(readFileSync(join(graphsDir, f), 'utf8')) as GraphJson;
  return [g.id, g] as const;
});
const graphsById = Object.fromEntries(graphEntries);

export const graphSpec = {
  version: '1.0-rc7' as const,
  pdmRef: 'issue-tracker.domain.v1',
  qsmRef: 'issue-tracker.read.v1',
  shapes,
  graphs: graphsById,
};

// ---- Resolvers for @rntme/bindings ---------------------------------------
function parseInputType(raw: string): InputType {
  if (
    raw === 'integer' || raw === 'decimal' || raw === 'string' ||
    raw === 'boolean' || raw === 'date' || raw === 'datetime'
  ) {
    return { kind: 'scalar', primitive: raw };
  }
  throw new Error(`Unsupported input type in demo: "${raw}"`);
}

function parseOutputType(raw: string): OutputType {
  const m = /^(rowset|row)<([A-Za-z_][A-Za-z0-9_]*)>$/.exec(raw);
  if (!m) throw new Error(`Unsupported output type: "${raw}"`);
  return { kind: m[1] as 'rowset' | 'row', shape: m[2]! };
}

function toGraphSignature(g: GraphJson): GraphSignature {
  const inputs: GraphSignature['inputs'] = {};
  for (const [name, decl] of Object.entries(g.signature.inputs)) {
    const base = { type: parseInputType(decl.type), mode: decl.mode };
    inputs[name] = decl.default !== undefined ? { ...base, default: decl.default } : base;
  }
  return {
    id: g.id,
    inputs,
    output: { type: parseOutputType(g.signature.output.type), from: g.signature.output.from },
  };
}

function entityToShape(entityName: string): ResolvedShape | null {
  const e = pdmResolver.resolveEntity(entityName);
  if (!e) return null;
  const fields: ResolvedShape['fields'] = {};
  for (const f of e.fields) {
    fields[f.name] = {
      type: { kind: 'scalar', primitive: f.type as ScalarPrimitive },
      nullable: f.nullable,
    };
  }
  return { name: entityName, origin: 'pdm', fields };
}

function customShape(
  name: string,
  def: { fields: Record<string, { type: string; nullable: boolean }> },
): ResolvedShape {
  const fields: ResolvedShape['fields'] = {};
  for (const [fieldName, f] of Object.entries(def.fields)) {
    fields[fieldName] = {
      type: { kind: 'scalar', primitive: f.type as ScalarPrimitive },
      nullable: f.nullable,
    };
  }
  return { name, origin: 'custom', fields };
}

export const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) => {
    const g = graphsById[id];
    return g ? toGraphSignature(g) : null;
  },
  resolveShape: (name) => {
    if (shapes[name]) return customShape(name, shapes[name]);
    return entityToShape(name);
  },
};
