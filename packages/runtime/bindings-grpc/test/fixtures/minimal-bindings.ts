import {
  validateBindings,
  type BindingArtifact,
  type BindingResolvers,
  type GraphSignature,
  type ResolvedShape,
  type ValidatedBindings,
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

const createOrderResultShape: ResolvedShape = {
  name: 'CreateOrderResult',
  origin: 'custom',
  fields: {
    reserved: { type: { kind: 'scalar', primitive: 'boolean' }, nullable: false },
    reservationId: { type: { kind: 'scalar', primitive: 'string' }, nullable: false },
  },
};

const listOrdersSignature: GraphSignature = {
  id: 'listOrders',
  inputs: {
    limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 50 },
  },
  output: { type: { kind: 'rowset', shape: 'order' }, from: 'rows' },
  effects: { localReads: true, localEmits: [], calls: [], waits: false },
};

const createOrderSignature: GraphSignature = {
  id: 'createOrder',
  inputs: {
    amount: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
    note: { type: { kind: 'scalar', primitive: 'string' }, mode: 'nullable' },
  },
  output: { type: { kind: 'row', shape: 'CreateOrderResult' }, from: 'out' },
  effects: {
    localReads: true,
    localEmits: [{ aggregate: 'Order', transition: 'create', eventType: 'OrderCreated' }],
    calls: [],
    waits: false,
  },
};

const artifact: BindingArtifact = {
  version: '1.0',
  graphSpecRef: 'inline',
  pdmRef: 'inline',
  qsmRef: 'inline',
  bindings: {
    listOrders: {
      exposure: 'read',
      graph: 'listOrders',
      target: { engine: 'graph-ir', dialect: 'sqlite' },
      http: {
        method: 'GET',
        path: '/orders',
        parameters: [
          { name: 'limit', in: 'query', bindTo: 'limit', required: false },
        ],
      },
    },
    createOrder: {
      exposure: 'action',
      graph: 'createOrder',
      target: { engine: 'graph-ir', dialect: 'sqlite' },
      http: {
        method: 'POST',
        path: '/orders',
        parameters: [
          { name: 'amount', in: 'body', bindTo: 'amount', required: true },
          { name: 'note', in: 'body', bindTo: 'note', required: false },
        ],
      },
    },
  },
};

const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) => {
    if (id === 'listOrders') return listOrdersSignature;
    if (id === 'createOrder') return createOrderSignature;
    return null;
  },
  resolveShape: (name) => {
    if (name === 'order') return orderShape;
    if (name === 'CreateOrderResult') return createOrderResultShape;
    return null;
  },
};

const validated = validateBindings(artifact, resolvers);
if (!validated.ok) {
  throw new Error(
    `minimal-bindings fixture failed validation: ${JSON.stringify(validated.errors)}`,
  );
}

export const minimalValidated: ValidatedBindings = validated.value;

export const minimalShapeRegistry: Record<string, ResolvedShape> = {
  order: orderShape,
  CreateOrderResult: createOrderResultShape,
};
