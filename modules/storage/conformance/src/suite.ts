import type { CategoryConformanceSuite } from './types.js';

import { scenarios as AbortUpload } from './scenarios/AbortUpload.scenarios.js';
import { scenarios as CommitUpload } from './scenarios/CommitUpload.scenarios.js';
import { scenarios as DeleteFile } from './scenarios/DeleteFile.scenarios.js';
import { scenarios as GetDownloadUrl } from './scenarios/GetDownloadUrl.scenarios.js';
import { scenarios as GetFile } from './scenarios/GetFile.scenarios.js';
import { scenarios as ListFiles } from './scenarios/ListFiles.scenarios.js';
import { scenarios as PrepareUpload } from './scenarios/PrepareUpload.scenarios.js';

export const storageConformanceSuite: CategoryConformanceSuite = {
  category: 'storage',
  contractVersion: 'v1',
  scenariosByRpc: {
    PrepareUpload,
    CommitUpload,
    AbortUpload,
    GetFile,
    ListFiles,
    GetDownloadUrl,
    DeleteFile,
  },
};
