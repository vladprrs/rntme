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

  it('always emits CommandResult with command_id, correlation_id, and optional result payload', () => {
    const out = emitProto(minimalValidated, minimalShapeRegistry, {
      packageName: 'x.y',
      serviceName: 'Svc',
    });
    expect(out).toContain('import "google/protobuf/struct.proto";');
    expect(out).toContain('message CommandResult {');
    expect(out).toContain('string command_id = 4;');
    expect(out).toContain('string correlation_id = 5;');
    expect(out).toContain('google.protobuf.Struct result = 6;');
  });

  it('does not duplicate CommandResult when shapes already include it', () => {
    const commandResultShape: ResolvedShape = {
      name: 'CommandResult',
      origin: 'custom',
      fields: {
        aggregateId: { type: { kind: 'scalar', primitive: 'string' }, nullable: false },
        version: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
        eventIds: { type: { kind: 'array', element: 'string' }, nullable: false },
      },
    };
    const out = emitProto(
      minimalValidated,
      { ...minimalShapeRegistry, CommandResult: commandResultShape },
      { packageName: 'x.y', serviceName: 'Svc' },
    );

    expect(out.match(/message CommandResult \{/g)).toHaveLength(1);
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
