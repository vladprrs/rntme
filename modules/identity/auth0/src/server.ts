import { Buffer } from 'node:buffer';
import * as grpc from '@grpc/grpc-js';
import { proto } from '@rntme/contracts-identity-v1';
import { GrpcStatus, IdentityModuleError, unimplemented } from './errors.js';

const idv1 = proto.rntme.contracts.identity.v1;

type ProtoType = {
  encode(value: object): { finish(): Uint8Array };
  decode(bytes: Uint8Array): object;
  fromObject(value: object): object;
  toObject(value: object, options?: object): object;
};

type UnaryHandler = (request: object) => Promise<object>;

export type Auth0IdentityModule = Partial<Record<IdentityRpcName, UnaryHandler>>;

export interface IdentityAuth0GrpcServerOptions {
  readonly module: Auth0IdentityModule;
  readonly port?: number;
  readonly host?: string;
  readonly serverCredentials?: grpc.ServerCredentials;
}

export interface IdentityAuth0GrpcServer {
  readonly server: grpc.Server;
  listen(): Promise<{ port: number }>;
  stop(): Promise<void>;
}

const rpcDescriptors = {
  GetUser: [idv1.GetUserRequest, idv1.User],
  ListUsers: [idv1.ListUsersRequest, idv1.UserList],
  GetOrganization: [idv1.GetOrganizationRequest, idv1.Organization],
  ListOrganizations: [idv1.ListOrganizationsRequest, idv1.OrganizationList],
  GetMembership: [idv1.GetMembershipRequest, idv1.OrganizationMembership],
  ListMemberships: [idv1.ListMembershipsRequest, idv1.OrganizationMembershipList],
  GetInvitation: [idv1.GetInvitationRequest, idv1.Invitation],
  ListInvitations: [idv1.ListInvitationsRequest, idv1.InvitationList],
  GetSession: [idv1.GetSessionRequest, idv1.Session],
  ListSessions: [idv1.ListSessionsRequest, idv1.SessionList],
  ResolveIdentity: [idv1.ResolveIdentityRequest, idv1.IdentityResolution],
  IntrospectSession: [idv1.IntrospectSessionRequest, idv1.Session],
  CreateUser: [idv1.CreateUserRequest, idv1.User],
  UpdateUser: [idv1.UpdateUserRequest, idv1.User],
  DeleteUser: [idv1.DeleteUserRequest, idv1.User],
  CreateOrganization: [idv1.CreateOrganizationRequest, idv1.Organization],
  UpdateOrganization: [idv1.UpdateOrganizationRequest, idv1.Organization],
  DeleteOrganization: [idv1.DeleteOrganizationRequest, idv1.Organization],
  CreateInvitation: [idv1.CreateInvitationRequest, idv1.Invitation],
  RevokeInvitation: [idv1.RevokeInvitationRequest, idv1.Invitation],
  AddMembership: [idv1.AddMembershipRequest, idv1.OrganizationMembership],
  UpdateMembership: [idv1.UpdateMembershipRequest, idv1.OrganizationMembership],
  RemoveMembership: [idv1.RemoveMembershipRequest, idv1.OrganizationMembership],
  RevokeSession: [idv1.RevokeSessionRequest, idv1.Session],
} satisfies Record<string, readonly [ProtoType, ProtoType]>;

export type IdentityRpcName = keyof typeof rpcDescriptors;

function serialize(type: ProtoType, value: object): Buffer {
  return Buffer.from(type.encode(type.fromObject(value)).finish());
}

function deserialize(type: ProtoType, bytes: Buffer): object {
  return type.toObject(type.decode(bytes), { defaults: true });
}

