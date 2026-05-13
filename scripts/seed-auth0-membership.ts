#!/usr/bin/env bun
/**
 * Seed an Auth0 user's membership in an Auth0 Organization.
 *
 * Used by the cv-extract platform deploy E2E goal to ensure the human owner
 * (vladprsib@gmail.com) is a member of `org_uZUWhpWgK54VWC2X` so the platform
 * dashboard at platform.rntme.com lists the deployed project under that org.
 *
 * Idempotent: if the user is already a member, the script exits 0 without
 * modifying anything. A 409 / "already a member" response from Auth0 is
 * treated as success.
 *
 * Required environment variables (loaded from process.env; this script does
 * NOT read .env files itself — invoke it with `bun --env-file=.env`):
 *   AUTH0_DOMAIN                  e.g. rntme.eu.auth0.com (no scheme)
 *   AUTH0_MANAGEMENT_AUDIENCE     e.g. https://rntme.eu.auth0.com/api/v2/
 *   AUTH0_MANAGEMENT_CLIENT_ID    Management API M2M client id
 *   AUTH0_MANAGEMENT_CLIENT_SECRET Management API M2M client secret
 *
 * Required CLI args:
 *   --org=<auth0_org_id>          e.g. org_uZUWhpWgK54VWC2X
 *   --email=<user_email>          e.g. vladprsib@gmail.com (default lookup key)
 *
 * Optional CLI args:
 *   --user-id=<auth0_user_id>     bypass email lookup (use this when the
 *                                 tenant does not expose users-by-email)
 *   --dry-run                     print what would happen, do not call Auth0
 *
 * Required Management API scopes on AUTH0_MANAGEMENT_CLIENT_ID:
 *   - read:users                  to look up the user by email
 *   - read:organization_members   to check current membership
 *   - update:organization_members to add the user to the organization
 *
 * Output (stdout, single JSON line per phase) only prints NON-SECRET data:
 * organizationId, userId, status. No tokens, no secrets, no headers.
 */

type CliArgs = {
  readonly organizationId: string;
  readonly email: string | null;
  readonly userId: string | null;
  readonly dryRun: boolean;
};

function parseArgs(argv: readonly string[]): CliArgs {
  let organizationId: string | null = null;
  let email: string | null = null;
  let userId: string | null = null;
  let dryRun = false;
  for (const raw of argv) {
    if (raw === '--dry-run') {
      dryRun = true;
      continue;
    }
    const eq = raw.indexOf('=');
    if (eq < 0) continue;
    const key = raw.slice(0, eq);
    const value = raw.slice(eq + 1);
    if (key === '--org') organizationId = value;
    else if (key === '--email') email = value;
    else if (key === '--user-id') userId = value;
  }
  if (!organizationId) {
    throw new Error('missing required --org=<auth0_org_id>');
  }
  if (!email && !userId) {
    throw new Error('one of --email=<user_email> or --user-id=<auth0_user_id> is required');
  }
  return { organizationId, email, userId, dryRun };
}

type EnvConfig = {
  readonly domain: string;
  readonly audience: string;
  readonly clientId: string;
  readonly clientSecret: string;
};

function readEnv(env: NodeJS.ProcessEnv): EnvConfig {
  const required = ['AUTH0_DOMAIN', 'AUTH0_MANAGEMENT_AUDIENCE', 'AUTH0_MANAGEMENT_CLIENT_ID', 'AUTH0_MANAGEMENT_CLIENT_SECRET'] as const;
  for (const name of required) {
    if (!env[name] || env[name] === '') {
      throw new Error(`missing required env var: ${name}`);
    }
  }
  return {
    domain: env.AUTH0_DOMAIN!.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    audience: env.AUTH0_MANAGEMENT_AUDIENCE!,
    clientId: env.AUTH0_MANAGEMENT_CLIENT_ID!,
    clientSecret: env.AUTH0_MANAGEMENT_CLIENT_SECRET!,
  };
}

