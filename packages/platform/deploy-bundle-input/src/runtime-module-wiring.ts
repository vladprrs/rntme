import type { ComposedBlueprint, ServiceGraphSpec } from '@rntme/blueprint';
import {
  loadAiLlmContractProto,
  loadCommonContractProto,
  loadIdentityContractProto,
  loadStorageContractProto,
  type ContractProtoSource,
} from './contract-protos.js';

export type RuntimeModuleManifestEntry = {
  readonly name: string;
  readonly grpc: { address: string };
  readonly protoPath: string;
};

export type RuntimeModuleWiring = {
  /** Manifest module entries to embed in `manifest.json`. */
  readonly modules: RuntimeModuleManifestEntry[];
  /** Runtime artifact files (relative path → content) that must accompany the manifest. */
  readonly files: Record<string, string>;
};

/**
 * Walks every graph node and returns the set of `target.module` names for
 * `call` nodes. Each returned string is the manifest-module name as declared
 * in the graph IR (which equals the project moduleKey when a service uses an
 * alias, and the service slug otherwise).
 */
export function collectGraphModuleTargets(graphSpec: ServiceGraphSpec | null): Set<string> {
  const out = new Set<string>();
  if (graphSpec === null) return out;
  for (const graph of Object.values(graphSpec.graphs)) {
    for (const rawNode of graph.nodes) {
      const moduleName = moduleTargetFromNode(rawNode);
      if (moduleName !== null) out.add(moduleName);
    }
  }
  return out;
}

function moduleTargetFromNode(node: unknown): string | null {
  if (typeof node !== 'object' || node === null) return null;
  const candidate = node as { readonly type?: unknown; readonly target?: unknown };
  if (candidate.type !== 'call') return null;
  if (typeof candidate.target !== 'object' || candidate.target === null) return null;
  const target = candidate.target as { readonly module?: unknown };
  if (typeof target.module !== 'string' || target.module.length === 0) return null;
  return target.module;
}

/**
 * Build the inverse map: project moduleKey → service slug. Integration-module
 * services declare `moduleKey` (for example `storage` → `storage-s3`); domain
 * services and integration services without a module alias contribute no
 * entry. Callers fall back to the moduleKey itself when no entry exists.
 */
export function buildServiceSlugByModuleKey(
  project: ComposedBlueprint,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const serviceSlug of project.project.services) {
    const service = project.services[serviceSlug];
    if (service === undefined) continue;
    if (service.moduleKey !== undefined && service.moduleKey.length > 0) {
      out.set(service.moduleKey, serviceSlug);
    }
  }
  return out;
}

/**
 * Computes the manifest module list and the supporting runtime artifact files
 * (proto sources) required for a single service. Combines:
 *
 * - Graph-IR `call` targets (any `target.module` referenced from this
 *   service's graphs).
 * - Auth middleware module slugs that apply to this service (the existing
 *   middleware-driven path).
 */
export function buildRuntimeModuleWiringForService(
  project: ComposedBlueprint,
  serviceSlug: string,
  serviceSlugByModuleKey: Map<string, string>,
): RuntimeModuleWiring {
  const service = project.services[serviceSlug];
  if (service === undefined) return { modules: [], files: {} };

  const moduleKeys = new Set<string>();
  for (const moduleKey of collectGraphModuleTargets(service.graphSpec)) {
    moduleKeys.add(moduleKey);
  }
  for (const slug of authMiddlewareModuleSlugsForService(project, serviceSlug)) {
    moduleKeys.add(slug);
  }
  return buildWiringFromModuleKeys(moduleKeys, serviceSlugByModuleKey);
}

/**
 * UI-host services aggregate manifest modules from every service whose
 * bindings they re-export. Mirrors `runtimeModulesForUiHost` in
 * `to-deploy-core-input` but driven by graph calls + middleware-derived
 * module slugs.
 */
