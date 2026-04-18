import type { HranaInlineError } from '../errors.js';

export type HranaValue =
  | { type: 'null' }
  | { type: 'integer'; value: string }
  | { type: 'float'; value: number }
  | { type: 'text'; value: string }
  | { type: 'blob'; base64: string };

export type HranaNamedArg = { name: string; value: HranaValue };

export type HranaStmt = {
  sql: string;
  args?: HranaValue[];
  named_args?: HranaNamedArg[];
  want_rows?: boolean;
};

export type HranaBatchStep = {
  stmt: HranaStmt;
  condition?: unknown | null;
};

export type HranaPipelineRequest =
  | { type: 'execute'; stmt: HranaStmt }
  | { type: 'batch'; batch: { steps: HranaBatchStep[] } }
  | { type: 'close' };

export type HranaPipelineBody = {
  baton: string | null;
  requests: HranaPipelineRequest[];
};

export type HranaCol = { name: string; decltype: string | null };

export type HranaExecuteResult = {
  cols: HranaCol[];
  rows: HranaValue[][];
  affected_row_count: number;
  last_insert_rowid: string | null;
  replication_index: null;
};

export type HranaOkExecuteResponse = {
  type: 'ok';
  response: { type: 'execute'; result: HranaExecuteResult };
};

export type HranaPipelineResult = HranaOkExecuteResponse | HranaInlineError;

export type HranaPipelineResponse = {
  baton: string | null;
  base_url: null;
  results: HranaPipelineResult[];
};
