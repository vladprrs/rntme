import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from './dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const load = (p) => JSON.parse(readFileSync(join(here, p), 'utf8'));
const pdm = load('test/e2e/fixtures/commerce.pdm.json');
const qsm = load('test/e2e/fixtures/commerce.qsm.json');

const base = { version: '1.0-rc7', pdmRef: 'commerce.domain.v1', qsmRef: 'commerce.read.v1' };

const cases = [
  {
    title: '1. findMany only (select all OrderItems)',
    spec: {
      ...base, shapes: {}, graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'items' } },
          nodes: [{ id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } }],
        },
      },
    },
  },
  {
    title: '2. findMany + literal limit(3)',
    spec: {
      ...base, shapes: {}, graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: 'rowset<OrderItem>', from: 'p' } },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            { id: 'p', type: 'limit', config: { input: 'items', count: 3 } },
          ],
        },
      },
    },
  },
  {
    title: '3. findMany + defaulted limit param',
    spec: {
      ...base, shapes: {}, graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: { limit: { type: 'integer', mode: 'defaulted', default: 20 } },
            output: { type: 'rowset<OrderItem>', from: 'p' },
          },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            { id: 'p', type: 'limit', config: { input: 'items', count: { $param: 'limit' } } },
          ],
        },
      },
    },
  },
  {
    title: '4. filter with comparison (required param)',
    spec: {
      ...base, shapes: {}, graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: { minQty: { type: 'integer', mode: 'required' } },
            output: { type: 'rowset<OrderItem>', from: 'f' },
          },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            { id: 'f', type: 'filter', config: { input: 'items', expr: { gte: ['orderItem.quantity', { $param: 'minQty' }] } } },
          ],
        },
      },
    },
  },
  {
    title: '5. filter with AND + LIKE + IS_NULL',
    spec: {
      ...base, shapes: {}, graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: { name: { type: 'string', mode: 'required' } },
            output: { type: 'rowset<Product>', from: 'f' },
          },
          nodes: [
            { id: 'prod', type: 'findMany', config: { source: { entity: 'Product' } } },
            {
              id: 'f', type: 'filter', config: {
                input: 'prod',
                expr: { and: [
                  { like: ['product.name', { $param: 'name' }] },
                  { not: [{ is_null: ['product.categoryId'] }] },
                ] },
              },
            },
          ],
        },
      },
    },
  },
  {
    title: '6. filter + predicate_optional (NULL-skip pattern)',
    spec: {
      ...base, shapes: {}, graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: { minPrice: { type: 'decimal', mode: 'predicate_optional' } },
            output: { type: 'rowset<OrderItem>', from: 'f' },
          },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            { id: 'f', type: 'filter', config: { input: 'items', expr: { gte: ['orderItem.unitPrice', { $param: 'minPrice' }] } } },
          ],
        },
      },
    },
  },
  {
    title: '7. dot-navigation JOIN (OrderItem.order.createdAt between ... and ...)',
    spec: {
      ...base, shapes: {}, graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: {
              dateFrom: { type: 'datetime', mode: 'required' },
              dateTo: { type: 'datetime', mode: 'required' },
            },
            output: { type: 'rowset<OrderItem>', from: 'f' },
          },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            { id: 'f', type: 'filter', config: { input: 'items', expr: { between: ['orderItem.order.createdAt', { $param: 'dateFrom' }, { $param: 'dateTo' }] } } },
          ],
        },
      },
    },
  },
  {
    title: '8. map — computed column (unitPrice * quantity)',
    spec: {
      ...base,
      shapes: { Line: { fields: { id: { type: 'integer', nullable: false }, total: { type: 'decimal', nullable: false } } } },
      graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: 'rowset<Line>', from: 'm' } },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            {
              id: 'm', type: 'map', config: {
                input: 'items', into: 'Line',
                fields: { id: 'orderItem.id', total: { mul: ['orderItem.unitPrice', 'orderItem.quantity'] } },
              },
            },
          ],
        },
      },
    },
  },
  {
    title: '9. reduce — GROUP BY with SUM/COUNT/COUNT(DISTINCT)/AVG',
    spec: {
      ...base,
      shapes: {
        Agg: { fields: {
          productId: { type: 'integer', nullable: false },
          revenue: { type: 'decimal', nullable: false },
          lineCount: { type: 'integer', nullable: false },
          distinctOrders: { type: 'integer', nullable: false },
          avgItemPrice: { type: 'decimal', nullable: false },
        } },
      },
      graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: 'rowset<Agg>', from: 'r' } },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            {
              id: 'r', type: 'reduce', config: {
                input: 'items', into: 'Agg',
                group: { productId: 'orderItem.productId' },
                measures: {
                  revenue: { fn: 'sum', expr: { mul: ['orderItem.unitPrice', 'orderItem.quantity'] } },
                  lineCount: { fn: 'count' },
                  distinctOrders: { fn: 'count_distinct', expr: 'orderItem.orderId' },
                  avgItemPrice: { fn: 'avg', expr: 'orderItem.unitPrice' },
                },
              },
            },
          ],
        },
      },
    },
  },
  {
    title: '10. sort ASC NULLS LAST',
    spec: {
      ...base, shapes: {}, graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: 'rowset<Category>', from: 's' } },
          nodes: [
            { id: 'cats', type: 'findMany', config: { source: { entity: 'Category' } } },
            { id: 's', type: 'sort', config: { input: 'cats', by: [{ field: 'category.name', dir: 'asc', nulls: 'last' }] } },
          ],
        },
      },
    },
  },
  {
    title: '11. FULL KITCHEN SINK — filter + 2-level JOIN + reduce + HAVING + sort + limit',
    spec: {
      ...base,
      shapes: {
        CategorySalesAgg: { fields: {
          categoryId: { type: 'integer', nullable: false },
          revenue: { type: 'decimal', nullable: false },
          totalQuantity: { type: 'integer', nullable: false },
          lineCount: { type: 'integer', nullable: false },
          avgItemPrice: { type: 'decimal', nullable: false },
        } },
      },
      graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: {
              dateFrom: { type: 'datetime', mode: 'required' },
              dateTo: { type: 'datetime', mode: 'required' },
              minRevenue: { type: 'decimal', mode: 'predicate_optional' },
              limit: { type: 'integer', mode: 'defaulted', default: 20 },
            },
            output: { type: 'rowset<CategorySalesAgg>', from: 'paged' },
          },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'OrderItem' } } },
            { id: 'dateFiltered', type: 'filter', config: { input: 'items', expr: { between: ['orderItem.order.createdAt', { $param: 'dateFrom' }, { $param: 'dateTo' }] } } },
            {
              id: 'grouped', type: 'reduce', config: {
                input: 'dateFiltered', into: 'CategorySalesAgg',
                group: { categoryId: 'orderItem.product.categoryId' },
                measures: {
                  revenue: { fn: 'sum', expr: { mul: ['orderItem.unitPrice', 'orderItem.quantity'] } },
                  totalQuantity: { fn: 'sum', expr: 'orderItem.quantity' },
                  lineCount: { fn: 'count' },
                  avgItemPrice: { fn: 'avg', expr: 'orderItem.unitPrice' },
                },
              },
            },
            { id: 'revFiltered', type: 'filter', config: { input: 'grouped', expr: { gte: ['revenue', { $param: 'minRevenue' }] } } },
            { id: 'sorted', type: 'sort', config: { input: 'revFiltered', by: [{ field: 'revenue', dir: 'desc', nulls: 'last' }] } },
            { id: 'paged', type: 'limit', config: { input: 'sorted', count: { $param: 'limit' } } },
          ],
        },
      },
    },
  },
  {
    title: '12. map with CONCAT + COALESCE (string build)',
    spec: {
      ...base,
      shapes: { V: { fields: { id: { type: 'integer', nullable: false }, label: { type: 'string', nullable: false } } } },
      graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: 'rowset<V>', from: 'm' } },
          nodes: [
            { id: 'cats', type: 'findMany', config: { source: { entity: 'Category' } } },
            {
              id: 'm', type: 'map', config: {
                input: 'cats', into: 'V',
                fields: {
                  id: 'category.id',
                  label: { concat: [
                    { $literal: 'cat#' },
                    { coalesce: ['category.name', { $literal: '(unnamed)' }] },
                  ] },
                },
              },
            },
          ],
        },
      },
    },
  },
];

let ok = 0, fail = 0;
for (const c of cases) {
  const r = compile(c.spec, pdm, qsm);
  console.log('\n================================================================');
  console.log(c.title);
  console.log('----------------------------------------------------------------');
  if (!r.ok) {
    fail++;
    console.log('COMPILE ERRORS:');
    for (const e of r.errors) console.log(`  [${e.layer}/${e.code}] ${e.message}`);
    continue;
  }
  ok++;
  console.log('SQL        :', r.value.sql);
  console.log('paramOrder :', JSON.stringify(r.value.paramOrder));
  if (r.value.optionalParams.length) console.log('optional   :', JSON.stringify(r.value.optionalParams));
  if (Object.keys(r.value.paramDefaults).length) console.log('defaults   :', JSON.stringify(r.value.paramDefaults));
  console.log('shape      :', r.value.shape.name);
}
console.log(`\n${ok} ok / ${fail} failed`);
