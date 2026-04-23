import { resolve } from 'node:path';
import type { ValidatedManifest } from '../manifest/types.js';
import { GrpcAdapterClient, ProtoRegistry, type ExternalAdapterClient } from '../plugins/adapter-client/index.js';

export function buildAdapterClient(manifest: ValidatedManifest, artifactDir: string): ExternalAdapterClient | null {
  const modules = manifest.modules ?? [];
  if (modules.length === 0) return null;

  const registry = new ProtoRegistry();
  const modulesCfg: Record<string, { address: string; protoPath: string }> = {};
  for (const m of modules) {
    const absProtoPath = resolve(artifactDir, m.protoPath);
    registry.registerModule(m.name, absProtoPath);
    modulesCfg[m.name] = { address: m.grpc.address, protoPath: absProtoPath };
  }
  return new GrpcAdapterClient({ modules: modulesCfg, registry });
}
