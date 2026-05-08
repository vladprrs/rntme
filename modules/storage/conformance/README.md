# `@rntme/conformance-storage` - Storage v1 conformance UNION

Per-RPC scenario stubs and capability constants for the Storage canonical contract. Imported by every storage vendor module.

The runner does not exist yet. Scenarios ship as `status: 'pending'` stubs until the category framework lands.

## File map

```text
modules/storage/conformance/
├── src/
│   ├── capabilities.ts      # canonical RPC/event/backend constants
│   ├── types.ts             # Scenario, ScenarioContext, CategoryConformanceSuite
│   ├── scenarios/<RPC>.scenarios.ts (x7)
│   ├── suite.ts             # storageConformanceSuite
│   └── index.ts
└── test/drift.test.ts       # pins suite <-> proto RPC list
```

## Specs

- `docs/history/specs/active-rationale/2026-05-06-storage-s3-module-design.md` section 12.
