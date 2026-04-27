export { suite } from './suite.js';
export { pendingScenario, UNIMPLEMENTED_SCENARIO_STATUS } from './types.js';
export type { Scenario, ScenarioStep, ScenarioRequirements, CategoryConformanceSuite } from './types.js';

// Re-export fixtures so vendor modules can compose scenarios on top.
export * as contacts from './fixtures/contacts.js';
export * as companies from './fixtures/companies.js';
export * as deals from './fixtures/deals.js';
export * as activities from './fixtures/activities.js';
export * as notes from './fixtures/notes.js';
export * as associations from './fixtures/associations.js';
export * as pipelines from './fixtures/pipelines.js';
export * as customFields from './fixtures/custom-fields.js';
export * as owners from './fixtures/owners.js';
export {
  bitrix24EventPath,
  hubspotBatchPath,
  amocrmUpdatePath,
  pipedriveV2Path,
  bitrix24EventUrl,
  hubspotBatchUrl,
  amocrmUpdateUrl,
  pipedriveV2Url,
} from './fixtures/webhooks/index.js';
