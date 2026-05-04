# @rntme/platform-storage

Postgres (Drizzle + RLS) and rustfs (S3-compatible) adapters that implement the repository and blob-store interfaces declared in `@rntme/platform-core`.

## Deploy storage

Deploy targets and deployment records live in Postgres with tenant RLS:

- `deploy_target` stores Dokploy endpoint/project metadata, event-bus config,
  policy values, default-target state, and AES-GCM encrypted API tokens.
- `deployment` stores queue/run/final status, rendered plan digest, apply
  result, verification report, warnings, errors, and heartbeat timestamps.
- `deployment_log_line` stores append-only sanitized executor logs with bounded
  message length.

`AesGcmSecretCipher.fromEnv(env)` reads `PLATFORM_SECRET_ENCRYPTION_KEY`
(64 hex chars) and implements the `SecretCipher` seam from
`@rntme/platform-core`.

For key rotation, construct a key ring with the new current key and any retained
previous keys:

```ts
const cipher = AesGcmSecretCipher.fromKeyRing({
  current: { version: 2, keyHex: process.env.PLATFORM_SECRET_ENCRYPTION_KEY_V2! },
  previous: [{ version: 1, keyHex: process.env.PLATFORM_SECRET_ENCRYPTION_KEY_V1! }],
});
```

New secrets are encrypted with `current.version`; decrypt selects the key by the
stored `keyVersion`. Keep previous keys configured until every stored secret has
been re-encrypted with the current version.

## Project operation storage

Migration `0007_project_operations.sql` adds `project.status`,
`project_operation`, and `project_operation_log_line`. Operation rows are
tenant-isolated with RLS, include queue/run/final timestamps, and are protected
by a partial unique index so only one live operation can exist for a project.

`platform_app` needs `USAGE` on the enum types created for project lifecycle
and operation state. The migration and test harness grant this explicitly.

## Transaction helper contract

`withTransaction(pool, orgId, fn)` opens one Postgres transaction, applies the
RLS `app.org_id` setting when `orgId` is present, and releases the client after
commit or rollback. It commits non-`Result` callback values and `Result.ok`
values. If the callback returns the platform `Result.err` shape
(`{ ok: false, errors: [...] }`), the helper rolls back and returns that error
result unchanged. Thrown exceptions also roll back before the exception is
re-thrown to the caller.
