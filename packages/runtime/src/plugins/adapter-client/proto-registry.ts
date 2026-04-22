import { readFileSync } from 'node:fs';
import * as protobuf from 'protobufjs';
import * as grpc from '@grpc/grpc-js';

export type MethodDescriptor = grpc.MethodDefinition<object, object>;

type LoadedModule = {
  root: protobuf.Root;
  service: protobuf.Service;
  methods: Record<string, MethodDescriptor>;
};

export class ProtoRegistry {
  private modules: Map<string, LoadedModule> = new Map();

  registerModule(moduleName: string, protoPath: string): void {
    const src = readFileSync(protoPath, 'utf8');
    const parsed = protobuf.parse(src, { keepCase: true });
    const root = parsed.root;
    const pkg = parsed.package ?? '';
    const pkgPrefix = pkg.length > 0 ? `${pkg}.` : '';

    // Find the first Service in the file.
    let service: protobuf.Service | null = null;
    const walk = (obj: protobuf.ReflectionObject): void => {
      if (obj instanceof protobuf.Service && service === null) {
        service = obj;
        return;
      }
      if (obj instanceof protobuf.Namespace) {
        for (const child of Object.values(obj.nested ?? {})) walk(child);
      }
    };
    for (const child of Object.values(root.nested ?? {})) walk(child);
    if (service === null) throw new Error(`no service found in proto file ${protoPath}`);

    const methods: Record<string, MethodDescriptor> = {};
    for (const [methodName, method] of Object.entries(service.methods)) {
      const req = root.lookupType(method.requestType);
      const res = root.lookupType(method.responseType);
      methods[methodName] = {
        path: `/${pkgPrefix}${service.name}/${methodName}`,
        requestStream: false,
        responseStream: false,
        requestSerialize: (v: object): Buffer => Buffer.from(req.encode(req.fromObject(v)).finish()),
        requestDeserialize: (b: Buffer): object => req.toObject(req.decode(b)),
        responseSerialize: (v: object): Buffer => Buffer.from(res.encode(res.fromObject(v)).finish()),
        responseDeserialize: (b: Buffer): object => res.toObject(res.decode(b)),
      };
    }
    this.modules.set(moduleName, { root, service, methods });
  }

  getMethodDescriptors(moduleName: string): Record<string, MethodDescriptor> {
    const loaded = this.modules.get(moduleName);
    if (loaded === undefined) throw new Error(`module "${moduleName}" is not registered in the ProtoRegistry`);
    return loaded.methods;
  }

  hasModule(moduleName: string): boolean {
    return this.modules.has(moduleName);
  }
}
