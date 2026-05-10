# @rntme/bundle-publish

Generic publishing primitive for prebuilt static folders. It walks a folder, creates deterministic tar bytes, gzips them, computes sha256 over the gzip artifact, and uploads the bundle to an S3-compatible target.

This package is publish-side tooling. It does not know about the marketing-site contract and it does not fetch, verify, build images, or deploy services.

## Layout

- `src/walk.ts` - recursive sorted folder walker with ignore globs and max-byte enforcement.
- `src/tar-deterministic.ts` - deterministic tar+gzip bundle builder.
- `src/hash.ts` - sha256 helper.
- `src/s3-put.ts` - narrow S3 PutObject wrapper.
- `src/publish-folder.ts` - `publishFolder()` orchestration.
- `src/types.ts` - `PublishTarget`, `S3Reference`, options, result, and error types.
- `test/unit/` - walker, tar determinism, hash, and publish orchestration tests.
- `test/integration/minio.test.ts` - MinIO-gated integration placeholder.

## Public API

```ts
import { publishFolder, type S3Reference } from '@rntme/bundle-publish';

const result = await publishFolder(
  'demo/cv-extract-blueprint/landing',
  { kind: 's3', bucket: 'cv-extract', endpoint: 'http://localhost:9000' },
  { keyPrefix: 'landings/cv-extract' },
);
```

On success, `publishFolder()` returns:

- `ref.bucket`
- `ref.key`
- `ref.sha256`
- optional `ref.endpoint`
- optional `ref.region`
- uploaded byte count and duration metadata

The content-addressable key defaults to `bundles/<folder-name>/<sha256>.tar.gz` unless `keyPrefix` is supplied.

## Error Codes

- `BUNDLE_PUBLISH_FOLDER_MISSING`
- `BUNDLE_PUBLISH_TOO_LARGE`
- `BUNDLE_PUBLISH_NO_INDEX_HTML`
- `BUNDLE_PUBLISH_S3_CREDS_MISSING`
- `BUNDLE_PUBLISH_S3_PUT_FAILED`

Errors return a local `Result` shape and are not thrown for expected publish failures.

## Determinism

- File entries are sorted by relative path.
- Tar file metadata uses `mtime = 0`, `uid = 0`, `gid = 0`, `mode = 0644`, empty user/group names, and file entries only.
- The sha256 is computed over the gzipped tar artifact that is uploaded to S3.

## Commands

- `bun test`
- `bun run build`
- `bun run typecheck`
- `bun run lint`

## Gotchas

- `index.html` must exist at the folder root.
- Credentials come from the AWS SDK default provider chain.
- Ignore globs are intentionally minimal: `*` matches a single path segment and `**` matches across path separators.
