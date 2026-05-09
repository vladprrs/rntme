import type { RenderedComposeService } from './compose-model.js';

export function renderComposeYaml(services: readonly RenderedComposeService[]): string {
  const lines: string[] = ['services:'];
  for (const service of [...services].sort((a, b) => a.name.localeCompare(b.name))) {
    lines.push(`  ${service.name}:`);
    lines.push(`    image: ${yamlScalar(service.image)}`);
    if (service.command !== undefined) lines.push(`    command: ${yamlScalar(service.command)}`);
    if (service.args !== undefined && service.args.length > 0) {
      lines.push('    args:');
      for (const arg of service.args) lines.push(`      - ${yamlScalar(arg)}`);
    }
    lines.push(`    restart: ${service.restart.container}`);
    if (service.env.length > 0) {
      lines.push('    environment:');
      for (const env of [...service.env].sort((a, b) => a.name.localeCompare(b.name))) {
        lines.push(`      ${env.name}: ${yamlScalar(`\${${env.name}}`)}`);
      }
    }
    if (service.ports !== undefined && service.ports.length > 0) {
      lines.push('    expose:');
      for (const port of [...service.ports].sort((a, b) => a - b)) lines.push(`      - "${port}"`);
    }
    if (service.volumes !== undefined && service.volumes.length > 0) {
      lines.push('    volumes:');
      for (const volume of service.volumes) {
        const suffix = volume.readOnly ? ':ro' : '';
        lines.push(`      - ${yamlScalar(`${volume.source}:${volume.target}${suffix}`)}`);
      }
    }
    lines.push('    networks:');
    lines.push('      - default');
    if (service.name === 'edge' || service.serviceClass === 'infrastructure-proxy') {
      lines.push('      - dokploy-network');
    }
    lines.push('    deploy:');
    if (service.restart.swarm !== undefined) {
      lines.push('      restart_policy:');
      lines.push(`        condition: ${service.restart.swarm.condition}`);
      lines.push(`        delay: ${service.restart.swarm.delay}`);
      lines.push(`        max_attempts: ${service.restart.swarm.maxAttempts}`);
      lines.push(`        window: ${service.restart.swarm.window}`);
    }
    lines.push('      resources:');
    lines.push('        limits:');
    lines.push(`          cpus: "${service.resources.cpus}"`);
    lines.push(`          memory: ${service.resources.memory}`);
  }
  lines.push('networks:');
  lines.push('  dokploy-network:');
  lines.push('    external: true');
  lines.push('');
  return lines.join('\n');
}

function yamlScalar(value: string): string {
  if (/^[A-Za-z0-9._/:@{}$-]+$/.test(value)) return value;
  return JSON.stringify(value);
}
