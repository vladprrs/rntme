export type ScenarioStatus = 'pending' | 'mock_only' | 'live_only' | 'mock_and_live';

export interface ScenarioContext {
  readonly idempotencyKey: string;
  readonly correlationId: string;
}

export interface Scenario {
  readonly id: string;
  readonly description: string;
  readonly status: ScenarioStatus;
  readonly seed?: () => Promise<void> | void;
  readonly action: (ctx: ScenarioContext) => Promise<unknown> | unknown;
  readonly assertions: ReadonlyArray<(result: unknown, ctx: ScenarioContext) => Promise<void> | void>;
}

export interface CategoryConformanceSuite {
  readonly category: 'storage';
  readonly contractVersion: 'v1';
  readonly scenariosByRpc: Readonly<Record<string, ReadonlyArray<Scenario>>>;
}

export const UNIMPLEMENTED_SCENARIO_STATUS: ScenarioStatus = 'pending';
