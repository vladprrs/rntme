# rntme

[![CI](https://github.com/vladprrs/rntme/actions/workflows/ci.yml/badge.svg)](https://github.com/vladprrs/rntme/actions/workflows/ci.yml)

Monorepo for rntme — a typed read-side query language and its compilers.

## Packages

| Package | Purpose |
| ------- | ------- |
| [`@rntme/graph-ir-compiler`](packages/graph-ir-compiler) | Graph IR → SQL compiler (SQLite target, MVP Tier 1). |

## Requirements

- Node.js ≥ 20
- pnpm ≥ 9

## Setup

```bash
pnpm install
pnpm -r run test
```

## MVP Success Criteria

- Category sales e2e passes on `:memory:` SQLite.
- All Tier 1 input modes covered by dedicated e2e scenarios.
- Tier 1 unsupported features return `TIER1_UNSUPPORTED_NODE` / `TIER1_UNSUPPORTED_EXPR` with hints.
- CI green on Node 20.
