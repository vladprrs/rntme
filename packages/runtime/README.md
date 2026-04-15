# @rntme/runtime

Zero-code runtime for an rntme service. Consumes a directory of validated JSON artifacts — PDM, QSM, graphs, bindings, UI, plus a `manifest.json` — and exposes the corresponding HTTP surface (bindings + SPA + OpenAPI + `/health` + `/metrics`).

## Usage — mount artifacts into the base image

```bash
docker run --rm -p 3000:3000 \
  -v "$(pwd)/artifacts:/srv/artifacts:ro" \
  ghcr.io/vladprrs/rntme-runtime:1.0
```

The artifacts directory must contain:

```
artifacts/
  manifest.json
  pdm.json qsm.json bindings.json shapes.json ui.json
  graphs/*.json
```

## Usage — bake artifacts into your own image

Copy `node_modules/@rntme/runtime/Dockerfile.template` next to your artifacts, then:

```bash
docker build -t myorg/my-service:1.0.0 .
```

## Embedding

```ts
import { loadService, startService } from '@rntme/runtime';

const loaded = loadService('./artifacts');
if (!loaded.ok) {
  console.error(loaded.errors);
  process.exit(1);
}
const running = await startService(loaded.value);
// running.httpPort, running.stop()
```

## `manifest.json`

See the design doc `docs/superpowers/specs/2026-04-15-runtime-packaging-design.md` §4.1 for the authoritative schema.

## CLI

- `rntme-runtime start <dir>` — boot the service (Docker ENTRYPOINT).
- `rntme-runtime validate <dir>` — parse + validate all artifacts and exit; useful in CI.

## Plugin seams

- `DbDriver` / `EventBus` / `Surface` interfaces are exported from the package. MVP ships `BetterSqliteDriver`, `InMemoryBus`, `HttpSurface`. Future packages (`@rntme/bus-kafka`, `@rntme/db-turso`, `@rntme/bindings-grpc`) implement these and plug in via `RuntimeConfig`.
