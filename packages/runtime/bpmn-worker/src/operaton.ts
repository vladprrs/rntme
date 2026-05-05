export type OperatonStartProcessInput = {
  readonly processId: string;
  readonly messageName: string;
  readonly businessKey: string;
  readonly variables: unknown;
};

export type OperatonTask = {
  readonly id: string;
  readonly taskId: string;
  readonly processInstanceId: string;
  readonly activityInstanceId: string;
  readonly variables: unknown;
};

export type OperatonClient = {
  readonly startProcess: (
    input: OperatonStartProcessInput,
  ) => Promise<{ readonly processInstanceId: string }>;
  readonly fetchAndLock: () => Promise<readonly OperatonTask[]>;
  readonly completeTask: (taskId: string, variables: unknown) => Promise<void>;
  readonly failTask: (taskId: string, message: string) => Promise<void>;
};
