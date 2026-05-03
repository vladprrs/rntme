export type TargetSecretRecord = {
  readonly name: string;
  readonly schema: string;
  readonly value: unknown;
};

export type TargetSecretSummary = {
  readonly name: string;
  readonly schema: string;
  readonly updatedAt: Date;
};

export interface TargetSecretsRepo {
  list(targetId: string): Promise<readonly TargetSecretSummary[]>;
  upsert(targetId: string, record: TargetSecretRecord, now: Date): Promise<void>;
  remove(targetId: string, name: string): Promise<void>;
  getAllDecrypted(targetId: string): Promise<Readonly<Record<string, unknown>>>;
}
