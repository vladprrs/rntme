import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_NGINX_CONF } from './nginx.conf.js';
import { err, ok, type Result } from './result-shim.js';
import type { ProvisionError } from './types.js';

export type CommandRunner = (command: string, args: readonly string[], log: (message: string) => void) => Promise<number>;

export type BuildInput = {
  readonly bundleDir: string;
  readonly imageRef: string;
  readonly registry: { readonly url: string; readonly username?: string; readonly password?: string };
  readonly log: (message: string) => void;
  readonly run?: CommandRunner;
};

export async function buildAndPushImage(input: BuildInput): Promise<Result<{ imageRef: string }, ProvisionError>> {
  const dockerfile = [
    'FROM nginx:alpine',
    'COPY ./bundle /usr/share/nginx/html',
    'COPY ./nginx.conf /etc/nginx/conf.d/default.conf',
    'EXPOSE 80',
    '',
  ].join('\n');
  const contextDir = join(input.bundleDir, '..');
  await writeFile(join(contextDir, 'Dockerfile'), dockerfile);
  await writeFile(join(contextDir, 'nginx.conf'), DEFAULT_NGINX_CONF);

  const run = input.run ?? runCommand;
  const code = await run('docker', ['buildx', 'build', '--push', '--tag', input.imageRef, contextDir], input.log);
  if (code !== 0) {
    return err({ code: 'MARKETING_SITE_PROVISION_IMAGE_BUILD_FAILED', message: `docker buildx exited ${code}` });
  }
  return ok({ imageRef: input.imageRef });
}

async function runCommand(command: string, args: readonly string[], log: (message: string) => void): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command, [...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => log(String(chunk)));
    child.stderr.on('data', (chunk) => log(String(chunk)));
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}
