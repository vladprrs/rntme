import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import type { E2eEnv } from './harness.js';

export async function seedOrgWithToken(
  env: E2eEnv,
  slug: string,
  workosId: string,
  workosUser: string,
): Promise<{ plain: string; orgId: string }> {
  const org = await env.ownerPool.query<{ id: string }>(
    `INSERT INTO organization (id, workos_organization_id, slug, display_name)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (workos_organization_id) DO UPDATE SET slug=EXCLUDED.slug, display_name=EXCLUDED.display_name
     RETURNING id`,
    [randomUUID(), workosId, slug, slug],
  );
  const acc = await env.ownerPool.query<{ id: string }>(
    `INSERT INTO account (id, workos_user_id, email, display_name)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (workos_user_id) DO UPDATE SET email=EXCLUDED.email, display_name=EXCLUDED.display_name
     RETURNING id`,
    [randomUUID(), workosUser, null, workosUser],
  );
  await env.ownerPool.query(
    `INSERT INTO membership_mirror (org_id, account_id, role)
     VALUES ($1,$2,'admin')
     ON CONFLICT (org_id, account_id) DO UPDATE SET role=EXCLUDED.role, updated_at=now()`,
    [org.rows[0]!.id, acc.rows[0]!.id],
  );
  const plain = 'rntme_pat_' + randomUUID().replace(/-/g, '').slice(0, 22);
  const hash = new Uint8Array(createHash('sha256').update(plain).digest());
  await env.ownerPool.query(
    `INSERT INTO api_token (id, org_id, account_id, name, token_hash, prefix, scopes, expires_at)
     VALUES ($1,$2,$3,'deploy',$4,$5,$6,NULL)`,
    [
      randomUUID(),
      org.rows[0]!.id,
      acc.rows[0]!.id,
      Buffer.from(hash),
      plain.slice(0, 12),
      ['project:read', 'project:write', 'version:publish', 'deploy:target:manage', 'deploy:execute'],
    ],
  );
  return { plain, orgId: org.rows[0]!.id };
}
