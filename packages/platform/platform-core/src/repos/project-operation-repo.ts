import type {
  ProjectOperation,
  ProjectOperationKind,
  ProjectOperationLogLine,
  ProjectOperationStatus,
} from '../schemas/project-operation.js';
import type { PlatformError, Result } from '../types/result.js';

export type ProjectOperationInsertRow = {
  readonly id: string;
  readonly orgId: string;
  readonly projectId: string;
  readonly kind: ProjectOperationKind;
  readonly requestedByAccountId: string;
  readonly requestedByTokenId: string | null;
  readonly targetId: string | null;
  readonly projectVersionId: string | null;
  readonly deploymentId: string | null;
  readonly input: Record<string, unknown>;
};

export type ProjectOperationFinalize = {
  readonly status: Extract<ProjectOperationStatus, 'succeeded' | 'failed'>;
  readonly result?: Record<string, unknown> | undefined;
  readonly errorCode?: string | undefined;
  readonly errorMessage?: string | undefined;
};

export interface ProjectOperationRepo {
  create(args: {
    row: ProjectOperationInsertRow;
    auditActorAccountId: string;
    auditActorTokenId: string | null;
  }): Promise<Result<ProjectOperation, PlatformError>>;

  attachDeployment(operationId: string, deploymentId: string): Promise<Result<ProjectOperation, PlatformError>>;
  getById(id: string): Promise<Result<ProjectOperation | null, PlatformError>>;
  getByDeploymentId(deploymentId: string): Promise<Result<ProjectOperation | null, PlatformError>>;

  listByProject(
    projectId: string,
    opts: { limit: number; cursor?: Date },
  ): Promise<Result<readonly ProjectOperation[], PlatformError>>;

  transition(
    id: string,
    status: 'running',
    side: { startedAt: Date },
  ): Promise<Result<void, PlatformError>>;

  finalize(id: string, args: ProjectOperationFinalize): Promise<Result<ProjectOperation, PlatformError>>;
  touchHeartbeat(id: string): Promise<Result<void, PlatformError>>;

  appendLog(args: {
    operationId: string;
    orgId: string;
    level: 'info' | 'warn' | 'error';
    step: string;
    message: string;
  }): Promise<Result<void, PlatformError>>;

  readLogs(args: {
    operationId: string;
    sinceLineId: number;
    limit: number;
  }): Promise<Result<{ lines: readonly ProjectOperationLogLine[]; lastLineId: number }, PlatformError>>;

  findStaleRunning(staleAfterSeconds: number): Promise<Result<readonly { id: string; orgId: string; projectId: string }[], PlatformError>>;
}
