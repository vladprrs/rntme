import type { BindingResolvers, GraphSignature, ResolvedShape } from '../../../src/types/resolvers.js';

const categorySalesSig: GraphSignature = {
  id: 'getCategorySales',
  inputs: {
    dateFrom: { type: { kind: 'scalar', primitive: 'date' }, mode: 'required' },
    dateTo: { type: { kind: 'scalar', primitive: 'date' }, mode: 'required' },
    minRevenue: { type: { kind: 'scalar', primitive: 'decimal' }, mode: 'predicate_optional' },
    limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
  },
  output: { type: { kind: 'rowset', shape: 'CategorySalesRow' }, from: 'paged' },
};

const categorySalesRow: ResolvedShape = {
  name: 'CategorySalesRow',
  origin: 'custom',
  fields: {
    categoryId: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
    revenue: { type: { kind: 'scalar', primitive: 'decimal' }, nullable: false },
    totalQuantity: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
    lineCount: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
    avgItemPrice: { type: { kind: 'scalar', primitive: 'decimal' }, nullable: false },
    categoryName: { type: { kind: 'scalar', primitive: 'string' }, nullable: true },
  },
};

export const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) => (id === 'getCategorySales' ? categorySalesSig : null),
  resolveShape: (name) => (name === 'CategorySalesRow' ? categorySalesRow : null),
};
