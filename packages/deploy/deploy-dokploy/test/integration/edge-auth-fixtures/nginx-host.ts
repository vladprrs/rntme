import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';

export type StartedNginxHost = {
  readonly baseUrl: string;
  stop: () => Promise<void>;
};

export const HOST_GATEWAY_HOSTNAME = 'host.docker.internal';

/**
 * Boot a real `nginx:1.27-alpine` container with the rendered config, exposing
 * port 8080. The container reaches the test process (introspect sidecar) via
 * the `host.docker.internal` extra-host bound to `host-gateway`.
 *
 * Requires a working testcontainers runtime. Tests using this fixture should
 * skip when testcontainers cannot start containers.
 */
export async function startNginxHost(opts: { readonly nginxConfig: string }): Promise<StartedNginxHost> {
  const dir = await mkdtemp(join(tmpdir(), 'rntme-nginx-'));
  const configPath = join(dir, 'nginx.conf');
  await writeFile(configPath, opts.nginxConfig);

  const container: StartedTestContainer = await new GenericContainer('nginx:1.27-alpine')
    .withExposedPorts(8080)
    .withBindMounts([{ source: configPath, target: '/etc/nginx/nginx.conf', mode: 'ro' }])
    .withExtraHosts([{ host: HOST_GATEWAY_HOSTNAME, ipAddress: 'host-gateway' }])
    .start();

  return {
    baseUrl: `http://${container.getHost()}:${container.getMappedPort(8080)}`,
    stop: async () => {
      await container.stop();
    },
  };
}
