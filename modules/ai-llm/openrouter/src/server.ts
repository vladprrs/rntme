import { Buffer } from 'node:buffer';
import * as grpc from '@grpc/grpc-js';
import { proto } from '@rntme/contracts-ai-llm-v1';
import { AiLlmOpenRouterError, GrpcStatus, unimplemented } from './errors.js';

const aiLlmV1 = proto.rntme.contracts.ai_llm.v1;

type ProtoType = {
  encode(value: object): { finish(): Uint8Array };
  decode(bytes: Uint8Array): object;
  fromObject(value: object): object;
  toObject(value: object, options?: object): object;
};

type UnaryHandler = (request: object) => Promise<object>;

const rpcDescriptors = {
  Complete: [aiLlmV1.CreateCompletionRequest, aiLlmV1.Completion],
  GetCompletion: [aiLlmV1.GetCompletionRequest, aiLlmV1.Completion],
  CreateThread: [aiLlmV1.CreateThreadRequest, aiLlmV1.AssistantThread],
  GetThread: [aiLlmV1.GetThreadRequest, aiLlmV1.AssistantThread],
  DeleteThread: [aiLlmV1.DeleteThreadRequest, aiLlmV1.AssistantThread],
  AddMessage: [aiLlmV1.AddMessageRequest, aiLlmV1.ThreadItem],
  ListThreadItems: [aiLlmV1.ListThreadItemsRequest, aiLlmV1.ThreadItemList],
  RunThread: [aiLlmV1.RunThreadRequest, aiLlmV1.ThreadRun],
  GetThreadRun: [aiLlmV1.GetThreadRunRequest, aiLlmV1.ThreadRun],
  CancelThreadRun: [aiLlmV1.CancelThreadRunRequest, aiLlmV1.ThreadRun],
  SubmitJob: [aiLlmV1.SubmitJobRequest, aiLlmV1.AsyncJob],
  GetJob: [aiLlmV1.GetJobRequest, aiLlmV1.AsyncJob],
  CancelJob: [aiLlmV1.CancelJobRequest, aiLlmV1.AsyncJob],
  ListJobs: [aiLlmV1.ListJobsRequest, aiLlmV1.AsyncJobList],
} satisfies Record<string, readonly [ProtoType, ProtoType]>;

export type AiLlmRpcName = keyof typeof rpcDescriptors;

export interface OpenRouterGrpcServerOptions {
  module: Partial<Record<AiLlmRpcName, UnaryHandler>>;
  port?: number;
  host?: string;
  serverCredentials?: grpc.ServerCredentials;
}

export interface OpenRouterGrpcServer {
  server: grpc.Server;
  listen(): Promise<{ port: number }>;
  stop(): Promise<void>;
}

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
      path: `/rntme.contracts.ai_llm.v1.AiLlmModule/${rpc}`,
      requestStream: false,
      responseStream: false,
      requestSerialize: (value: object): Buffer => serialize(requestType, value),
      requestDeserialize: (bytes: Buffer): object => deserialize(requestType, bytes),
      responseSerialize: (value: object): Buffer => serialize(responseType, value),
      responseDeserialize: (bytes: Buffer): object => deserialize(responseType, bytes),
    };
  }
  return service as grpc.ServiceDefinition<grpc.UntypedServiceImplementation>;
}

function errorToServiceError(error: unknown): grpc.ServiceError {
  const e = error instanceof AiLlmOpenRouterError
    ? error
    : new AiLlmOpenRouterError(
        error instanceof Error ? error.message : String(error),
        GrpcStatus.INTERNAL,
        'AI_LLM_VENDOR_UNAVAILABLE',
        error,
      );
  return {
    name: e.name,
    message: `${e.aiLlmCode}: ${e.message}`,
    code: e.code as unknown as grpc.status,
    details: `${e.aiLlmCode}: ${e.message}`,
    metadata: new grpc.Metadata(),
  };
}

function makeImplementation(module: Partial<Record<AiLlmRpcName, UnaryHandler>>): grpc.UntypedServiceImplementation {
  const implementation: grpc.UntypedServiceImplementation = {};
  for (const rpc of Object.keys(rpcDescriptors) as AiLlmRpcName[]) {
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

export function createOpenRouterGrpcServer(opts: OpenRouterGrpcServerOptions): OpenRouterGrpcServer {
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
