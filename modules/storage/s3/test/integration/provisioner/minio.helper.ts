import { GenericContainer, type StartedTestContainer } from 'testcontainers';

export interface StartedMinio {
  container: StartedTestContainer;
  endpoint: string;
  rootUser: string;
  rootPassword: string;
}

export async function startMinio(): Promise<StartedMinio> {
  const container = await new GenericContainer('minio/minio:latest')
    .withCommand(['server', '/data'])
    .withEnvironment({
      MINIO_ROOT_USER: 'rntme-admin',
      MINIO_ROOT_PASSWORD: 'rntme-admin-pw',
    })
    .withExposedPorts(9000)
    .start();

  return {
    container,
    endpoint: `http://${container.getHost()}:${container.getMappedPort(9000)}`,
    rootUser: 'rntme-admin',
    rootPassword: 'rntme-admin-pw',
  };
}
