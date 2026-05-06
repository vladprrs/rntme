import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { emitProto } from '../../src/emit/emit-proto.js';
import { minimalValidated, minimalShapeRegistry } from '../fixtures/minimal-bindings.js';
import type { ResolvedShape } from '@rntme/bindings';

const here = dirname(fileURLToPath(import.meta.url));
const goldenPath = resolve(here, '../fixtures/golden/minimal.proto');

describe('emitProto', () => {
  it('produces byte-identical .proto for the minimal fixture', () => {
    const actual = emitProto(minimalValidated, minimalShapeRegistry, {
      packageName: 'rntme.minimal.v1',
      serviceName: 'MinimalService',
    });
    const expected = readFileSync(goldenPath, 'utf8');
    expect(actual).toBe(expected);
  });

  it('does not leak fixture path in the generated proto header', () => {
    const out = emitProto(minimalValidated, minimalShapeRegistry, {
      packageName: 'x.y',
      serviceName: 'Svc',
    });
    expect(out).not.toContain('packages/runtime/bindings-grpc/test/fixtures/golden/minimal.proto');
  });

  it('emits every operation response as a Struct result payload', () => {
    const out = emitProto(minimalValidated, minimalShapeRegistry, {
      packageName: 'x.y',
      serviceName: 'Svc',
    });
    expect(out).toContain('import "google/protobuf/struct.proto";');
    expect(out).toContain('message ListOrdersResponse {');
    expect(out).toContain('message CreateOrderResponse {');
    expect(out).toContain('google.protobuf.Struct result = 1;');
    expect(out).not.toContain('message CommandResult {');
  });

  it('does not treat result shapes as RPC response messages', () => {
    const orderResultShape: ResolvedShape = {
      name: 'CreateOrderResult',
      origin: 'custom',
      fields: {
        reserved: { type: { kind: 'scalar', primitive: 'boolean' }, nullable: false },
      },
    };
    const out = emitProto(
      minimalValidated,
      { ...minimalShapeRegistry, CreateOrderResult: orderResultShape },
      { packageName: 'x.y', serviceName: 'Svc' },
    );

    expect(out).toContain('message CreateOrderResult {');
    expect(out).toContain('message CreateOrderResponse {');
    expect(out).toContain('google.protobuf.Struct result = 1;');
  });

  it('emits arbitrary JSON shape fields as protobuf Value', () => {
    const jsonShape: ResolvedShape = {
      name: 'AuditPayload',
      origin: 'custom',
      fields: {
        metadata: { type: { kind: 'json' }, nullable: true },
      },
    };

    const out = emitProto(
      minimalValidated,
      { ...minimalShapeRegistry, AuditPayload: jsonShape },
      { packageName: 'x.y', serviceName: 'Svc' },
    );

    expect(out).toContain('import "google/protobuf/struct.proto";');
    expect(out).toContain('message AuditPayload {');
    expect(out).toContain('google.protobuf.Value metadata = 1;');
  });
});