async function fetchManagementToken(env: EnvConfig): Promise<string> {
  const url = `https://${env.domain}/oauth/token`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: env.clientId,
      client_secret: env.clientSecret,
      audience: env.audience,
    }),
  });
  if (!res.ok) {
    // Do NOT include the response body verbatim — it may echo client_id.
    throw new Error(`management token request failed: HTTP ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('management token response missing access_token');
  }
  return data.access_token;
}

type Auth0User = { readonly user_id: string };

async function findUserByEmail(env: EnvConfig, token: string, email: string): Promise<Auth0User | null> {
  const url = `https://${env.domain}/api/v2/users-by-email?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`users-by-email failed: HTTP ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as readonly Auth0User[];
  if (!Array.isArray(data) || data.length === 0) return null;
  // Prefer the first (Auth0 returns multiple if the email is shared across
  // connections). The caller can pass --user-id to disambiguate.
  return { user_id: data[0]!.user_id };
}

type Auth0Member = { readonly user_id: string };

async function fetchOrgMembers(env: EnvConfig, token: string, organizationId: string): Promise<readonly Auth0Member[]> {
  const out: Auth0Member[] = [];
  let from: string | null = null;
  // Use checkpoint pagination via from/take per Auth0 docs.
  for (let i = 0; i < 100; i++) {
    const params = new URLSearchParams();
    params.set('take', '50');
    if (from) params.set('from', from);
    const url = `https://${env.domain}/api/v2/organizations/${encodeURIComponent(organizationId)}/members?${params.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`list org members failed: HTTP ${res.status} ${res.statusText}`);
    }
    const raw = (await res.json()) as unknown;
    if (Array.isArray(raw)) {
      for (const m of raw as readonly Auth0Member[]) out.push({ user_id: m.user_id });
      break;
    }
    const data = raw as { readonly members?: readonly Auth0Member[]; readonly next?: string | null };
    const members = data.members ?? [];
    for (const m of members) out.push({ user_id: m.user_id });
    if (!data.next) break;
    from = data.next;
  }
  return out;
}

async function addOrgMember(
  env: EnvConfig,
  token: string,
  organizationId: string,
  userId: string,
): Promise<'added' | 'already-member'> {
  const url = `https://${env.domain}/api/v2/organizations/${encodeURIComponent(organizationId)}/members`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ members: [userId] }),
  });
  // Auth0 returns 204 on success, 409 (or 400 with conflict body) if already a member.
  if (res.status === 204 || res.status === 201) return 'added';
  if (res.status === 409) return 'already-member';
  if (res.status === 400) {
    const body = (await res.text()).toLowerCase();
    if (body.includes('already a member') || body.includes('member already exists')) {
      return 'already-member';
    }
    throw new Error(`add member failed: HTTP 400 (non-conflict)`);
  }
  throw new Error(`add member failed: HTTP ${res.status} ${res.statusText}`);
}

function printJson(obj: Record<string, unknown>): void {
  // Single-line JSON to stdout for easy log capture.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(obj));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.dryRun) {
    printJson({
      phase: 'dry-run',
      organizationId: args.organizationId,
      lookup: args.userId ? { kind: 'user_id', value: args.userId } : { kind: 'email', value: args.email },
      wouldCallEndpoints: [
        'POST https://<AUTH0_DOMAIN>/oauth/token',
        ...(args.userId ? [] : ['GET https://<AUTH0_DOMAIN>/api/v2/users-by-email?email=<email>']),
        `GET https://<AUTH0_DOMAIN>/api/v2/organizations/${args.organizationId}/members`,
        `POST https://<AUTH0_DOMAIN>/api/v2/organizations/${args.organizationId}/members`,
      ],
    });
    return;
  }

  const env = readEnv(process.env);
  const token = await fetchManagementToken(env);

  let userId = args.userId;
  if (!userId) {
    const lookedUp = await findUserByEmail(env, token, args.email!);
    if (!lookedUp) {
      printJson({
        phase: 'lookup',
        organizationId: args.organizationId,
        status: 'user-not-found',
        email: args.email,
      });
      process.exit(2);
    }
    userId = lookedUp.user_id;
  }

  const members = await fetchOrgMembers(env, token, args.organizationId);
  const alreadyMember = members.some((m) => m.user_id === userId);
  if (alreadyMember) {
    printJson({
      phase: 'ensure',
      organizationId: args.organizationId,
      userId,
      status: 'already-member',
    });
    return;
  }

  const result = await addOrgMember(env, token, args.organizationId, userId);
  printJson({
    phase: 'ensure',
    organizationId: args.organizationId,
    userId,
    status: result,
  });
}

main().catch((err) => {
  // Print message only; never the stack (may include URLs with query strings).
  const message = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ phase: 'error', message }));
  process.exit(1);
});