function createServiceDefinition(): grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
  const service: Record<string, grpc.MethodDefinition<object, object>> = {};
  for (const [rpc, [requestType, responseType]] of Object.entries(rpcDescriptors)) {
    service[rpc] = {
      path: `/rntme.contracts.identity.v1.IdentityModule/${rpc}`,
      requestStream: false,
      responseStream: false,
      requestSerialize: (value: object): Buffer => serialize(requestType, value),
      requestDeserialize: (bytes: Buffer): object => deserialize(requestType, bytes),
      responseSerialize: (value: object): Buffer => serialize(responseType, normalizeKnownStructFields(value)),
      responseDeserialize: (bytes: Buffer): object => deserialize(responseType, bytes),
    };
  }
  return service as grpc.ServiceDefinition<grpc.UntypedServiceImplementation>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStruct(value: unknown): boolean {
  return isRecord(value) && isRecord(value.fields);
}

function toProtoValue(value: unknown): object {
  if (value === null || value === undefined) return { nullValue: 0 };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return Number.isFinite(value) ? { numberValue: value } : { stringValue: String(value) };
  if (typeof value === 'boolean') return { boolValue: value };
  if (Array.isArray(value)) return { listValue: { values: value.map(toProtoValue) } };
  if (isRecord(value)) return { structValue: toProtoStruct(value) };
  return { stringValue: String(value) };
}

function toProtoStruct(value: Record<string, unknown>): object {
  return {
    fields: Object.fromEntries(Object.entries(value).map(([key, fieldValue]) => [key, toProtoValue(fieldValue)])),
  };
}

function normalizeKnownStructFields(value: unknown): object {
  if (!isRecord(value)) return {};
  const normalized: Record<string, unknown> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if ((key === 'vendor_raw' || key === 'public' || key === 'private' || key === 'unsafe') && isRecord(fieldValue) && !isStruct(fieldValue)) {
      normalized[key] = toProtoStruct(fieldValue);
    } else if (Array.isArray(fieldValue)) {
      normalized[key] = fieldValue.map((item) => (isRecord(item) ? normalizeKnownStructFields(item) : item));
    } else if (isRecord(fieldValue)) {
      normalized[key] = normalizeKnownStructFields(fieldValue);
    } else {
      normalized[key] = fieldValue;
    }
  }
  return normalized;
}

function errorToServiceError(error: unknown): grpc.ServiceError {
  const identityError = error instanceof IdentityModuleError
    ? error
    : new IdentityModuleError(error instanceof Error ? error.message : String(error), GrpcStatus.INTERNAL, 'IDENTITY_VENDOR_REQUEST_FAILED', error);
  return {
    name: identityError.name,
    message: `${identityError.identityCode}: ${identityError.message}`,
    code: identityError.code as unknown as grpc.status,
    details: `${identityError.identityCode}: ${identityError.message}`,
    metadata: new grpc.Metadata(),
  };
}

function makeImplementation(module: Auth0IdentityModule): grpc.UntypedServiceImplementation {
  const implementation: grpc.UntypedServiceImplementation = {};
  for (const rpc of Object.keys(rpcDescriptors) as IdentityRpcName[]) {
    implementation[rpc] = async (
      call: grpc.ServerUnaryCall<object, object>,
      callback: grpc.sendUnaryData<object>,
    ): Promise<void> => {
      const handler = module[rpc];
      try {
        if (handler === undefined) throw unimplemented(rpc);
        callback(null, await handler(call.request));
      } catch (error) {
        callback(errorToServiceError(error), null);
      }
    };
  }
  return implementation;
}

export function createIdentityAuth0GrpcServer(opts: IdentityAuth0GrpcServerOptions): IdentityAuth0GrpcServer {
  const server = new grpc.Server();
  server.addService(createServiceDefinition(), makeImplementation(opts.module));
  const host = opts.host ?? '0.0.0.0';
  const port = opts.port ?? 50051;
  const credentials = opts.serverCredentials ?? grpc.ServerCredentials.createInsecure();

  return {
    server,
    listen(): Promise<{ port: number }> {
      return new Promise((resolve, reject) => {
        server.bindAsync(`${host}:${port}`, credentials, (error, boundPort) => {
          if (error !== null) return reject(error);
          resolve({ port: boundPort });
        });
      });
    },
    stop(): Promise<void> {
      return new Promise((resolve) => server.tryShutdown(() => resolve()));
    },
  };
}
