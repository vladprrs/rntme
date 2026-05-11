import { Buffer } from 'node:buffer';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ok, err, isOk, type Result, type PlatformError } from '../types/result.js';
import type { ApiToken } from '../schemas/entities.js';
import type { Scope, Role } from '../auth/scopes.js';
import type { AuthSubject } from '../auth/provider.js';
import type { TokenRepo } from '../repos/token-repo.js';
import type { OrganizationRepo } from '../repos/org-repo.js';
import type { AccountRepo } from '../repos/account-repo.js';
import type { MembershipMirrorRepo } from '../repos/membership-mirror-repo.js';
import type { Ids } from '../ids.js';
import { tokenScopesSubsetOf } from '../auth/scopes.js';

type CreatedToken = { readonly token: ApiToken; readonly plaintext: string };

export async function createToken(
  deps: { repos: { tokens: TokenRepo }; ids: Ids },
  input: {
    orgId: string;
    accountId: string;
    name: string;
    scopes: readonly Scope[];
    expiresAt: Date | null;
    creatorScopes: readonly Scope[];
  },
): Promise<Result<CreatedToken, PlatformError>> {
  if (!tokenScopesSubsetOf(input.scopes, input.creatorScopes)) {
    return {
      ok: false,
      errors: [{ code: 'PLATFORM_AUTH_FORBIDDEN', message: 'requested scopes exceed creator scopes' }],
    };
  }
  const plaintext = deps.ids.apiTokenPlaintext();
  const tokenHash = new Uint8Array(createHash('sha256').update(plaintext).digest());
  const prefix = plaintext.slice(0, 12);
  const r = await deps.repos.tokens.create({
    id: deps.ids.uuid(),
    orgId: input.orgId,
    accountId: input.accountId,
    name: input.name,
    tokenHash,
    prefix,
    scopes: input.scopes,
    expiresAt: input.expiresAt,
  });
  if (!isOk(r)) return r;
  return ok({ token: r.value, plaintext });
}

export async function listTokens(
  deps: { repos: { tokens: TokenRepo } },
  input: { orgId: string },
): Promise<Result<readonly ApiToken[], PlatformError>> {
  return deps.repos.tokens.list(input.orgId);
}

export async function revokeToken(
  deps: { repos: { tokens: TokenRepo } },
  input: { orgId: string; id: string },
): Promise<Result<void, PlatformError>> {
  return deps.repos.tokens.revoke(input.orgId, input.id);
}

export type IntrospectTokenDeps = {
  repos: {
    tokens: TokenRepo;
    organizations: OrganizationRepo;
    accounts: AccountRepo;
    memberships: MembershipMirrorRepo;
  };
};

export type IntrospectTokenInput = {
  /** Bearer header value WITH or WITHOUT the leading "Bearer " prefix; both forms accepted. */
  bearerToken: string;
};

const BEARER_PREFIX = 'Bearer ';
const PAT_PREFIX = 'rntme_pat_';

export async function introspectToken(
  args: { deps: IntrospectTokenDeps; input: IntrospectTokenInput },
): Promise<Result<AuthSubject, PlatformError>> {
  const raw = args.input.bearerToken;
  const plain = raw.startsWith(BEARER_PREFIX) ? raw.slice(BEARER_PREFIX.length) : raw;
  if (!plain.startsWith(PAT_PREFIX)) {
    return err([{ code: 'PLATFORM_AUTH_MISSING', message: 'no bearer token' }]);
  }
  const prefix = plain.slice(0, 12);
  const found = await args.deps.repos.tokens.findByPrefix(prefix);
  if (!isOk(found)) return found;
  if (!found.value) {
    return err([{ code: 'PLATFORM_AUTH_INVALID', message: 'token not found' }]);
  }
  const row = found.value;
  if (row.revokedAt) {
    return err([{ code: 'PLATFORM_AUTH_TOKEN_REVOKED', message: 'token revoked' }]);
  }
  if (row.expiresAt !== null && row.expiresAt.getTime() <= Date.now()) {
    return err([{ code: 'PLATFORM_AUTH_TOKEN_EXPIRED', message: 'token expired' }]);
  }
  const expected = Buffer.from(row.tokenHash);
  const actual = createHash('sha256').update(plain, 'utf8').digest();
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return err([{ code: 'PLATFORM_AUTH_INVALID', message: 'token mismatch' }]);
  }

  const orgR = await args.deps.repos.organizations.findById(row.orgId);
  if (!isOk(orgR)) return orgR;
  if (!orgR.value) {
    return err([{ code: 'PLATFORM_AUTH_INVALID', message: 'token org missing' }]);
  }

  const acctR = await args.deps.repos.accounts.findById(row.accountId);
  if (!isOk(acctR)) return acctR;
  if (!acctR.value || acctR.value.deletedAt) {
    return err([{ code: 'PLATFORM_AUTH_INVALID', message: 'token account missing' }]);
  }
  const account = acctR.value;

  const mem = await args.deps.repos.memberships.find(row.orgId, row.accountId);
  if (!isOk(mem)) return mem;
  if (!mem.value) {
    return err([{ code: 'PLATFORM_AUTH_INVALID', message: 'account not a member of organization' }]);
  }
  const role: Role = mem.value.role === 'admin' ? 'admin' : 'member';

  void args.deps.repos.tokens.touchLastUsed(row.id);

  return ok({
    account: {
      id: account.id,
      workosUserId: account.workosUserId,
      displayName: account.displayName,
      email: account.email,
    },
    org: {
      id: orgR.value.id,
      workosOrgId: orgR.value.workosOrganizationId,
      slug: orgR.value.slug,
    },
    role,
    scopes: row.scopes,
    tokenId: row.id,
  });
}
