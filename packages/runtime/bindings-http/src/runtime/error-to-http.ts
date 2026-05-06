export type ErrorHttpMapping = {
  status: number;
  exposeCode: boolean;
};

const TABLE: Record<string, ErrorHttpMapping> = {
  COMMAND_GUARD_REJECTED: { status: 422, exposeCode: true },
  COMMAND_CONCURRENCY_CONFLICT: { status: 409, exposeCode: true },
  COMMAND_NOT_FOUND: { status: 500, exposeCode: true },
  COMMAND_HANDLER_ERROR: { status: 400, exposeCode: true },
  COMMAND_HANDLER_THREW: { status: 500, exposeCode: true },
  OPERATION_NOT_FOUND: { status: 500, exposeCode: true },
  OPERATION_EXECUTION_FAILED: { status: 500, exposeCode: true },
};

export function errorToHttp(code: string): ErrorHttpMapping {
  return TABLE[code] ?? { status: 500, exposeCode: true };
}
