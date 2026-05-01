# Dependency Research: @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner

Researched: 2026-04-28
Repository: /home/coder/work/rntme
Domain/ecosystem: npm/aws-cloud-sdk
Current version(s) in rntme: ^3.650.0 (packages/platform-storage package.json; S3/blob storage and presigned URL code)
Latest stable version: 3.1038.0 (released 2026-04-27)
Confidence: HIGH

## User Constraints
- Goal: understand current dependencies and migrate rntme to latest safe versions later.
- Output must be written to `docs/research/aws-sdk-client-s3-plus-aws-sdk-s3-request-presigner/README.md`.
- Research-only: do not perform dependency upgrades or runtime code migrations in this issue.
- Look for better-suited libraries/solutions, not only latest version of the current choice.
- Use authoritative current sources: Context7 where applicable, official docs/changelog/releases, npm/GitHub/container registry, migration guides, security advisories.

## Summary

The rntme project currently uses `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` at version `^3.650.0` (resolved to `3.1038.0` in the lockfile) for S3-compatible blob storage operations within the `platform-storage` package. The AWS SDK for JavaScript v3 is the industry-standard, officially maintained SDK for AWS services. It is actively developed with daily releases and follows a monorepo pattern where all service clients share a common runtime infrastructure.

The latest stable version is `3.1038.0` (released 2026-04-27), which is **388 patch versions ahead** of the declared minimum `3.650.0`. However, due to the caret (`^`) range, pnpm already resolves to the latest version in the lockfile. The primary value of upgrading the declared range is ensuring new installs get the latest code and documenting the intent.

For rntme's use case—S3-compatible blob storage with presigned URLs—the AWS SDK v3 remains the correct choice. It is the only library that provides first-class TypeScript support, official AWS API parity, presigned URL generation, and compatibility with S3-compatible backends (MinIO, Wasabi, Cloudflare R2, etc.) through custom endpoints. The main alternative, `minio`, is also excellent but is a separate client library rather than a drop-in AWS SDK replacement; switching would require rewriting the `S3BlobStore` adapter entirely without significant gain.

Primary recommendation: **KEEP + UPGRADE** — bump the declared dependency range to `^3.1038.0` (or latest at migration time) and add `@aws-sdk/lib-storage` for future multipart upload needs. No breaking changes affect rntme's current usage.

## Current Usage in rntme

| Package / image / tool | Current version | Used by | Source file(s) | Runtime/dev/build/test | Notes |
|---|---:|---|---|---|---|
| `@aws-sdk/client-s3` | `^3.650.0` (lockfile: `3.1038.0`) | `platform-storage` | `packages/platform/platform-storage/src/blob/s3-blob-store.ts` | runtime | S3 client for blob operations |
| `@aws-sdk/s3-request-presigner` | `^3.650.0` (lockfile: `3.1038.0`) | `platform-storage` | `packages/platform/platform-storage/src/blob/s3-blob-store.ts` | runtime | Presigned URL generation |

**Commands used to verify usage:**
```bash
# Find package.json references
grep -r "@aws-sdk/client-s3\|@aws-sdk/s3-request-presigner" packages/platform/platform-storage/package.json

# Find source imports
grep -r "from '@aws-sdk/client-s3'\|from '@aws-sdk/s3-request-presigner'" packages/platform/platform-storage/src/

# Check lockfile resolved version
grep -A2 "@aws-sdk/client-s3" pnpm-lock.yaml
```

**Runtime usage:**
- `S3Client` initialized with custom endpoint, path-style URLs, and static credentials
- Commands used: `PutObjectCommand`, `GetObjectCommand`, `HeadObjectCommand`, `CreateBucketCommand`, `HeadBucketCommand`
- Presigned URLs via `getSignedUrl` from `@aws-sdk/s3-request-presigner`
- Target: S3-compatible backends (AWS S3, MinIO in tests, potentially others)

## Latest Versions / Release State

