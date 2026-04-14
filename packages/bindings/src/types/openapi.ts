export type JsonSchema = {
  type?: string | string[];
  format?: string;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  default?: unknown;
  enum?: unknown[];
  additionalProperties?: boolean | JsonSchema;
  // arbitrary extensions (x-…):
  [key: string]: unknown;
};

export type MediaType = {
  schema?: JsonSchema;
  example?: unknown;
  [key: string]: unknown;
};

export type ParameterObject = {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required: boolean;
  description?: string;
  schema?: JsonSchema;
  style?: string;
  explode?: boolean;
  example?: unknown;
  [key: string]: unknown;
};

export type RequestBodyObject = {
  required?: boolean;
  content: Record<string, MediaType>;
  description?: string;
  [key: string]: unknown;
};

export type ResponseObject = {
  description: string;
  content?: Record<string, MediaType>;
  headers?: Record<string, unknown>;
  [key: string]: unknown;
};

export type OperationObject = {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
  [key: string]: unknown;
};

export type PathItem = {
  get?: OperationObject;
  post?: OperationObject;
  [key: string]: OperationObject | undefined | string;
};

export type InfoObject = {
  title: string;
  version: string;
  description?: string;
};

export type ServerObject = {
  url: string;
  description?: string;
};

export type OpenApiDoc = {
  openapi: '3.1.0';
  info: InfoObject;
  servers?: ServerObject[];
  paths: Record<string, PathItem>;
  components: { schemas: Record<string, JsonSchema> };
};
