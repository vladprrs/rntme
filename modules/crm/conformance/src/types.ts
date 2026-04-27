/**
 * Local type stubs that mirror the (not-yet-extant) `@rntme/conformance-framework`
 * surface. When the framework lands, this file is deleted and types come from
 * `@rntme/conformance-framework`.
 *
 * This file MUST stay structurally compatible with the framework spec
 * (modules-monorepo §7). If the framework lands with a different signature,
 * migrate scenarios in the same PR.
 */

/**
 * A capability-gating predicate. Scenarios skip on modules whose `module.json#capabilities`
 * does not satisfy these constraints.
 */
export interface ScenarioRequirements {
  entities?: readonly ('contact' | 'company' | 'deal' | 'activity' | 'note')[];
  search_tiers?: readonly ('simple' | 'advanced' | 'fulltext')[];
  labeled_associations?: boolean;
  async_job_types?: readonly 'SYNC_FULL'[];
  bulk_operations_min_size?: number;
  webhook_format?: 'json' | 'urlencoded';
  webhook_retry_policy?: string;
}

/**
 * A scenario step is either a single RPC call or a meta-instruction
 * (assertion-only, fixture-substitution scaffold).
 */
export interface ScenarioStep {
  rpc?: string;
  input?: Record<string, unknown>;
  assertEventWithin?: { type: string; seconds: number };
  // additional helper steps may be added when the framework lands
}

/**
 * A single conformance scenario. v1 ships scenarios as stubs (empty `steps`,
 * status=`pending`) until the framework runner can interpret them.
 */
export interface Scenario {
  id: string;
  name: string;
  status: 'pending' | 'mock_only' | 'live_only' | 'mock_and_live';
  capability?: string; // canonical RPC name this scenario gates on
  requires?: ScenarioRequirements;
  /**
   * For single-RPC scenarios, set `action`. For multi-step (Deal stage transition,
   * SyncDelta watermark progression, AsyncJob lifecycle), set `steps` instead.
   */
  action?: ScenarioStep;
  steps?: ScenarioStep[];
  /** Free-form description of assertions; framework will replace with typed assertion array. */
  assertionsDescription?: string;
}

/**
 * The category-suite shape consumed by the (future) runner.
 */
export interface CategoryConformanceSuite {
  category: 'crm';
  contract_version: 'v1';
  scenarios: Record<string, Scenario[]>; // keyed by RPC short-name
}

export const UNIMPLEMENTED_SCENARIO_STATUS = 'pending' as const;

export function pendingScenario(input: Omit<Scenario, 'status'>): Scenario {
  return {
    ...input,
    status: UNIMPLEMENTED_SCENARIO_STATUS,
  };
}
