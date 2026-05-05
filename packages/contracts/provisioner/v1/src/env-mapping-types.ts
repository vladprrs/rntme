export type EnvMappingEntry = {
  readonly from: string;
  readonly envName: string;
  readonly secret: boolean;
  readonly target: string;
};

export type ProvisionerEnvMapping = Readonly<Record<string, readonly EnvMappingEntry[]>>;

export type ResolvedEnvEntry = {
  readonly module: string;
  readonly target: string;
  readonly envName: string;
  readonly value: string;
  readonly secret: boolean;
};
