// packages/bindings/src/types/input-from.ts

// Expression template for dynamic values (e.g., "$body.customerId", "$pre.session.url")
export type ExpressionTemplate = string;

export type InputSource =
  | { from: 'body'; path?: string }                          // JSON body, optional dot-path for nested values
  | { from: 'query'; name: string; required?: boolean }
  | { from: 'header'; name: string; required?: boolean }
  | { from: 'form'; name: string; required?: boolean };      // application/x-www-form-urlencoded

export type InputFromMap = Record<string, InputSource>;

export type ResponseBranch =
  | { json: unknown }
  | { redirect: ExpressionTemplate; status?: 302 | 303 };

export type ResponseShape = {
  onOk: ResponseBranch;
  onErr: ResponseBranch;
};
