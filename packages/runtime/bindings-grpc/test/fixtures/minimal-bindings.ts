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
  output: { type: { kind: 'row', shape: 'CommandResult' }, from: 'emit' },
};

const artifact: BindingArtifact = {
  version: '1.0',
  graphSpecRef: 'inline',
  pdmRef: 'inline',
  qsmRef: 'inline',
  bindings: {
    listOrders: {
      kind: 'query',
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
      kind: 'command',
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
  resolveShape: (name) => (name === 'order' ? orderShape : null),
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
};
