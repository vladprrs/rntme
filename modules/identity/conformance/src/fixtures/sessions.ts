import { proto } from '@rntme/contracts-identity-v1';
import { fixtureRef } from './ref.js';

const id = proto.rntme.contracts.identity.v1;

export const fixtureSessions = {
  activeAdaBrowser: id.Session.create({
    ref: fixtureRef('sess-ada-active', 'fixt_sess_ada_active'),
    session_id: 'sess_ada_active',
    user_id: 'user-ada',
    organization_id: 'org-acme',
    token_type: id.TokenType.TOKEN_TYPE_OPAQUE_SESSION,
    roles: ['admin'],
    permissions: ['users:read', 'orgs:write'],
    verified_factors: ['password', 'webauthn'],
    status: id.SessionStatus.SESSION_STATUS_ACTIVE,
    ip_address: '203.0.113.10',
    user_agent: 'rntme-fixture-browser/1.0',
  }),
  expiredBobMobile: id.Session.create({
    ref: fixtureRef('sess-bob-expired', 'fixt_sess_bob_expired'),
    session_id: 'sess_bob_expired',
    user_id: 'user-bob',
    organization_id: 'org-acme',
    token_type: id.TokenType.TOKEN_TYPE_OPAQUE_SESSION,
    roles: ['member'],
    status: id.SessionStatus.SESSION_STATUS_EXPIRED,
    ip_address: '203.0.113.20',
    user_agent: 'rntme-fixture-mobile/1.0',
  }),
  revokedServiceToken: id.Session.create({
    ref: fixtureRef('sess-service-revoked', 'fixt_sess_service_revoked'),
    session_id: 'sess_service_revoked',
    user_id: 'user-ada',
    organization_id: 'org-initech',
    token_type: id.TokenType.TOKEN_TYPE_JWT_ACCESS,
    permissions: ['identity:admin'],
    status: id.SessionStatus.SESSION_STATUS_REVOKED,
    ip_address: '203.0.113.30',
    user_agent: 'rntme-fixture-service/1.0',
  }),
} as const;
