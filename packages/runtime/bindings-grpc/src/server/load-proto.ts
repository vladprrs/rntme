import protobuf from 'protobufjs';

export type LoadedProto = {
  root: protobuf.Root;
  service: protobuf.Service;
  messageTypes: Record<string, protobuf.Type>;
};

export function loadProtoFromString(protoSrc: string, fullyQualifiedServiceName: string): LoadedProto {
  const parsed = protobuf.parse(protoSrc, { keepCase: true });
  const root = parsed.root;
  root.addJSON(protobuf.common.get('google/protobuf/struct.proto')?.nested ?? {});
  const service = root.lookupService(fullyQualifiedServiceName);

  const pkgName = fullyQualifiedServiceName.split('.').slice(0, -1).join('.');
  const pkg = pkgName.length > 0 ? root.lookup(pkgName) : root;
  if (pkg === null || pkg === undefined) {
    throw new Error(`package "${pkgName}" not found in parsed proto`);
  }

  const messageTypes: Record<string, protobuf.Type> = {};
  const maybeNested = (pkg as unknown as { nested?: Record<string, protobuf.ReflectionObject> }).nested ?? {};
  for (const [name, obj] of Object.entries(maybeNested)) {
    if (obj instanceof protobuf.Type) {
      messageTypes[name] = obj;
    }
  }

  return { root, service, messageTypes };
}
