export const VERSION = '0.0.0';
export { emitProto, type EmitProtoOptions } from './emit/emit-proto.js';
export { createGrpcServer } from './server/create-server.js';
export type { GrpcServerOptions, GrpcServerHandle } from './types.js';
export { mapExecutorErrorToGrpcStatus } from './server/errors.js';
