import type {
  ValidatedBindings,
  ResolvedBinding,
  ResolvedShape,
  GraphSignature,
} from '@rntme/bindings';

const orderShape: ResolvedShape = {
  name: 'order',
  origin: 'pdm',
  fields: {
    id: { type: { kind: 'scalar', primitive: 'string' }, nullable: false },
    amount: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
    note: { type: { kind: 'scalar', primitive: 'string' }, nullable: true },
  },
};

const listOrdersSignature: GraphSignature = {
  id: 'listOrders',
  role: 'query',
  inputs: {
    limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 50 },
  },
  output: { type: { kind: 'rowset', shape: 'order' }, from: 'rows' },
};

const createOrderSignature: GraphSignature = {
  id: 'createOrder',
  role: 'command',
  inputs: {
    amount: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
    note: { type: { kind: 'scalar', primitive: 'string' }, mode: 'nullable' },
  },
  output: { type: { kind: 'scalar', primitive: 'string' }, from: 'id' },
};

const listOrdersBinding: ResolvedBinding = {
  entry: {
    kind: 'query',
    graph: 'listOrders',
    target: { engine: 'graph-ir', dialect: 'sqlite' },
    http: { method: 'GET', path: '/orders', parameters: [
      { name: 'limit', in: 'query', bindTo: 'limit', required: false },
    ] },
  },
  signature: listOrdersSignature,
  outputShape: orderShape,
};

const createOrderBinding: ResolvedBinding = {
  entry: {
    kind: 'command',
    graph: 'createOrder',
    target: { engine: 'graph-ir', dialect: 'sqlite' },
    http: { method: 'POST', path: '/orders', parameters: [
      { name: 'amount', in: 'body', bindTo: 'amount', required: true },
      { name: 'note', in: 'body', bindTo: 'note', required: false },
    ] },
  },
  signature: createOrderSignature,
  outputShape: orderShape,
};

export const minimalValidated: ValidatedBindings = {
  artifact: {
    version: '1.0',
    graphSpecRef: 'inline',
    pdmRef: 'inline',
    qsmRef: 'inline',
    bindings: {
      listOrders: listOrdersBinding.entry,
      createOrder: createOrderBinding.entry,
    },
  } as unknown as ValidatedBindings['artifact'],
  resolved: {
    listOrders: listOrdersBinding,
    createOrder: createOrderBinding,
  },
} as unknown as ValidatedBindings;

export const minimalShapeRegistry: Record<string, ResolvedShape> = {
  order: orderShape,
};
