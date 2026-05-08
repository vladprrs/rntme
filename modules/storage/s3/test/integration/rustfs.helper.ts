import { GenericContainer, type StartedTestContainer } from 'testcontainers';

export async function startRustfs(): Promise<{
  container: StartedTestContainer;
  endpoint: string;
  bucket: string;
}> {
  const container = await new GenericContainer('rustfs/rustfs:latest')
    .withExposedPorts(9000)
    .withEnvironment({
      RUSTFS_ROOT_USER: 'rntme',
      RUSTFS_ROOT_PASSWORD: 'rntme-test-pw',
    })
    .start();
  const port = container.getMappedPort(9000);
  return {
    container,
    endpoint: `http://${container.getHost()}:${port}`,
    bucket: 'rntme-storage-test',
  };
}
