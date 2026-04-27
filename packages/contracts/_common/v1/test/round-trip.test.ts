import { describe, it, expect } from 'vitest';
import { proto } from '../src/index.js';

const { CanonicalRef, CommandContext, Name, ListRequest, Filter, Sort, ListResponseMeta, Metadata, FilterOperator, SortDirection } =
  proto.rntme.contracts.common.v1;

function roundTrip<T>(
  Type: {
    encode(m: T): { finish(): Uint8Array };
    decode(buf: Uint8Array): T;
    toObject(m: T, opts?: object): object;
  },
  message: T,
): object {
  const buf = Type.encode(message).finish();
  const decoded = Type.decode(buf);
  return Type.toObject(decoded, { defaults: true, longs: String });
}

describe('CanonicalRef', () => {
  it('round-trips all five fields', () => {
    const original = CanonicalRef.create({
      canonical_id: '7b8c4f1e-0000-4000-8000-000000000001',
      vendor_id: 'user_2abc',
      module_name: 'identity-clerk',
      module_version: '0.3.1',
      contract_version: 'v1',
    });
    const out = roundTrip(CanonicalRef, original) as Record<string, string>;
    expect(out.canonical_id).toBe('7b8c4f1e-0000-4000-8000-000000000001');
    expect(out.vendor_id).toBe('user_2abc');
    expect(out.module_name).toBe('identity-clerk');
    expect(out.module_version).toBe('0.3.1');
    expect(out.contract_version).toBe('v1');
  });
});

describe('CommandContext', () => {
  it('preserves idempotency_key and actor fields', () => {
    const original = CommandContext.create({
      idempotency_key: 'key-001',
      correlation_id: 'corr-001',
      actor_user_id: 'user-42',
      actor_type: 'user',
      tenant_id: 'org-1',
    });
    const out = roundTrip(CommandContext, original) as Record<string, string>;
    expect(out.idempotency_key).toBe('key-001');
    expect(out.actor_type).toBe('user');
  });
});

describe('Name', () => {
  it('round-trips given/family/display', () => {
    const original = Name.create({ given: 'Ada', family: 'Lovelace', display: 'Ada Lovelace' });
    const out = roundTrip(Name, original) as Record<string, string>;
    expect(out.given).toBe('Ada');
    expect(out.family).toBe('Lovelace');
    expect(out.display).toBe('Ada Lovelace');
  });
});

describe('ListRequest', () => {
  it('preserves filters and sorts as repeated nested messages', () => {
    const original = ListRequest.create({
      limit: 50,
      cursor: 'cursor-xyz',
      offset: 0,
      filters: [
        Filter.create({ field: 'status', operator: FilterOperator.FILTER_OPERATOR_EQ, value: 'active' }),
        Filter.create({ field: 'tag', operator: FilterOperator.FILTER_OPERATOR_IN, values: ['a', 'b'] }),
      ],
      sorts: [Sort.create({ field: 'created_at', direction: SortDirection.SORT_DIRECTION_DESC })],
    });
    const out = roundTrip(ListRequest, original) as {
      limit: number;
      filters: Array<{ field: string; operator: number }>;
      sorts: Array<{ field: string }>;
    };
    expect(out.limit).toBe(50);
    expect(out.filters).toHaveLength(2);
    expect(out.filters[0]?.field).toBe('status');
    expect(out.sorts[0]?.field).toBe('created_at');
  });
});

describe('ListResponseMeta', () => {
  it('round-trips pagination cursors', () => {
    const original = ListResponseMeta.create({
      limit: 20,
      next_cursor: 'next',
      prev_cursor: 'prev',
      total_count: 100,
      has_more: true,
    });
    const out = roundTrip(ListResponseMeta, original) as Record<string, unknown>;
    expect(out.limit).toBe(20);
    expect(out.has_more).toBe(true);
    expect(out.total_count).toBe(100);
  });
});

describe('Metadata', () => {
  it('round-trips public/private/unsafe Struct fields independently', () => {
    const Struct = proto.google.protobuf.Struct;
    const publicStruct = Struct.create({ fields: { plan: { stringValue: 'pro' } } });
    const privateStruct = Struct.create({ fields: { stripe_id: { stringValue: 'cus_xyz' } } });
    const unsafeStruct = Struct.create({ fields: { theme: { stringValue: 'dark' } } });
    const original = Metadata.create({ public: publicStruct, private: privateStruct, unsafe: unsafeStruct });
    const buf = Metadata.encode(original).finish();
    const decoded = Metadata.decode(buf);
    expect(decoded.public).toBeTruthy();
    expect(decoded.private).toBeTruthy();
    expect(decoded.unsafe).toBeTruthy();
  });
});
