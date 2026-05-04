# @rntme/contracts-module-v1

Module manifest contract for rntme. Defines the JSON shape every module exposes via `module.json` — capabilities, secrets, edge auth, client block, provisioner block — plus the zod schemas and a `parseModuleManifest` helper.

## File map

- `src/manifest-shape.ts` — zod schemas + types + `parseModuleManifest`.
- `src/index.ts` — public re-exports.

## Quick start

```ts
import { parseModuleManifest, type ModuleManifest } from '@rntme/contracts-module-v1';

const result = parseModuleManifest(rawJson);
if (!result.ok) {
  // result.errors is a Result<T> error list
}
```

## API

Schemas: `ModuleManifestSchema`, `EdgeAuthDescriptorSchema`, `ModuleCapabilitiesSchema`, `ModuleSecretSchema`, `ProvisionerBlockSchema`, `ProvisionerProducesSchema`, `ProvisionerRequiresSchema`.

Types: `ModuleManifest`, `EdgeAuthDescriptor`, `ModuleCapabilities`, `ModuleSecret`, `ProvisionerBlock`, `ProvisionerProduces`, `ProvisionerRequires`, `ClientBlock`, `ComponentDeclaration`, `OperationDeclaration`, `PropSchema`, `ModuleManifestError`, `ModuleManifestResult`.

Functions: `parseModuleManifest`.

## Invariants & gotchas

- This package owns only the **JSON declarative shape** of a manifest. The runtime contract for provisioners (what code a provisioner implements) lives in `@rntme/contracts-provisioner-v1`. Do not put runtime types here.
- `parseModuleManifest` returns `Result<ModuleManifest, ModuleManifestError>` — never throws.

## Out of scope

- Provisioner runtime contract (see `contracts-provisioner-v1`).
- Module client runtime APIs (see `contracts-client-runtime-v1`).
- Example handlers / scaffolding (see `module-scaffold`).

## Where to look first

`manifest-shape.ts` → `parseModuleManifest`.

## Specs

- `docs/superpowers/specs/2026-05-04-platform-contracts-extraction-design.md` — extraction rationale.
- `docs/superpowers/specs/done/2026-04-23-project-first-blueprint-design.md` — manifest shape origin.
