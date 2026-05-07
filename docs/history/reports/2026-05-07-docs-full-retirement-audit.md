> Status: historical.
> Date: 2026-05-07.
> Current source: docs/current/**, docs/decision-system.md, AGENTS.md, and current code/tests.
> Why retained: Completion audit for the docs centralization lifecycle pass; it records per-document keep/retire decisions and is not current-state truth by itself.

# Full docs retirement audit - 2026-05-07

Scope: every Markdown document under `docs/` at audit time, excluding this generated report while it was being written.

Retirement rule: move only documents with explicit supersession, removed package/workspace surface, direct contradiction with `docs/decision-system.md`, or harmful current-navigation risk. Ordinary historical plans/specs/research/audits stay retained when their banner or directory makes their non-current status clear.

## Summary

| Status | Count |
| --- | ---: |
| active-rationale | 16 |
| current | 57 |
| gap-backlog | 6 |
| historical | 148 |
| historical-report | 3 |
| historical-root | 33 |
| historical-runbook | 1 |
| research-snapshot | 29 |
| retired | 7 |
| total reviewed | 300 |

Retired in this pass: 7 documents. Retired entries are intentionally omitted
from the table below so this report does not provide navigation back to stale
material.

## Per-document Decisions

| Document | Decision | Evidence |
| --- | --- | --- |
| `docs/README.md` | current | Docs navigation entry point; matches centralized docs structure. |
| `docs/adr/2026-04-15-event-driven-architecture.md` | historical-root | ADR remains a referenced rationale artifact; decision-system is the current authority. |
| `docs/audit/00-waves.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/01-current-priority-tasks.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/bindings-grpc/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/bindings-http/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/bindings/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/blueprint/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/cli/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/conformance-ai-llm/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/conformance-crm/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/conformance-identity/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/contracts-ai-llm-v1/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/contracts-common-v1/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/contracts-crm-v1/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/contracts-identity-v1/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/deploy-core/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/deploy-dokploy/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/event-store/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/graph-ir-compiler/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/landing/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/module-skeleton/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/pdm/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/platform-core/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/platform-http/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/platform-storage/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/projection-consumer/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/qsm/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/runtime/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/seed/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/ui-runtime/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/@rntme/ui/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/audit/monorepo-dependency-graph/README.md` | historical-root | Point-in-time audit snapshot or ledger; retained for traceability, not current truth. |
| `docs/current/guides/bindings-authoring.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/guides/bindings-examples.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/guides/graph-ir-authoring.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/guides/graph-ir-examples.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/apps/cli.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/apps/landing.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/apps/platform-http.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/demo/cv-extract-blueprint.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/demo/cv-extract-blueprint/test-fixtures.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/demo/notes-blueprint.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/demo/order-fulfillment-blueprint.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/modules/ai-llm.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/modules/ai-llm/conformance.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/modules/ai-llm/openrouter.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/modules/analytics/google-analytics.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/modules/crm.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/modules/crm/amocrm.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/modules/crm/bitrix24.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/modules/crm/conformance.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/modules/identity.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/modules/identity/auth0.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/modules/identity/clerk.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/modules/identity/conformance.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/modules/identity/workos.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/modules/presentation/md-mermaid.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/modules/presentation/tiptap.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/artifacts/bindings.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/artifacts/blueprint.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/artifacts/graph-ir-compiler.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/artifacts/pdm.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/artifacts/qsm.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/artifacts/seed.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/artifacts/ui.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/artifacts/workflows.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/contracts/_common/v1.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/contracts/ai-llm/v1.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/contracts/analytics/v1.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/contracts/client-runtime/v1.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/contracts/crm/v1.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/contracts/handlers/v1.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/contracts/identity/v1.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/contracts/module/v1.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/contracts/provisioner/v1.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/deploy/deploy-core.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/deploy/deploy-dokploy.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/platform/platform-core.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/platform/platform-storage.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/runtime/bindings-grpc.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/runtime/bindings-http.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/runtime/bpmn-worker.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/runtime/event-store.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/runtime/projection-consumer.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/runtime/runtime.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/runtime/ui-runtime.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/current/owners/packages/tooling/module-scaffold.md` | current | Current owner/guide surface; retained as current documentation. |
| `docs/decision-system.md` | current | Decision canon; owns goals, filters, bets, and update protocol. |
| `docs/gaps/2026-04-14-medusa-class-roadmap.md` | gap-backlog | Current gap/backlog document; checked for decision-system conflicts and stale package/db-studio/pre-step references. |
| `docs/gaps/bindings-gaps.md` | gap-backlog | Current gap/backlog document; checked for decision-system conflicts and stale package/db-studio/pre-step references. |
| `docs/gaps/commands-and-transactions-gaps.md` | gap-backlog | Current gap/backlog document; checked for decision-system conflicts and stale package/db-studio/pre-step references. |
| `docs/gaps/infra-and-operability-gaps.md` | gap-backlog | Current gap/backlog document; checked for decision-system conflicts and stale package/db-studio/pre-step references. |
| `docs/gaps/pdm-gaps.md` | gap-backlog | Current gap/backlog document; checked for decision-system conflicts and stale package/db-studio/pre-step references. |
| `docs/gaps/queries-and-projections-gaps.md` | gap-backlog | Current gap/backlog document; checked for decision-system conflicts and stale package/db-studio/pre-step references. |
| `docs/history/plans/historical/2026-04-13-graph-ir-sql-compiler-mvp.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-14-bindings-http-commands.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-14-bindings-http.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-14-bindings-impl.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-14-bindings-mutations.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-14-demo-issue-tracker-api-mutations.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-14-graph-ir-compiler-mutations.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-14-medusa-class-roadmap.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-14-rntme-event-store.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-14-rntme-pdm.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-14-rntme-projection-consumer.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-14-rntme-qsm.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-15-runtime-packaging.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-15-runtime-seed.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-15-ui-layer.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-16-demo-issue-tracker-fixes.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-16-demo-v2-migration.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-16-predicate-optional-fix.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-16-qsm-relations-migration.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-16-ui-artifact-v2.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-17-cloudevents-envelope-migration.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-17-readme-for-coding-agents.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-17-relay-dlq-delivery-tracking.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-18-architecture-overview.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-18-d5-consumer-idempotency-hybrid.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-19-platform-api-fix-01.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-19-platform-api-fix-02.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-19-platform-api.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-19-platform-deploy-dokploy.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-19-rntme-cli-platform-commands.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-19-rntme-skills-pack.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-20-landing.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-23-project-first-blueprint-track-a.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-23-project-first-blueprint-track-b.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-23-ultrareview-fixes.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-24-project-deployment-pipeline.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-26-docs-refresh-after-project-first-pivot.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-26-project-deploy-flow-track-1-upload.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-26-project-deploy-flow-track-2-deploy.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-28-audit-waves-buildout.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-28-rnt-277-graph-ir-error-boundary.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-29-notes-demo-auth0.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-29-ui-module-contributions.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-30-merge-rntme-cli-back.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-04-30-notes-demo-auth0-migration.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-01-edge-auth-introspection.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-01-notes-demo-recovery.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-01-provisioned-event-bus.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-02-adopt-production-fix-changes.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-02-cli-remote-deploy-hardening.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-02-publish-path-plan-1-foundations.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-02-publish-path-plan-2-cli-surface.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-02-publish-path-plan-3-edge-auth-and-app.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-02-publish-path-plan-4-migration-and-restoration.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-03-issue-131-cleanup.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-03-module-provisioner-contract.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-03-project-update-delete-operations.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-03-provisioner-bundle-transport.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-04-audit-current-priority-retirement.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-04-audit-deploy-dokploy-partial-apply-cleanup.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-04-audit-deploy-dokploy-resource-comparison.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-04-audit-event-store-actor-kind-check.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-04-audit-package-a-blueprint-ui-fail-fast.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-04-audit-package-b-ui-runtime-confidence.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-04-audit-platform-http-unhandled-error-logging.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-04-audit-platform-storage-result-transaction-rollback.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-04-audit-qsm-ddl-bootstrap-integration.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-04-audit-runtime-actor-validation.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-04-audit-runtime-boundary-hygiene-bindings-http.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-04-audit-runtime-config-validation.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-04-audit-runtime-derived-projection-validation-boundary.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-04-audit-runtime-shutdown-timeout.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-04-audit-ui-validation-consistency.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-04-boot-fragility-pr2.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-04-notes-500-fix-pr4.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-04-pipeline-reorder-pr3.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-04-platform-contracts-extraction.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-04-vendoring-sync-pr1.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-05-provisioned-bpmn-operaton.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-06-ai-llm-openrouter-module.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-06-dokploy-operaton-e2e.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-06-graph-ir-effect-operations.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-06-publish-to-verify-e2e-hardening.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-07-docs-centralization-lifecycle.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/2026-05-07-docs-reset-agent-navigation.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/ai-llm-canonical-contract/01-ai-llm-contracts.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/ai-llm-canonical-contract/02-ai-llm-conformance-skeleton.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/crm-canonical-contract/01-crm-contracts.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/crm-canonical-contract/02-crm-conformance-skeleton.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/identity-canonical-contract/01-common-and-identity-contracts.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/identity-canonical-contract/02-identity-conformance-skeleton.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/platform-http-ui/01-middleware-and-auth-content-negotiation.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/platform-http-ui/02-ui-scaffold-and-auth-pages.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/platform-http-ui/03-read-only-browse-pages.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/platform-http-ui/04-token-mutations.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/platform-http-ui/05-polish-and-readme.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/platform-modules-integration/01-code-executor-seam.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/platform-modules-integration/02-bindings-grpc-surface.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/platform-modules-integration/03-pre-fetch-middleware.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/platform-modules-integration/04-extended-command-binding-p2.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/plans/historical/storage-s3-module/plan.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/reports/2026-04-14-medusa-class-roadmap-plan.md` | historical-report | Historical report/audit retained with lifecycle banner. |
| `docs/history/reports/2026-04-14-mutations-gap-analysis.md` | historical-report | Historical report/audit retained with lifecycle banner. |
| `docs/history/reports/2026-05-06-graph-ir-effect-operations-completion-audit.md` | historical-report | Historical report/audit retained with lifecycle banner. |
| `docs/history/runbooks/2026-05-02-notes-demo-restoration.md` | historical-runbook | Historical operational runbook retained with lifecycle banner. |
| `docs/history/specs/active-rationale/2026-04-18-drizzle-adoption-design.md` | active-rationale | Recent rationale retained; banner says current truth is docs/current, decision-system, and code/tests. |
| `docs/history/specs/active-rationale/2026-04-26-modules-monorepo-structure-design.md` | active-rationale | Recent rationale retained; banner says current truth is docs/current, decision-system, and code/tests. |
| `docs/history/specs/active-rationale/2026-04-29-notes-demo-auth0-design.md` | active-rationale | Recent rationale retained; banner says current truth is docs/current, decision-system, and code/tests. |
| `docs/history/specs/active-rationale/2026-04-29-ui-module-contributions-design.md` | active-rationale | Recent rationale retained; banner says current truth is docs/current, decision-system, and code/tests. |
| `docs/history/specs/active-rationale/2026-04-30-dependency-upgrade-deferral-design.md` | active-rationale | Recent rationale retained; banner says current truth is docs/current, decision-system, and code/tests. |
| `docs/history/specs/active-rationale/2026-04-30-merge-rntme-cli-back-design.md` | active-rationale | Recent rationale retained; banner says current truth is docs/current, decision-system, and code/tests. |
| `docs/history/specs/active-rationale/2026-04-30-notes-demo-auth0-migration-design.md` | active-rationale | Recent rationale retained; banner says current truth is docs/current, decision-system, and code/tests. |
| `docs/history/specs/active-rationale/2026-05-01-edge-auth-introspection-design.md` | active-rationale | Recent rationale retained; banner says current truth is docs/current, decision-system, and code/tests. |
| `docs/history/specs/active-rationale/2026-05-01-notes-demo-recovery-design.md` | active-rationale | Recent rationale retained; banner says current truth is docs/current, decision-system, and code/tests. |
| `docs/history/specs/active-rationale/2026-05-02-publish-path-end-to-end-hardening-design.md` | active-rationale | Recent rationale retained; banner says current truth is docs/current, decision-system, and code/tests. |
| `docs/history/specs/active-rationale/2026-05-04-deploy-local-cli-design.md` | active-rationale | Recent rationale retained; banner says current truth is docs/current, decision-system, and code/tests. |
| `docs/history/specs/active-rationale/2026-05-06-storage-s3-module-design.md` | active-rationale | Recent rationale retained; banner says current truth is docs/current, decision-system, and code/tests. |
| `docs/history/specs/active-rationale/2026-05-07-decision-system-design.md` | active-rationale | Recent rationale retained; banner says current truth is docs/current, decision-system, and code/tests. |
| `docs/history/specs/active-rationale/2026-05-07-docs-centralization-lifecycle-design.md` | active-rationale | Recent rationale retained; banner says current truth is docs/current, decision-system, and code/tests. |
| `docs/history/specs/active-rationale/2026-05-07-docs-reset-agent-navigation-design.md` | active-rationale | Recent rationale retained; banner says current truth is docs/current, decision-system, and code/tests. |
| `docs/history/specs/active-rationale/2026-05-07-vision-deletion-readme-rework-design.md` | active-rationale | Recent rationale retained; banner says current truth is docs/current, decision-system, and code/tests. |
| `docs/history/specs/historical/2026-04-13-graph-ir-sql-compiler-mvp-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-14-bindings-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-14-bindings-http-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-14-medusa-class-roadmap-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-14-mutations-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-15-runtime-packaging-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-15-runtime-seed-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-15-ui-layer-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-16-demo-issue-tracker-fixes-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-16-demo-v2-migration-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-16-predicate-optional-fix-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-16-qsm-relations-migration-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-16-ui-artifact-v2-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-17-cloudevents-envelope-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-17-readme-for-coding-agents-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-17-relay-dlq-delivery-tracking-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-18-architecture-overview-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-18-d5-consumer-idempotency-hybrid-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-19-platform-api-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-19-platform-api-errata-01.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-19-platform-api-errata-02.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-19-platform-deploy-dokploy-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-19-platform-modules-integration-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-19-rntme-cli-platform-commands-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-19-rntme-skills-pack-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-20-landing-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-21-platform-http-ui-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-23-project-first-blueprint-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-23-ultrareview-fixes-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-24-project-deployment-pipeline-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-26-ai-llm-canonical-contract-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-26-docs-refresh-after-project-first-pivot-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-26-identity-canonical-contract-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-26-project-deploy-flow-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-27-crm-canonical-contract-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-04-28-audit-consolidation-and-waves-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-05-01-provisioned-event-bus-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-05-02-cli-remote-deploy-hardening-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-05-03-module-provisioner-contract-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-05-03-project-update-delete-operations-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-05-03-provisioner-bundle-transport-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-05-04-notes-demo-fresh-tenant-deployable-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-05-04-platform-contracts-extraction-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-05-05-provisioned-bpmn-operaton-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-05-06-ai-llm-openrouter-module-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-05-06-graph-ir-effect-operations-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/history/specs/historical/2026-05-06-publish-to-verify-e2e-hardening-design.md` | historical | Historical rationale/execution context retained; banner prevents current-truth use. |
| `docs/research/INDEX.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/astro-plus-astrojs-react-plus-astrojs-mdx/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/auth0/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/aws-sdk-client-s3-plus-aws-sdk-s3-request-presigner/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/better-sqlite3/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/bitrix24-b24jssdk/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/clerk-backend/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/docker-node-20-alpine-slim-runtime-images/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/drizzle-orm-plus-drizzle-kit/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/eslint-plus-eslint-js-plus-typescript-eslint-plus-prettier/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/fast-check/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/github-actions-workflow-stack/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/grpc-grpc-js-plus-grpc-proto-loader/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/hono-plus-hono-node-server-plus-hono-zod-openapi/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/json-render-core-plus-json-render-react-plus-json-render-shadcn/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/msw/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/pg/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/pino/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/prom-client/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/protobufjs-plus-protobufjs-cli/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/react-plus-react-dom/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/shevernitskiy-amo/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/tailwindcss-plus-tailwindcss-cli/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/testcontainers-plus-testcontainers-postgresql/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/tsx-plus-esbuild/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/typescript/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/vitest-plus-vitest-ui/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/workos-inc-node/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
| `docs/research/zod/README.md` | research-snapshot | Dependency research snapshot; retained under dependency deferral policy, not current truth. |
