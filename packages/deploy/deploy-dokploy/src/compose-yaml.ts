import type { RenderedComposeService } from './compose-model.js';
import YAML from 'yaml';

export function renderComposeYaml(services: readonly RenderedComposeService[]): string {
  const sortedServices = [...services].sort((a, b) => a.name.localeCompare(b.name));
  const document: ComposeDocument = {
    services: Object.fromEntries(sortedServices.map((service) => [service.name, composeService(service)])),
    networks: {
      'dokploy-network': { external: true },
    },
  };
  const namedVolumes = collectNamedVolumeSources(sortedServices);
  if (namedVolumes.length > 0) {
    document.volumes = Object.fromEntries(namedVolumes.map((volumeName) => [volumeName, {}]));
  }

  return YAML.stringify(document, { lineWidth: 0 });
}

type ComposeDocument = {
  services: Record<string, ComposeServiceYaml>;
  networks: {
    'dokploy-network': { external: true };
  };
  volumes?: Record<string, Record<string, never>>;
};

type ComposeServiceYaml = {
  image: string;
  user?: string;
  entrypoint?: readonly string[];
  command?: string;
  args?: readonly string[];
  restart: RenderedComposeService['restart']['container'];
  environment?: Record<string, string>;
  expose?: readonly string[];
  volumes?: readonly string[];
  networks: readonly string[];
  deploy: {
    restart_policy?: {
      condition: 'on-failure';
      delay: '30s';
      max_attempts: 3;
      window: '5m';
    };
    resources: {
      limits: {
        cpus: RenderedComposeService['resources']['cpus'];
        memory: RenderedComposeService['resources']['memory'];
      };
    };
  };
};

function composeService(service: RenderedComposeService): ComposeServiceYaml {
  const rendered: ComposeServiceYaml = {
    image: service.image,
    ...(service.user === undefined ? {} : { user: service.user }),
    ...(service.entrypoint === undefined || service.entrypoint.length === 0 ? {} : { entrypoint: service.entrypoint }),
    ...(service.command === undefined ? {} : { command: service.command }),
    ...(service.args === undefined || service.args.length === 0 ? {} : { args: service.args }),
    restart: service.restart.container,
    ...composeEnvironment(service),
    ...(service.ports === undefined || service.ports.length === 0
      ? {}
      : { expose: [...service.ports].sort((a, b) => a - b).map((port) => String(port)) }),
    ...(service.volumes === undefined || service.volumes.length === 0
      ? {}
      : {
          volumes: service.volumes.map((volume) => {
            const suffix = volume.readOnly ? ':ro' : '';
            return `${volume.source}:${volume.target}${suffix}`;
          }),
        }),
    networks:
      service.name === 'edge' || service.serviceClass === 'infrastructure-proxy'
        ? ['default', 'dokploy-network']
        : ['default'],
    deploy: {
      ...(service.restart.swarm === undefined
        ? {}
        : {
            restart_policy: {
              condition: service.restart.swarm.condition,
              delay: service.restart.swarm.delay,
              max_attempts: service.restart.swarm.maxAttempts,
              window: service.restart.swarm.window,
            },
          }),
      resources: {
        limits: {
          cpus: service.resources.cpus,
          memory: service.resources.memory,
        },
      },
    },
  };
  return rendered;
}

function composeEnvironment(service: RenderedComposeService): Pick<ComposeServiceYaml, 'environment'> {
  const literalEnv = service.literalEnv ?? {};
  if (service.env.length === 0 && Object.keys(literalEnv).length === 0) return {};
  const environment: Record<string, string> = {};
  for (const env of [...service.env].sort((a, b) => a.name.localeCompare(b.name))) {
    environment[env.name] = `\${${env.name}}`;
  }
  for (const [name, value] of Object.entries(literalEnv).sort(([a], [b]) => a.localeCompare(b))) {
    environment[name] = value;
  }
  return { environment };
}

function collectNamedVolumeSources(services: readonly RenderedComposeService[]): string[] {
  const names = new Set<string>();
  for (const service of services) {
    for (const volume of service.volumes ?? []) {
      if (isNamedVolumeSource(volume.source)) names.add(volume.source);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

function isNamedVolumeSource(source: string): boolean {
  return !(source.startsWith('/') || source.startsWith('./') || source.startsWith('../') || source.startsWith('~'));
}
