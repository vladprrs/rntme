import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Canonical contract proto source for a single module.
 *
 * `runtimeRelativePath` is the path the runtime should read from its artifact
 * directory at boot. `importPath` is the path that other protos use in their
 * `import` statements (the canonical "rntme/contracts/..." form). For module
 * protos that ship to the runtime root these are the same as
 * `runtimeRelativePath`.
 */
export type ContractProtoSource = {
  readonly runtimeRelativePath: string;
  readonly content: string;
};

const CONTRACT_PROTO_RELATIVE_PATHS = {
  identity: 'packages/contracts/identity/v1/proto/identity.proto',
  ai_llm: 'packages/contracts/ai-llm/v1/proto/ai_llm.proto',
  storage: 'packages/contracts/storage/v1/proto/storage.proto',
  common: 'packages/contracts/_common/v1/proto/common.proto',
} as const;

/**
 * Returns the canonical proto source for an identity module manifest. The
 * runtime artifact path matches the canonical proto name so other protos can
 * import it transparently.
 */
export function loadIdentityContractProto(): ContractProtoSource {
  return {
    runtimeRelativePath: 'protos/identity.proto',
    content: readContractProto(CONTRACT_PROTO_RELATIVE_PATHS.identity),
  };
}

export function loadAiLlmContractProto(): ContractProtoSource {
  return {
    runtimeRelativePath: 'protos/ai_llm.proto',
    content: readContractProto(CONTRACT_PROTO_RELATIVE_PATHS.ai_llm),
  };
}

export function loadStorageContractProto(): ContractProtoSource {
  return {
    runtimeRelativePath: 'protos/storage.proto',
    content: readContractProto(CONTRACT_PROTO_RELATIVE_PATHS.storage),
  };
}

/**
 * The common proto is imported by every category proto via the canonical
 * package path `rntme/contracts/common/v1/common.proto`. Emit it at that exact
 * relative path so protobufjs can resolve the import at runtime.
 */
export function loadCommonContractProto(): ContractProtoSource {
  return {
    runtimeRelativePath: 'protos/rntme/contracts/common/v1/common.proto',
    content: readContractProto(CONTRACT_PROTO_RELATIVE_PATHS.common),
  };
}

function readContractProto(workspaceRelativePath: string): string {
  const root = findWorkspaceRootForContracts();
  const absPath = join(root, workspaceRelativePath);
  if (!existsSync(absPath)) {
    throw new Error(`DEPLOY_BUNDLE_CONTRACT_PROTO_NOT_FOUND:${workspaceRelativePath}`);
  }
  return readFileSync(absPath, 'utf8');
}

function findWorkspaceRootForContracts(): string {
  // Probe both CWD and the package src dir so this works regardless of where
  // the bundle entrypoint was invoked from (CLI direct-mode vs platform BPMN).
  for (const start of [process.cwd(), dirname(fileURLToPath(import.meta.url))]) {
    let current = start;
    while (true) {
      if (existsSync(join(current, 'packages', 'contracts', '_common', 'v1', 'proto', 'common.proto'))) {
        return current;
      }
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  throw new Error('DEPLOY_BUNDLE_CONTRACT_PROTO_WORKSPACE_ROOT_NOT_FOUND');
}
