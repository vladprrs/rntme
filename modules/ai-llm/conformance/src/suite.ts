import type { CategoryConformanceSuite } from './types.js';

import { scenarios as Complete } from './scenarios/Complete.scenarios.js';
import { scenarios as GetCompletion } from './scenarios/GetCompletion.scenarios.js';
import { scenarios as CreateThread } from './scenarios/CreateThread.scenarios.js';
import { scenarios as GetThread } from './scenarios/GetThread.scenarios.js';
import { scenarios as DeleteThread } from './scenarios/DeleteThread.scenarios.js';
import { scenarios as AddMessage } from './scenarios/AddMessage.scenarios.js';
import { scenarios as ListThreadItems } from './scenarios/ListThreadItems.scenarios.js';
import { scenarios as RunThread } from './scenarios/RunThread.scenarios.js';
import { scenarios as GetThreadRun } from './scenarios/GetThreadRun.scenarios.js';
import { scenarios as CancelThreadRun } from './scenarios/CancelThreadRun.scenarios.js';
import { scenarios as SubmitJob } from './scenarios/SubmitJob.scenarios.js';
import { scenarios as GetJob } from './scenarios/GetJob.scenarios.js';
import { scenarios as CancelJob } from './scenarios/CancelJob.scenarios.js';
import { scenarios as ListJobs } from './scenarios/ListJobs.scenarios.js';

export const aiLlmConformanceSuite: CategoryConformanceSuite = {
  category: 'ai-llm',
  contractVersion: 'v1',
  scenariosByRpc: {
    Complete,
    GetCompletion,
    CreateThread,
    GetThread,
    DeleteThread,
    AddMessage,
    ListThreadItems,
    RunThread,
    GetThreadRun,
    CancelThreadRun,
    SubmitJob,
    GetJob,
    CancelJob,
    ListJobs,
  },
};
