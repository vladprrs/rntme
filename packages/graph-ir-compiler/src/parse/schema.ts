import { z } from 'zod';

const primitiveType = z.enum(['integer', 'long', 'decimal', 'string', 'boolean', 'date', 'datetime']);

const inputType = z.union([
  primitiveType,
  z.object({ list: primitiveType }).strict(),
  z.object({ row: z.string() }).strict(),
  z.object({ rowset: z.string() }).strict(),
]);

const inputMode = z.enum(['root', 'required', 'nullable', 'defaulted', 'predicate_optional']);

const inputDecl = z.object({
  type: inputType,
  mode: inputMode,
  default: z.unknown().optional(),
});

const fieldDecl = z.object({ type: primitiveType, nullable: z.boolean() });
const namedShape = z.object({ fields: z.record(z.string(), fieldDecl) }).strict();

const expr: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.object({ $literal: z.string() }).strict(),
    z.object({ $param: z.string() }).strict(),
    z.object({ $list: z.array(expr) }).strict(),
    z.object({ between: z.tuple([expr, expr, expr]) }).strict(),
    z
      .object({
        case: z
          .object({
            when: z.array(z.tuple([expr, expr])),
            else: expr,
          })
          .strict(),
      })
      .strict(),
    z
      .object({ exists: z.object({ relation: z.string(), where: expr.optional() }).strict() })
      .strict(),
    z.record(z.string(), z.array(expr)),
  ]),
);

const fieldExpr = z.union([
  expr,
  z
    .object({
      lookup: z
        .object({
          entity: z.string(),
          path: z.string().optional(),
          match: z.record(z.string(), z.string()),
          field: z.string(),
          optional: z.boolean().optional(),
        })
        .strict(),
    })
    .strict(),
]);

const findManyNode = z
  .object({
    id: z.string(),
    type: z.literal('findMany'),
    config: z
      .object({
        source: z.union([
          z.object({ entity: z.string().min(1) }).strict(),
          z.object({ projection: z.string().min(1) }).strict(),
          z.object({ eventType: z.string().min(1) }).strict(),
        ]),
      })
      .strict(),
  })
  .strict();

const filterNode = z
  .object({
    id: z.string(),
    type: z.literal('filter'),
    config: z
      .object({
        input: z.string(),
        expr: expr.optional(),
        predicate: z.string().optional(),
      })
      .strict(),
  })
  .strict();

const mapNode = z
  .object({
    id: z.string(),
    type: z.literal('map'),
    config: z
      .object({
        input: z.string(),
        into: z.string(),
        fields: z.record(z.string(), fieldExpr),
      })
      .strict(),
  })
  .strict();

const measureSpec = z
  .object({
    fn: z.enum(['count', 'count_distinct', 'sum', 'avg', 'min', 'max', 'group_array']),
    expr: expr.optional(),
  })
  .strict();

const reduceNode = z
  .object({
    id: z.string(),
    type: z.literal('reduce'),
    config: z
      .object({
        input: z.string(),
        into: z.string(),
        group: z.record(z.string(), z.string()),
        measures: z.record(z.string(), measureSpec),
      })
      .strict(),
  })
  .strict();

const sortKey = z
  .object({
    field: z.string(),
    dir: z.enum(['asc', 'desc']).optional(),
    nulls: z.enum(['first', 'last']).optional(),
  })
  .strict();

const sortNode = z
  .object({
    id: z.string(),
    type: z.literal('sort'),
    config: z.object({ input: z.string(), by: z.array(sortKey).min(1) }).strict(),
  })
  .strict();

const limitCount = z.union([z.number().int().nonnegative(), z.object({ $param: z.string() }).strict()]);

const limitNode = z
  .object({
    id: z.string(),
    type: z.literal('limit'),
    config: z.object({ input: z.string(), count: limitCount }).strict(),
  })
  .strict();

const distinctNode = z
  .object({
    id: z.string(),
    type: z.literal('distinct'),
    config: z.object({ input: z.string() }).strict(),
  })
  .strict();

const lookupOneNode = z
  .object({
    id: z.string(),
    type: z.literal('lookupOne'),
    config: z
      .object({
        input: z.string(),
        entity: z.string(),
        as: z.string(),
        match: z.record(z.string(), z.string()),
        optional: z.boolean().optional(),
        path: z.string().optional(),
      })
      .strict(),
  })
  .strict();

const emitNode = z
  .object({
    id: z.string(),
    type: z.literal('emit'),
    config: z
      .object({
        aggregate: z.string(),
        aggregateId: expr,
        transition: z.string(),
        payload: z.record(z.string(), expr),
        actor: expr.optional(),
      })
      .strict(),
  })
  .strict();

const graphNode = z.discriminatedUnion('type', [
  findManyNode,
  filterNode,
  mapNode,
  reduceNode,
  sortNode,
  limitNode,
  distinctNode,
  lookupOneNode,
  emitNode,
]);

const graphDecl = z
  .object({
    id: z.string(),
    signature: z
      .object({
        inputs: z.record(z.string(), inputDecl),
        output: z.object({ type: z.string(), from: z.string() }).strict(),
      })
      .strict(),
    nodes: z.array(graphNode),
  })
  .strict();

export const AuthoringSpecSchema = z
  .object({
    version: z.literal('1.0-rc7'),
    pdmRef: z.string(),
    qsmRef: z.string(),
    shapes: z.record(z.string(), namedShape),
    graphs: z.record(z.string(), graphDecl),
  })
  .strict();

export type AuthoringSpecInput = z.input<typeof AuthoringSpecSchema>;
export type AuthoringSpecOutput = z.output<typeof AuthoringSpecSchema>;
