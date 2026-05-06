import type { Env } from './config/env.js';

const PlatformErrorNodeSchema = {
  type: 'object',
  properties: {
    code: { type: 'string' },
    message: { type: 'string' },
    path: { type: 'string' },
    cause: { type: 'array', items: { $ref: '#/components/schemas/PlatformErrorNode' } },
  },
  required: ['code', 'message'],
};

const PlatformErrorSchema = {
  type: 'object',
  properties: {
    code: { type: 'string' },
    message: { type: 'string' },
    stage: {
      type: 'string',
      enum: [
        'auth',
        'parse',
        'tenancy',
        'validation',
        'storage',
        'concurrency',
        'internal',
        'plan',
        'render',
        'apply',
        'verify',
        'provision',
      ],
    },
    pkg: { type: 'string' },
    path: { type: 'string' },
    errors: { type: 'array', items: { $ref: '#/components/schemas/PlatformErrorNode' } },
  },
  required: ['code', 'message'],
};

const ErrorResponseSchema = {
  type: 'object',
  properties: {
    error: { $ref: '#/components/schemas/PlatformError' },
    errors: { type: 'array', minItems: 2, items: { $ref: '#/components/schemas/PlatformError' } },
  },
  required: ['error'],
};

const StartDeploymentRequestSchema = {
  type: 'object',
  properties: {
    projectVersionSeq: { type: 'integer', minimum: 1 },
    targetSlug: { type: 'string', minLength: 1 },
    configOverrides: {
      type: 'object',
      properties: {
        eventBusMode: { type: 'string', enum: ['in-memory'] },
        integrationModuleImages: { type: 'object', additionalProperties: { type: 'string' } },
        policyOverrides: { type: 'object', additionalProperties: {} },
        runtimeImage: { type: 'string', minLength: 1 },
        publicBaseUrl: { type: 'string', format: 'uri' },
      },
      additionalProperties: false,
    },
  },
  required: ['projectVersionSeq', 'targetSlug'],
};

const errorResponse = {
  description: 'Error',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
};

export function buildOpenApi(env: Env): object {
  return {
    openapi: '3.1.0',
    info: {
      title: 'rntme platform API',
      version: '0.0.0',
      description: 'Control-plane for rntme projects and immutable project versions.',
    },
    servers: [{ url: env.PLATFORM_BASE_URL }],
    paths: {
      '/v1/auth/login': { get: { summary: 'Redirect to WorkOS' } },
      '/v1/auth/callback': { get: { summary: 'OAuth callback' } },
      '/v1/auth/logout': { post: { summary: 'Logout' } },
      '/v1/auth/me': { get: { summary: 'Current subject', security: [{ bearerAuth: [] }, { cookieAuth: [] }] } },
      '/v1/orgs': { get: { summary: 'List orgs' } },
      '/v1/orgs/{orgSlug}/projects': {
        get: { summary: 'List projects' },
        post: { summary: 'Create project' },
      },
      '/v1/orgs/{orgSlug}/projects/{projSlug}/versions': {
        post: {
          summary: 'Publish project version',
          responses: {
            '201': { description: 'Version created' },
            '422': errorResponse,
            default: errorResponse,
          },
        },
        get: { summary: 'List project versions' },
      },
      '/v1/orgs/{orgSlug}/projects/{projSlug}/versions/{seq}': {
        get: { summary: 'Show project version' },
      },
      '/v1/orgs/{orgSlug}/projects/{projSlug}/versions/{seq}/bundle': {
        get: { summary: 'Redirect to project version bundle' },
      },
      '/v1/orgs/{orgSlug}/deploy-targets': {
        get: { summary: 'List deploy targets', security: [{ bearerAuth: [] }, { cookieAuth: [] }] },
        post: { summary: 'Create deploy target', security: [{ bearerAuth: [] }, { cookieAuth: [] }] },
      },
      '/v1/orgs/{orgSlug}/deploy-targets/{targetSlug}': {
        get: { summary: 'Show deploy target', security: [{ bearerAuth: [] }, { cookieAuth: [] }] },
        patch: { summary: 'Update deploy target', security: [{ bearerAuth: [] }, { cookieAuth: [] }] },
        delete: { summary: 'Delete deploy target', security: [{ bearerAuth: [] }, { cookieAuth: [] }] },
      },
      '/v1/orgs/{orgSlug}/deploy-targets/{targetSlug}/api-token': {
        put: { summary: 'Rotate deploy target API token', security: [{ bearerAuth: [] }, { cookieAuth: [] }] },
      },
      '/v1/orgs/{orgSlug}/deploy-targets/{targetSlug}/default': {
        put: { summary: 'Set default deploy target', security: [{ bearerAuth: [] }, { cookieAuth: [] }] },
      },
      '/v1/orgs/{orgSlug}/projects/{projSlug}/deployments': {
        post: {
          summary: 'Start deployment',
          security: [{ bearerAuth: [] }, { cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/StartDeploymentRequest' } },
            },
          },
          responses: {
            '202': { description: 'Deployment queued' },
            default: errorResponse,
          },
        },
        get: { summary: 'List deployments', security: [{ bearerAuth: [] }, { cookieAuth: [] }] },
      },
      '/v1/orgs/{orgSlug}/projects/{projSlug}/deployments/{deploymentId}': {
        get: { summary: 'Show deployment', security: [{ bearerAuth: [] }, { cookieAuth: [] }] },
      },
      '/v1/orgs/{orgSlug}/projects/{projSlug}/deployments/{deploymentId}/logs': {
        get: { summary: 'Read deployment logs', security: [{ bearerAuth: [] }, { cookieAuth: [] }] },
      },
    },
    components: {
      schemas: {
        PlatformErrorNode: PlatformErrorNodeSchema,
        PlatformError: PlatformErrorSchema,
        ErrorResponse: ErrorResponseSchema,
        StartDeploymentRequest: StartDeploymentRequestSchema,
      },
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'rntme_pat_...' },
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'rntme_session' },
      },
    },
  };
}