export function buildRuntimeModuleWiringForUiHost(
  project: ComposedBlueprint,
  serviceSlugByModuleKey: Map<string, string>,
): RuntimeModuleWiring {
  const moduleKeys = new Set<string>();
  const sourceServices = new Set<string>(Object.values(project.bindingRegistry).map((entry) => entry.service));
  for (const sourceSlug of [...sourceServices].sort()) {
    const service = project.services[sourceSlug];
    if (service === undefined) continue;
    for (const moduleKey of collectGraphModuleTargets(service.graphSpec)) {
      moduleKeys.add(moduleKey);
    }
    for (const slug of authMiddlewareModuleSlugsForService(project, sourceSlug)) {
      moduleKeys.add(slug);
    }
  }
  return buildWiringFromModuleKeys(moduleKeys, serviceSlugByModuleKey);
}

function buildWiringFromModuleKeys(
  moduleKeys: Set<string>,
  serviceSlugByModuleKey: Map<string, string>,
): RuntimeModuleWiring {
  if (moduleKeys.size === 0) return { modules: [], files: {} };

  const modules: RuntimeModuleManifestEntry[] = [];
  const files: Record<string, string> = {};
  let needsCommon = false;

  for (const moduleKey of [...moduleKeys].sort()) {
    const serviceSlug = serviceSlugByModuleKey.get(moduleKey) ?? moduleKey;
    const proto = contractProtoForModuleKey(moduleKey);
    modules.push({
      name: moduleKey,
      grpc: { address: `mod-${serviceSlug}:50051` },
      protoPath: proto.runtimeRelativePath,
    });
    files[proto.runtimeRelativePath] = proto.content;
    needsCommon = true;
  }

  if (needsCommon) {
    const common = loadCommonContractProto();
    files[common.runtimeRelativePath] = common.content;
  }

  return { modules, files };
}

/**
 * Maps a graph-IR module name to its canonical contract proto. The map is
 * deliberately explicit: each new vendor category needs both a canonical
 * proto in `packages/contracts/<category>/v1/proto/` and an entry here.
 */
function contractProtoForModuleKey(moduleKey: string): ContractProtoSource {
  // Identity modules use the canonical identity proto regardless of vendor.
  // The graph target is the vendor service slug (e.g. "identity-auth0"), so
  // we treat the slug "identity-auth0" as the identity contract. Future
  // identity vendors will fall under the same branch via the "identity-"
  // prefix convention.
  if (moduleKey === 'identity-auth0' || moduleKey === 'identity' || moduleKey.startsWith('identity-')) {
    return loadIdentityContractProto();
  }
  if (moduleKey === 'openrouter' || moduleKey === 'ai_llm' || moduleKey === 'ai-llm') {
    return loadAiLlmContractProto();
  }
  if (moduleKey === 'storage') {
    return loadStorageContractProto();
  }
  throw new Error(`DEPLOY_BUNDLE_MODULE_PROTO_UNKNOWN:${moduleKey}`);
}

function authMiddlewareModuleSlugsForService(
  project: ComposedBlueprint,
  serviceSlug: string,
): string[] {
  const slugs: string[] = [];
  for (const [middlewareName, declaration] of Object.entries(project.project.middleware ?? {})) {
    if (declaration.kind !== 'auth') continue;
    if (!middlewareAppliesToService(project, middlewareName, serviceSlug)) continue;
    const providers = (declaration as { readonly providers?: readonly { readonly provider: string; readonly moduleSlug: string }[] }).providers;
    if (providers === undefined) continue;
    for (const provider of providers) {
      if (provider.provider === 'platform-tokens') continue;
      slugs.push(provider.moduleSlug);
    }
  }
  return slugs;
}

function middlewareAppliesToService(
  project: ComposedBlueprint,
  middlewareName: string,
  serviceSlug: string,
): boolean {
  for (const mount of project.project.mounts ?? []) {
    if (!mount.use.includes(middlewareName)) continue;
    if (serviceForMountTarget(project, mount.target) === serviceSlug) return true;
  }
  return false;
}

function serviceForMountTarget(project: ComposedBlueprint, target: string): string | undefined {
  if (target.startsWith('http:')) return project.project.routes?.http?.[target.slice('http:'.length)];
  if (target.startsWith('ui:')) return project.project.routes?.ui?.[target.slice('ui:'.length)];
  return undefined;
}
