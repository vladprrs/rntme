import { Buffer } from 'node:buffer';
import * as grpc from '@grpc/grpc-js';
import { describe, expect, it } from 'bun:test';
import { proto, SessionStatus, TokenType } from '@rntme/contracts-identity-v1';
import { createIdentityAuth0GrpcServer } from '../../src/server.js';
import type { Auth0IdentityModule } from '../../src/server.js';

const idv1 = proto.rntme.contracts.identity.v1;

function callIntrospectSession(address: string, input: object): Promise<object> {
  const client = new grpc.Client(address, grpc.credentials.createInsecure());
  return new Promise((resolve, reject) => {
    client.makeUnaryRequest(
      '/rntme.contracts.identity.v1.IdentityModule/IntrospectSession',
      (value: object) => Buffer.from(idv1.IntrospectSessionRequest.encode(idv1.IntrospectSessionRequest.fromObject(value)).finish()),
      (bytes: Buffer) => idv1.Session.toObject(idv1.Session.decode(bytes), { defaults: true }),
      input,
      (error, response) => {
        client.close();
        if (error) reject(error);
        else resolve(response ?? {});
      },
    );
  });
}

describe('identity-auth0 gRPC server', () => {
  it('serves the canonical IdentityModule IntrospectSession RPC', async () => {
    const module: Auth0IdentityModule = {
      IntrospectSession: async (request) => ({
        session_id: `session:${(request as { token?: string }).token ?? ''}`,
        user_id: 'auth0|user-1',
        token_type: TokenType.TOKEN_TYPE_JWT_ACCESS,
        status: SessionStatus.SESSION_STATUS_ACTIVE,
        expires_at: { seconds: 1_900_000_000, nanos: 0 },
        issued_at: null,
        last_seen_at: null,
        ip: '',
        user_agent: '',
        organization_id: '',
        vendor: 'auth0',
        vendor_raw: { claims: { aud: (request as { audience?: string }).audience } },
      }),
    };
    const server = createIdentityAuth0GrpcServer({ module, port: 0, host: '127.0.0.1' });
    const { port } = await server.listen();

    try {
      const result = await callIntrospectSession(
        `127.0.0.1:${port}`,
        { token: 'token-1', audience: 'https://notes-demo.rntme.com/api' },
      );

      expect(result).toEqual(expect.objectContaining({
        session_id: 'session:token-1',
        user_id: 'auth0|user-1',
        status: SessionStatus.SESSION_STATUS_ACTIVE,
        vendor_raw: {
          fields: {
            claims: {
              structValue: {
                fields: {
                  aud: { stringValue: 'https://notes-demo.rntme.com/api' },
                },
              },
            },
          },
        },
      }));
    } finally {
      await server.stop();
    }
  });
});
