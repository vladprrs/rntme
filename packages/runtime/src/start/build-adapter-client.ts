import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as grpc from '@grpc/grpc-js';
import type { ValidatedManifest } from '../manifest/types.js';
import { GrpcAdapterClient, ProtoRegistry, type ExternalAdapterClient } from '../plugins/adapter-client/index.js';

export function buildAdapterClient(
  manifest: ValidatedManifest,
  artifactDir: string,
  addressOverrides: Readonly<Record<string, string>> = {},
): ExternalAdapterClient | null {
  const modules = manifest.modules ?? [];
  if (modules.length === 0) return null;

  const registry = new ProtoRegistry();
  const modulesCfg: Record<string, { address: string; protoPath: string; credentials?: grpc.ChannelCredentials }> = {};
  for (const m of modules) {
    const absProtoPath = resolve(artifactDir, m.protoPath);
    registry.registerModule(m.name, absProtoPath);
    const credentials = buildCredentials(m.grpc.tls, artifactDir);
    const address = addressOverrides[m.name] ?? m.grpc.address;
    modulesCfg[m.name] = credentials === undefined
      ? { address, protoPath: absProtoPath }
      : { address, protoPath: absProtoPath, credentials };
  }
  return new GrpcAdapterClient({ modules: modulesCfg, registry });
}

function buildCredentials(
  tls: ValidatedManifest['modules'][number]['grpc']['tls'],
  artifactDir: string,
): grpc.ChannelCredentials | undefined {
  if (tls === undefined) return undefined;
  const rootCert = tls.rootCertPath !== undefined ? readFileSync(resolve(artifactDir, tls.rootCertPath)) : undefined;
  const privateKey = tls.privateKeyPath !== undefined ? readFileSync(resolve(artifactDir, tls.privateKeyPath)) : undefined;
  const certChain = tls.certChainPath !== undefined ? readFileSync(resolve(artifactDir, tls.certChainPath)) : undefined;
  return grpc.credentials.createSsl(rootCert, privateKey, certChain);
}
