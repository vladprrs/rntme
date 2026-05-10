import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { deployStageState } from '../schema/deploy-stage-state.js';

export type DeployStage = 'compose' | 'provision' | 'plan' | 'render' | 'apply' | 'verify';
export type DeployStageStatus = 'running' | 'succeeded' | 'failed';

export type DeployStageStateRow = {
  readonly id: string;
  readonly deploymentId: string;
  readonly organizationId: string;
  readonly stage: DeployStage;
  readonly status: DeployStageStatus;
  readonly publicStateJson: string | null;
  readonly secretBlobKey: string | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
};

export type DeployStageStateRepo = {
  readonly begin: (input: {
    readonly id: string;
    readonly deploymentId: string;
    readonly organizationId: string;
    readonly stage: DeployStage;
  }) => Promise<void>;
  readonly succeed: (input: {
    readonly deploymentId: string;
    readonly stage: DeployStage;
    readonly publicStateJson?: string;
    readonly secretBlobKey?: string;
  }) => Promise<void>;
  readonly fail: (input: {
    readonly deploymentId: string;
    readonly stage: DeployStage;
    readonly errorCode: string;
    readonly errorMessage: string;
  }) => Promise<void>;
  readonly read: (input: {
    readonly deploymentId: string;
    readonly stage: DeployStage;
  }) => Promise<DeployStageStateRow | null>;
  readonly readAll: (deploymentId: string) => Promise<readonly DeployStageStateRow[]>;
};

export function createPgDeployStageStateRepo(deps: { readonly db: NodePgDatabase }): DeployStageStateRepo {
  return {
    async begin(input) {
      await deps.db.insert(deployStageState).values({
        id: input.id,
        deploymentId: input.deploymentId,
        organizationId: input.organizationId,
        stage: input.stage,
        status: 'running',
      });
    },
    async succeed(input) {
      await deps.db
        .update(deployStageState)
        .set({
          status: 'succeeded',
          finishedAt: new Date(),
          ...(input.publicStateJson === undefined ? {} : { publicStateJson: input.publicStateJson }),
          ...(input.secretBlobKey === undefined ? {} : { secretBlobKey: input.secretBlobKey }),
        })
        .where(and(eq(deployStageState.deploymentId, input.deploymentId), eq(deployStageState.stage, input.stage)));
    },
    async fail(input) {
      await deps.db
        .update(deployStageState)
        .set({
          status: 'failed',
          finishedAt: new Date(),
          errorCode: input.errorCode,
          errorMessage: input.errorMessage,
        })
        .where(and(eq(deployStageState.deploymentId, input.deploymentId), eq(deployStageState.stage, input.stage)));
    },
    async read(input) {
      const rows = await deps.db
        .select()
        .from(deployStageState)
        .where(and(eq(deployStageState.deploymentId, input.deploymentId), eq(deployStageState.stage, input.stage)))
        .limit(1);
      const r = rows[0];
      return r === undefined ? null : (r as DeployStageStateRow);
    },
    async readAll(deploymentId) {
      const rows = await deps.db.select().from(deployStageState).where(eq(deployStageState.deploymentId, deploymentId));
      return rows as readonly DeployStageStateRow[];
    },
  };
}
