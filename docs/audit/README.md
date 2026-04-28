# Architecture audits (published snapshots)

This directory contains **documentation-only** snapshots of Multica architecture audits for workspace packages (issues **RNT-199**–**RNT-230**). Each audit was originally posted as an agent comment on the corresponding issue; this tree preserves the report text for offline reading and code review.

These documents are **not** a substitute for the live issue thread (attachments, threading, and later corrections live in Multica).

## Index

| Issue | Scope | Verdict (summary) | Snapshot |
|-------|-------|-------------------|----------|
| `RNT-199` | `@rntme/bindings` | needs cleanup | [@rntme/bindings/README.md](./@rntme/bindings/README.md) |
| `RNT-200` | `@rntme/bindings-grpc` | needs cleanup | [@rntme/bindings-grpc/README.md](./@rntme/bindings-grpc/README.md) |
| `RNT-201` | `@rntme/bindings-http` | needs cleanup | [@rntme/bindings-http/README.md](./@rntme/bindings-http/README.md) |
| `RNT-202` | `@rntme/blueprint` | needs cleanup | [@rntme/blueprint/README.md](./@rntme/blueprint/README.md) |
| `RNT-203` | `@rntme/db-studio` | needs cleanup — well-scoped and generally well-implemented, but has sev… | [@rntme/db-studio/README.md](./@rntme/db-studio/README.md) |
| `RNT-204` | `@rntme/event-store` | needs cleanup | [@rntme/event-store/README.md](./@rntme/event-store/README.md) |
| `RNT-205` | `@rntme/graph-ir-compiler` | needs cleanup — multiple medium-to-high architectural risks and debt it… | [@rntme/graph-ir-compiler/README.md](./@rntme/graph-ir-compiler/README.md) |
| `RNT-206` | `@rntme/module-skeleton` | needs cleanup — architectural risk: low, but several gaps block it from… | [@rntme/module-skeleton/README.md](./@rntme/module-skeleton/README.md) |
| `RNT-207` | `@rntme/pdm` | needs cleanup | [@rntme/pdm/README.md](./@rntme/pdm/README.md) |
| `RNT-208` | `@rntme/projection-consumer` | needs cleanup | [@rntme/projection-consumer/README.md](./@rntme/projection-consumer/README.md) |
| `RNT-209` | `@rntme/qsm` | needs cleanup | [@rntme/qsm/README.md](./@rntme/qsm/README.md) |
| `RNT-210` | `@rntme/runtime` | needs cleanup — no fundamental redesign required, but several architect… | [@rntme/runtime/README.md](./@rntme/runtime/README.md) |
| `RNT-211` | `@rntme/seed` | needs cleanup | [@rntme/seed/README.md](./@rntme/seed/README.md) |
| `RNT-212` | `@rntme/ui` | needs cleanup — solid foundation with several medium/high gaps between … | [@rntme/ui/README.md](./@rntme/ui/README.md) |
| `RNT-213` | `@rntme/ui-runtime` | needs cleanup — архитектура верная, но накопился значительный implement… | [@rntme/ui-runtime/README.md](./@rntme/ui-runtime/README.md) |
| `RNT-214` | `@rntme/contracts-common-v1` | OK — структурно корректен, выполняет роль primitives-only shared packag… | [@rntme/contracts-common-v1/README.md](./@rntme/contracts-common-v1/README.md) |
| `RNT-215` | `@rntme/contracts-ai-llm-v1` | needs cleanup — пакет структурно здоров, но есть type-safety пробелы, т… | [@rntme/contracts-ai-llm-v1/README.md](./@rntme/contracts-ai-llm-v1/README.md) |
| `RNT-216` | `@rntme/contracts-crm-v1` | needs cleanup | [@rntme/contracts-crm-v1/README.md](./@rntme/contracts-crm-v1/README.md) |
| `RNT-217` | `@rntme/contracts-identity-v1` | needs cleanup | [@rntme/contracts-identity-v1/README.md](./@rntme/contracts-identity-v1/README.md) |
| `RNT-218` | `@rntme/conformance-ai-llm` | OK — the package matches its implementation plan and all tests pass. Ho… | [@rntme/conformance-ai-llm/README.md](./@rntme/conformance-ai-llm/README.md) |
| `RNT-219` | `@rntme/conformance-crm` | needs cleanup — structural drift from sibling conformance packages and … | [@rntme/conformance-crm/README.md](./@rntme/conformance-crm/README.md) |
| `RNT-220` | `@rntme/conformance-identity` | architectural risk | [@rntme/conformance-identity/README.md](./@rntme/conformance-identity/README.md) |
| `RNT-221` | `@rntme/issue-tracker-api-demo` | needs cleanup | [@rntme/issue-tracker-api-demo/README.md](./@rntme/issue-tracker-api-demo/README.md) |
| `RNT-222` | `@rntme/pre-step-demo` | needs cleanup — функциональность работает (4/4 тестов зелёные), но есть… | [@rntme/pre-step-demo/README.md](./@rntme/pre-step-demo/README.md) |
| `RNT-223` | `@rntme-cli/landing` | needs cleanup | [@rntme-cli/landing/README.md](./@rntme-cli/landing/README.md) |
| `RNT-224` | `@rntme-cli/cli` | needs cleanup | [@rntme-cli/cli/README.md](./@rntme-cli/cli/README.md) |
| `RNT-225` | `@rntme-cli/deploy-core` | needs cleanup | [@rntme-cli/deploy-core/README.md](./@rntme-cli/deploy-core/README.md) |
| `RNT-226` | `@rntme-cli/deploy-dokploy` | needs cleanup | [@rntme-cli/deploy-dokploy/README.md](./@rntme-cli/deploy-dokploy/README.md) |
| `RNT-227` | `@rntme-cli/platform-core` | needs cleanup | [@rntme-cli/platform-core/README.md](./@rntme-cli/platform-core/README.md) |
| `RNT-228` | `@rntme-cli/platform-http` | needs cleanup | [@rntme-cli/platform-http/README.md](./@rntme-cli/platform-http/README.md) |
| `RNT-229` | `@rntme-cli/platform-storage` | needs cleanup — несколько medium/high рисков, нет blockers, но debt нак… | [@rntme-cli/platform-storage/README.md](./@rntme-cli/platform-storage/README.md) |
| `RNT-230` | `monorepo-dependency-graph` | needs cleanup — includes blocker-level workspace issues | [monorepo-dependency-graph/README.md](./monorepo-dependency-graph/README.md) |

## Notes

- **Source**: audit body was copied verbatim from the longest substantive agent comment on each issue (autopilot queue instructions excluded).
- **Pending audits**: none at time of publication — every issue in RNT-199..RNT-230 had a complete report comment.