| Channel | Version | Release date | Source | Notes |
|---|---|---|---|---|
| Latest stable | `3.1038.0` | 2026-04-27 | [npm](https://www.npmjs.com/package/@aws-sdk/client-s3) | Daily releases; active development |
| Current in lockfile | `3.1038.0` | 2026-04-27 | pnpm-lock.yaml | Already resolved to latest |
| Declared minimum | `3.650.0` | 2024-08-?? | package.json | 388 versions behind |
| Node.js engines | `>=20.0.0` | — | package.json | Since ~3.700; current rntme on Node 20 |

**Release cadence:** AWS SDK v3 releases daily (automated from AWS API updates). Most releases are "version bump only" with no client-s3-specific changes. S3-specific features are added every 2–4 weeks.

**Recent S3-specific features (relevant to rntme):**
- `3.1035.0` (2026-04-22): Five additional checksum algorithms (MD5, SHA-512, XXHash3, XXHash64, XXHash128); S3 Inventory on directory buckets
- `3.832.0` (2025-06-18): `RenameObject` API support
- `3.729.0` (2025-01-15): CRC64NVME checksum algorithm, full object checksums for multipart uploads, new default integrity protections
- `3.700.0` (2024-11-25): ETag-based conditional writes in `PutObject` and `CompleteMultipartUpload`
- `3.698.0` (2024-11-21): Conditional deletes, write offset bytes for append operations

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| `@aws-sdk/client-s3` | `^3.1038.0` | S3 API client | Official AWS SDK; only first-class TypeScript support; S3-compatible backend support via custom endpoints |
| `@aws-sdk/s3-request-presigner` | `^3.1038.0` | Presigned URL generation | Official companion package; same signing logic as client |
| `@aws-sdk/lib-storage` | `^3.1038.0` | Multipart upload helper | Recommended for uploads >100MB; handles part sizing, retry, progress |

### Supporting

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `@aws-sdk/credential-providers` | `^3.1038.0` | Credential chain resolution | When using IAM roles, SSO, or environment credentials instead of static keys |
| `@smithy/types` | (transitive) | Shared Smithy types | Already included; provides `SdkError`, `MetadataBearer` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Recommendation for rntme |
|---|---|---|---|
| `@aws-sdk/client-s3` | `minio` (`^8.0.7`) | MinIO client is lighter but only supports S3-compatible APIs; no direct AWS S3 advanced features | **Stay with AWS SDK** — rntme needs generic S3 compatibility, not MinIO-specific features |
| `@aws-sdk/client-s3` | `aws-sdk` v2 (`^2.x`) | v2 is bundled and heavy (~40MB); v3 is modular (~100KB for single client) | **Already on v3** — correct choice |
| `@aws-sdk/s3-request-presigner` | Hand-rolled presigner | High complexity; signature v4 is error-prone | **Keep official package** |
| `@aws-sdk/lib-storage` | Hand-rolled multipart upload | Part sizing, retry, abort logic is complex | **Add when needed** |

Installation / upgrade commands, if eventually recommended:
```bash
# Upgrade existing packages
pnpm add @aws-sdk/client-s3@^3.1038.0 @aws-sdk/s3-request-presigner@^3.1038.0

# Add multipart upload helper for future use
pnpm add @aws-sdk/lib-storage@^3.1038.0
```

## Architecture Patterns

### System Architecture Diagram

```mermaid
flowchart LR
    Blueprint[Blueprint / Service Config] -->|blob storage config| PlatformStorage[platform-storage adapter]
    PlatformStorage -->|S3BlobStore opts| S3Client[S3Client @aws-sdk/client-s3]
    S3Client -->|HTTP/S| S3Endpoint[S3-compatible endpoint<br/>AWS S3 / MinIO / R2 / Wasabi]
    S3Client -->|signing| Presigner[@aws-sdk/s3-request-presigner]
    Presigner -->|presigned GET URL| Consumer[API consumer / browser]
    S3Endpoint -->|GET/PUT/HEAD| BlobData[(Blob data)]
```

### Component Responsibilities

| Component | Responsibility | Implementation mapping | Notes |
|---|---|---|---|
| `S3BlobStore` | Adapter implementing `BlobStore` interface | `packages/platform/platform-storage/src/blob/s3-blob-store.ts` | Wraps AWS SDK; handles errors as `PlatformError` |
| `S3Client` | Low-level S3 API client | `@aws-sdk/client-s3` | Configured with custom endpoint, path-style, static credentials |
| `getSignedUrl` | Presigned URL generation | `@aws-sdk/s3-request-presigner` | Uses same client config for signing |
| `BlobStore` interface | Abstract blob storage contract | `platform-core` | Allows swapping S3 for local filesystem or other backends |

### Recommended Project Structure

```text
src/
├── blob/
│   ├── s3-blob-store.ts       # S3 adapter (current)
│   ├── local-blob-store.ts    # Local filesystem adapter (future)
│   └── index.ts               # BlobStore factory / exports
├── repos/
│   └── ...                    # Repositories using BlobStore interface
```

### Pattern 1: S3-Compatible Backend with Custom Endpoint

What: Configure `S3Client` with a custom endpoint and `forcePathStyle: true` to work with MinIO, LocalStack, or other S3-compatible services.

When to use: All rntme deployments that use non-AWS S3 backends; required for MinIO in tests.

Example:
```ts
// Source: packages/platform/platform-storage/src/blob/s3-blob-store.ts
const client = new S3Client({
  endpoint: opts.endpoint,
  region: opts.region ?? 'us-east-1',
  forcePathStyle: true,
  credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
});
```

### Pattern 2: Presigned URL for Secure Direct Access

What: Generate time-limited presigned URLs so consumers can access blobs directly from S3 without proxying through rntme.

When to use: Serving blueprint bundles, artifacts, or user uploads to browsers/API consumers.

Example:
```ts
// Source: packages/platform/platform-storage/src/blob/s3-blob-store.ts
const cmd = new GetObjectCommand({ Bucket: this.opts.bucket, Key: key });
const url = await getSignedUrl(this.client, cmd, { expiresIn: expiresSeconds });
```

### Anti-Patterns to Avoid

- **Hard-coding AWS regions or endpoints in source**: Always inject via configuration/environment.
- **Using `S3` aggregated client instead of `S3Client`**: The aggregated client imports all commands, bloating bundle size. Use modular `S3Client` + individual commands.
- **Not handling `Body` stream correctly**: In v3, `Body` is a stream; use `transformToByteArray()` or `transformToString()` rather than manual stream consumption.
- **Ignoring checksums**: Since v3.729.0, default integrity protections apply. For custom use cases, explicitly set `ChecksumAlgorithm` rather than disabling checks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| S3 presigned URL generation | Custom HMAC-SHA256 signing | `@aws-sdk/s3-request-presigner` | Signature v4 is complex; SDK handles credential scope, signed headers, expiry, and URL encoding correctly |
| Multipart upload | Manual `UploadPart` orchestration | `@aws-sdk/lib-storage` | Handles part size calculation (5MB–5GB), concurrent uploads, retry, abort, and progress events |
| S3 error parsing | Regex on HTTP responses | SDK built-in error types | SDK deserializes AWS XML errors into typed exceptions with `$metadata` |
| Credential rotation | File watcher or cron | `@aws-sdk/credential-providers` | Supports IAM roles, SSO, STS, environment variables, and automatic refresh |

Key insight: The AWS SDK v3 abstracts thousands of edge cases in S3 API behavior, endpoint resolution, signing, retry, and error handling. Custom implementations inevitably miss critical details like dual-stack endpoints, regional endpoint variants, or checksum validation.

## Common Pitfalls

### Pitfall 1: Version Drift in Monorepo

What goes wrong: Multiple packages declare different `@aws-sdk/*` versions, causing duplicate transitive dependencies and type conflicts.

Why it happens: AWS SDK v3 has ~50 shared sub-packages (`@aws-sdk/core`, `@smithy/*`, etc.). Mismatched versions lead to multiple copies in `node_modules`.

How to avoid: Use pnpm catalog or workspace-wide overrides to enforce a single AWS SDK version across all packages.

Warning signs: `pnpm why @aws-sdk/client-s3` shows multiple versions; TypeScript errors about incompatible types between SDK packages.

### Pitfall 2: Node.js Engine Requirement Bump

What goes wrong: CI or production runs on Node 18, but recent AWS SDK requires Node `>=20.0.0`.

Why it happens: AWS SDK v3 dropped Node 16/18 support in 2025; latest versions require Node 20+.

How to avoid: Pin to a compatible version if stuck on older Node, or upgrade Node before upgrading AWS SDK. rntme is on Node 20 (see [docker-node-20-alpine-slim-runtime-images research](./docker-node-20-alpine-slim-runtime-images/README.md) for urgent Node 22 migration).

Warning signs: `ERR_REQUIRE_ESM` or `SyntaxError` in CI; `engines` warning during `pnpm install`.

### Pitfall 3: Presigned URL Expiry and Clock Skew

What goes wrong: Presigned URLs rejected as expired even though `expiresIn` is valid.

Why it happens: Clock skew between rntme server and S3 backend exceeds the expiry window.

How to avoid: Use NTP on all hosts; set `expiresIn` with buffer (e.g., 300s for a 60s need); handle `403` with retry and fresh URL generation.

Warning signs: Intermittent `403 SignatureDoesNotMatch` or `403 RequestTimeTooSkewed` errors.

## Code Examples

### Basic PutObject with Content-Type

```ts
// Source: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/PutObjectCommand/
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const client = new S3Client({ region: "us-east-1" });
const command = new PutObjectCommand({
  Bucket: "my-bucket",
  Key: "hello.txt",
  Body: "Hello World",
  ContentType: "text/plain",
});
await client.send(command);
```

### Presigned GET URL

```ts
// Source: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-s3-request-presigner/
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const client = new S3Client({ region: "us-east-1" });
const command = new GetObjectCommand({ Bucket: "my-bucket", Key: "hello.txt" });
const url = await getSignedUrl(client, command, { expiresIn: 3600 });
```

### Multipart Upload with Progress (Recommended for Large Files)

```ts
// Source: https://github.com/aws/aws-sdk-js-v3/tree/main/lib/lib-storage
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const client = new S3Client({ region: "us-east-1" });
const upload = new Upload({
  client,
  params: { Bucket: "my-bucket", Key: "large.zip", Body: fileStream },
  queueSize: 4, // concurrent upload parts
  partSize: 5 * 1024 * 1024, // 5MB
});

upload.on("httpUploadProgress", (progress) => {
  console.log(`Uploaded ${progress.loaded}/${progress.total}`);
});

await upload.done();
```

## State of the Art (2024–2026)

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| AWS SDK v2 (`aws-sdk` monolith) | AWS SDK v3 modular packages | 2020+ | 40MB → ~100KB per client; tree-shakable |
| Manual multipart upload | `@aws-sdk/lib-storage` | 2021+ | Reliable large-file uploads with progress |
| Signature v2 presigned URLs | Signature v4 | 2014+ | Required in all regions; v2 deprecated |
| Static credentials in code | IAM roles / credential providers | 2020+ | Better security; automatic rotation |
| Path-style URLs | Virtual-hosted-style URLs | 2020+ | Path-style still needed for MinIO; `forcePathStyle` |
| MD5 checksums | CRC64NVME, SHA-512, XXHash | 2025-01 | Faster, more reliable integrity checks |

New tools/patterns to consider:
- **S3 Express One Zone (directory buckets)**: Low-latency S3 for high-throughput workloads; not relevant for rntme currently.
- **S3 Metadata tables (Iceberg)**: Queryable object metadata; could be useful for blueprint artifact indexing in future.
- **Conditional writes via ETag**: Safe concurrent upload semantics; useful if rntme ever needs atomic blob updates.

Deprecated/outdated:
- AWS SDK v2: Maintenance mode; no new features.
- Signature v2: Disabled in all modern regions.
- Node 16/18 support in AWS SDK v3: Dropped in 2025.

## Migration Assessment

| Area | Finding | Impact | Risk | Evidence |
|---|---|---|---|---|
| Breaking changes | None affecting rntme's usage | Low | Low | Changelog reviewed; rntme uses basic PutObject/GetObject/HeadObject/presigner |
| API surface | Stable; command-based API unchanged since v3 launch | Low | Low | Official v3 API Reference |
| Type compatibility | Full TypeScript support; no type changes in used APIs | Low | Low | Source analysis |
| Bundle size | Already minimal (modular imports) | Low | Low | Tree-shaking verified |
| Node.js engines | Latest requires `>=20.0.0`; rntme on Node 20 | Medium | Medium | Node 20 EOL 2026-04-30; see docker-node runtime research |
| Security posture | Regular updates; no known CVEs in 3.650.0–3.1038.0 | Low | Low | npm audit / GitHub Security Advisories |
| Test impact | None; tests use MinIO via custom endpoint | Low | Low | `s3-blob-store.test.ts` analysis |
| Effort | Bump version range in package.json; run tests | Very Low | Very Low | No code changes required |

**Migration path:**
1. Update `package.json` range from `^3.650.0` to `^3.1038.0` (or latest at migration time).
2. Run `pnpm install` to update lockfile.
3. Run `pnpm test` in `platform-storage`.
4. Optional: Add `@aws-sdk/lib-storage` for future multipart upload needs.

## Recommendation

**Decision:** KEEP + UPGRADE

**Rationale:**
- `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` are the correct, industry-standard choices for S3-compatible blob storage.
- No better-suited alternative exists for rntme's requirement of generic S3 compatibility with presigned URLs.
- The lockfile already resolves to `3.1038.0`, so runtime behavior is current. The declared range should be bumped for clarity and reproducibility.
- No breaking changes affect rntme's limited API surface (PutObject, GetObject, HeadObject, presigned GET).
- Node 20 compatibility is confirmed, but Node 20 EOL is 2026-04-30 — coordinate AWS SDK upgrade with Node runtime upgrade.

**Follow-up tasks to create later:**
- [ ] Bump `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` to `^3.1038.0` in `packages/platform/platform-storage/package.json`
- [ ] Evaluate adding `@aws-sdk/lib-storage` for multipart upload support in blueprint bundle uploads
- [ ] Coordinate with Node 22 runtime migration (see RNT-316 / docker-node runtime research)
- [ ] Add integration test for presigned URL expiry validation

## Open Questions

1. **Should rntme support multipart uploads for large blueprint bundles?**
   - What we know: `@aws-sdk/lib-storage` is the standard helper; current `putIfAbsent` loads entire blob into memory.
   - What's unclear: Maximum expected blueprint bundle size; whether streaming upload is needed.
   - Recommendation: Add `@aws-sdk/lib-storage` preemptively if bundles may exceed 100MB; otherwise defer.

2. **Should rntme support IAM role-based credentials instead of static keys?**
   - What we know: Current `S3BlobStoreOpts` requires `accessKeyId` and `secretAccessKey`.
   - What's unclear: Whether production deployments use IAM roles (EKS, ECS, EC2 instance profiles).
   - Recommendation: Add optional credential chain support via `@aws-sdk/credential-providers` for cloud-native deployments.

3. **Should rntme add checksum validation for blob uploads?**
   - What we know: AWS SDK v3.729.0+ enables default integrity protections; rntme does not explicitly set checksums.
   - What's unclear: Whether S3-compatible backends (MinIO, R2) fully support new checksum algorithms.
   - Recommendation: Test with target backends; explicitly set `ChecksumAlgorithm: "CRC32"` for broad compatibility.

## Sources

### Primary (HIGH confidence)
- [npm @aws-sdk/client-s3](https://www.npmjs.com/package/@aws-sdk/client-s3) — latest version, download stats, engine requirements
- [npm @aws-sdk/s3-request-presigner](https://www.npmjs.com/package/@aws-sdk/s3-request-presigner) — latest version, API docs
- [AWS SDK for JavaScript v3 Developer Guide](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrating-to-v3.html) — migration patterns, modular packages, middleware
- [aws-sdk-js-v3 CHANGELOG.md (raw)](https://raw.githubusercontent.com/aws/aws-sdk-js-v3/main/clients/client-s3/CHANGELOG.md) — version history, features, bug fixes
- [AWS SDK v3 API Reference — S3Client](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/) — command reference, configuration

### Secondary (MEDIUM confidence)
- [GitHub aws-sdk-js-v3](https://github.com/aws/aws-sdk-js-v3) — source code, issue tracker, release notes
- [pnpm lockfile analysis](/home/coder/work/rntme/pnpm-lock.yaml) — resolved version verification
- [rntme source analysis](/home/coder/work/rntme/packages/platform/platform-storage/src/blob/s3-blob-store.ts) — runtime usage patterns

### Tertiary (LOW confidence - needs validation)
- MinIO client (`minio` npm package) — evaluated as alternative; not a drop-in replacement
- Context7 AWS SDK docs — unavailable (quota exceeded); official docs used instead

## Metadata

Research scope:
- Core technology: AWS SDK for JavaScript v3 S3 client and presigner
- Ecosystem: S3-compatible storage (AWS S3, MinIO, Cloudflare R2, Wasabi)
- Patterns: Custom endpoint configuration, presigned URLs, modular imports
- Pitfalls: Version drift, Node engine requirements, clock skew
Confidence breakdown:
- Standard stack: HIGH — official AWS SDK is the undisputed standard
- Architecture: HIGH — directly derived from current rntme usage
- Pitfalls: HIGH — well-documented in AWS SDK issues and changelogs
- Code examples: HIGH — from official AWS docs and rntme source
Research date: 2026-04-28
Valid until: 2026-07-28 (review quarterly due to daily release cadence)
Ready for migration planning: yes
