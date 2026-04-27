/**
 * Local stub of the contracts that @rntme/conformance-framework will
 * publish. Replace these with imports from the framework once it lands.
 *
 * Source-of-truth shape: docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md §7.
 */

export type ScenarioStatus =
  | 'pending' // scaffold only; not yet implementable
  | 'mock_only' // runs against generic mock-vendor
  | 'live_only' // requires vendor sandbox secrets
  | 'mock_and_live'; // covers both

export interface ScenarioContext {
  readonly idempotencyKey: string;
  readonly correlationId: string;
}

export interface Scenario {
  /** Unique within its scenarios file. Convention: `{rpc}_{shortName}`. */
  readonly id: string;
  /** Human-readable purpose. */
  readonly description: string;
  /** When this scenario can run. */
  readonly status: ScenarioStatus;
  /** Pre-condition seed for the vendor (mock or live). */
  readonly seed?: () => Promise<void> | void;
  /** Action under test. */
  readonly action: (ctx: ScenarioContext) => Promise<unknown> | unknown;
  /** Assertions over the action's result. */
  readonly assertions: ReadonlyArray<(result: unknown, ctx: ScenarioContext) => Promise<void> | void>;
}

export interface CategoryConformanceSuite {
  readonly category: 'identity';
  readonly contractVersion: 'v1';
  readonly scenariosByRpc: Readonly<Record<string, ReadonlyArray<Scenario>>>;
}

/**
 * Marker for stub scenarios that must be filled before the package
 * declares conformance against any real vendor. The runner from the
 * future framework reports these as `pending`.
 */
export const UNIMPLEMENTED_SCENARIO_STATUS: ScenarioStatus = 'pending';
