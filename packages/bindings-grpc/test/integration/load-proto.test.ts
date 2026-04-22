import { describe, it, expect } from 'vitest';
import { loadProtoFromString } from '../../src/server/load-proto.js';

const TINY_PROTO = `
syntax = "proto3";
package rntme.test.v1;
message Echo { string msg = 1; }
service EchoService {
  rpc Send (Echo) returns (Echo);
}
`;

describe('loadProtoFromString', () => {
  it('loads a tiny proto and exposes the service constructor', () => {
    const root = loadProtoFromString(TINY_PROTO, 'rntme.test.v1.EchoService');
    expect(typeof root.service).toBe('object');
    expect(root.messageTypes.Echo).toBeDefined();
  });
});
