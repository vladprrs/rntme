// packages/artifacts/bindings/src/types/input-from.ts

// Expression template for dynamic response values (e.g., "$body.customerId", "$result.session.url")
export type ExpressionTemplate = string;
export type ExpressionObject = Record<string, unknown>;

export type InputSource =
  | { from: 'body'; path?: string }                          // JSON body, optional dot-path for nested values
  | { from: 'bodyBytes' }                                    // Raw request body bytes (Uint8Array)
  | { from: 'query'; name: string; required?: boolean }
  | { from: 'header'; name: string; required?: boolean }
  | { from: 'form'; name: string; required?: boolean };      // application/x-www-form-urlencoded

export type InputFromMap = Record<string, InputSource>;

export type ResponseHeaders = Record<string, ExpressionTemplate | ExpressionObject | string | number | boolean>;

export type JsonResponseBranch = {
  json: unknown;
  status?: number;
  headers?: ResponseHeaders;
};

export type RedirectResponseBranch = {
  redirect: ExpressionTemplate | { expr: ExpressionTemplate | ExpressionObject };
  status?: 302 | 303;
  headers?: ResponseHeaders;
};

export type ResponseBranch = JsonResponseBranch | RedirectResponseBranch;

export type ResponseShape = {
  onOk: ResponseBranch;
  onErr: ResponseBranch;
};
