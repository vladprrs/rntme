import {
  parseBindingArtifact,
  validateBindings,
  generateOpenApi,
  isOk,
} from './dist/index.js';

// Minimal domain: reuse commerce entities from graph-ir-compiler examples.
// Resolvers below are hand-written fakes — in a real system they come from
// a GraphSpec + PDM/QSM loader.

const orderItemShape = {
  name: 'OrderItem',
  origin: 'pdm',
  fields: {
    id:         { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
    orderId:    { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
    productId:  { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
    unitPrice:  { type: { kind: 'scalar', primitive: 'decimal' }, nullable: false },
    quantity:   { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
  },
};

const categorySalesShape = {
  name: 'CategorySalesRow',
  origin: 'custom',
  fields: {
    categoryId:    { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
    revenue:       { type: { kind: 'scalar', primitive: 'decimal' }, nullable: false },
    totalQuantity: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
    lineCount:     { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
    avgItemPrice:  { type: { kind: 'scalar', primitive: 'decimal' }, nullable: false },
    categoryName:  { type: { kind: 'scalar', primitive: 'string'  }, nullable: true  },
  },
};

// ---------- signatures ----------

const sigListAll = {
  id: 'listAllItems',
  inputs: {},
  output: { type: { kind: 'rowset', shape: 'OrderItem' }, from: 'items' },
};

const sigMinQty = {
  id: 'itemsByMinQty',
  inputs: {
    minQty: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
  },
  output: { type: { kind: 'rowset', shape: 'OrderItem' }, from: 'f' },
};

const sigListing = {
  id: 'priceListing',
  inputs: {
    minPrice: { type: { kind: 'scalar', primitive: 'decimal' }, mode: 'predicate_optional' },
    limit:    { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
  },
  output: { type: { kind: 'rowset', shape: 'OrderItem' }, from: 'paged' },
};

const sigItemsOfOrder = {
  id: 'itemsOfOrder',
  inputs: {
    orderId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
    productIds: { type: { kind: 'list',   element: 'integer' }, mode: 'nullable' },
  },
  output: { type: { kind: 'rowset', shape: 'OrderItem' }, from: 'f' },
};

const sigCategorySales = {
  id: 'getCategorySales',
  inputs: {
    dateFrom:   { type: { kind: 'scalar', primitive: 'date'    }, mode: 'required' },
    dateTo:     { type: { kind: 'scalar', primitive: 'date'    }, mode: 'required' },
    minRevenue: { type: { kind: 'scalar', primitive: 'decimal' }, mode: 'predicate_optional' },
    limit:      { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
  },
  output: { type: { kind: 'rowset', shape: 'CategorySalesRow' }, from: 'paged' },
};

const signatures = {
  listAllItems:   sigListAll,
  itemsByMinQty:  sigMinQty,
  priceListing:   sigListing,
  itemsOfOrder:   sigItemsOfOrder,
  getCategorySales: sigCategorySales,
};
const shapes = {
  OrderItem: orderItemShape,
  CategorySalesRow: categorySalesShape,
};
const resolvers = {
  resolveGraphSignature: (id) => signatures[id] ?? null,
  resolveShape: (name) => shapes[name] ?? null,
};

// ---------- artifacts ----------

const baseRefs = {
  version: '1.0',
  graphSpecRef: 'commerce.graphs.v1',
  pdmRef: 'commerce.domain.v1',
  qsmRef: 'commerce.read.v1',
};

const cases = [
  {
    title: '1. Minimal — GET, no parameters',
    artifact: {
      ...baseRefs,
      bindings: {
        listItems: {
          graph: 'listAllItems',
          target: { engine: 'sqlite', dialect: 'sqlite' },
          http: {
            method: 'GET',
            path: '/v1/items',
            parameters: [],
          },
        },
      },
    },
  },
  {
    title: '2. Required query parameter',
    artifact: {
      ...baseRefs,
      bindings: {
        itemsByMinQty: {
          graph: 'itemsByMinQty',
          target: { engine: 'sqlite', dialect: 'sqlite' },
          http: {
            method: 'GET',
            path: '/v1/items',
            parameters: [
              { name: 'minQty', in: 'query', bindTo: 'minQty', required: true },
            ],
          },
        },
      },
    },
  },
  {
    title: '3. predicate_optional + defaulted',
    artifact: {
      ...baseRefs,
      bindings: {
        priceListing: {
          graph: 'priceListing',
          target: { engine: 'sqlite', dialect: 'sqlite' },
          http: {
            method: 'GET',
            path: '/v1/items/listing',
            parameters: [
              { name: 'minPrice', in: 'query', bindTo: 'minPrice', required: false },
              { name: 'limit',    in: 'query', bindTo: 'limit',    required: false },
            ],
          },
        },
      },
    },
  },
  {
    title: '4. Path parameter + list in body (POST)',
    artifact: {
      ...baseRefs,
      bindings: {
        itemsOfOrder: {
          graph: 'itemsOfOrder',
          target: { engine: 'sqlite', dialect: 'sqlite' },
          http: {
            method: 'POST',
            path: '/v1/orders/{orderId}/items/search',
            parameters: [
              { name: 'orderId',    in: 'path', bindTo: 'orderId',    required: true  },
              { name: 'productIds', in: 'body', bindTo: 'productIds', required: false },
            ],
          },
        },
      },
    },
  },
  {
    title: '5. Kitchen sink — category sales aggregate (golden fixture)',
    artifact: {
      ...baseRefs,
      openapi: {
        info: { title: 'Commerce Analytics API', version: '1.0.0' },
        servers: [{ url: 'https://api.example.com' }],
      },
      bindings: {
        getCategorySalesHttp: {
          graph: 'getCategorySales',
          target: { engine: 'sqlite', dialect: 'sqlite' },
          http: {
            method: 'GET',
            path: '/v1/analytics/category-sales',
            tags: ['analytics'],
            summary: 'Category sales aggregation',
            parameters: [
              { name: 'dateFrom',   in: 'query', bindTo: 'dateFrom',   required: true  },
              { name: 'dateTo',     in: 'query', bindTo: 'dateTo',     required: true  },
              { name: 'minRevenue', in: 'query', bindTo: 'minRevenue', required: false },
              { name: 'limit',      in: 'query', bindTo: 'limit',      required: false },
            ],
          },
        },
      },
    },
  },
];

for (const c of cases) {
  const parsed = parseBindingArtifact(c.artifact);
  if (!isOk(parsed)) { console.log(c.title, 'PARSE FAIL', parsed.errors); continue; }
  const validated = validateBindings(parsed.value, resolvers);
  if (!isOk(validated)) { console.log(c.title, 'VALIDATE FAIL', validated.errors); continue; }
  const emitted = generateOpenApi(validated.value, resolvers);
  if (!isOk(emitted)) { console.log(c.title, 'EMIT FAIL', emitted.errors); continue; }

  console.log('=========================================================');
  console.log(c.title);
  console.log('=========================================================');
  console.log(JSON.stringify(emitted.value, null, 2));
  console.log();
}
