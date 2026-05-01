import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import { runIntrospectionHttpConformance } from '@rntme/conformance-identity';
import { createIdentityAuth0HttpServer } from '../../../src/http-server.js';
import { createAuth0IdentityModule } from '../../../src/handlers.js';
import { stubAuth0Adapter } from '../../helpers/stub-auth0-adapter.js';

const audience = 'https://demo.example.com/api';
const issuer = 'https://demo-rntme.us.auth0.com/';

const invalidToken = 'eyJ.bogus.signature';

/** Mutable state that setup/teardown populate and the harness reads lazily via getters. */
const state = {
  baseUrl: '',
  validToken: '',
  server: null as ReturnType<typeof createIdentityAuth0HttpServer> | null,
};

async function setup(): Promise<void> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = 'test-kid';
  publicJwk.use = 'sig';
  publicJwk.alg = 'RS256';
  const localJwks: JWTVerifyGetKey = async (_h, _t) => publicKey;

  const module = createAuth0IdentityModule(stubAuth0Adapter(), {
    auth0Issuer: issuer,
    jwksResolver: localJwks,
  });

  const server = createIdentityAuth0HttpServer({ module, port: 0, host: '127.0.0.1' });
  const { port } = await server.listen();
  state.server = server;
  state.baseUrl = `http://127.0.0.1:${port}`;

  state.validToken = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
    .setIssuer(issuer)
    .setSubject('auth0|alice')
    .setAudience(audience)
    .setExpirationTime('1h')
    .setIssuedAt()
    .sign(privateKey);
}

async function teardown(): Promise<void> {
  if (state.server !== null) {
    await state.server.stop();
    state.server = null;
  }
}

runIntrospectionHttpConformance('identity-auth0', () => ({
  get baseUrl() { return state.baseUrl; },
  get validToken() { return state.validToken; },
  audience,
  invalidToken,
  setup,
  teardown,
}));
