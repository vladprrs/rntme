import { describe, expect, it } from 'bun:test';
import type { RenderedComposeService } from '../../src/compose-model.js';
import { renderComposeYaml } from '../../src/compose-yaml.js';

function service(overrides: Partial<RenderedComposeService> = {}): RenderedComposeService {
  return {
    name: 'svc-app',
    logicalId: 'app',
    serviceClass: 'domain-service',
    workloadKind: 'domain-service',
    workloadSlug: 'app',
    image: 'rntme-runtime',
    env: [],
    restart: {
      container: 'on-failure:3',
      swarm: { condition: 'on-failure', delay: '30s', maxAttempts: 3, window: '5m' },
    },
    resources: { cpus: '0.50', memory: '512M' },
    ...overrides,
  };
}

describe('renderComposeYaml', () => {
  it('keeps YAML-looking literal env values as strings', () => {
    const rendered = renderComposeYaml([
      service({
        literalEnv: {
          BOOLEAN_FLAG: 'true',
          FLOW_LIKE_TOKEN: '{token}',
          NUMERIC_ID: '123',
        },
      }),
    ]);

    expect(rendered).toContain('      BOOLEAN_FLAG: "true"\n');
    expect(rendered).toContain('      FLOW_LIKE_TOKEN: "{token}"\n');
    expect(rendered).toContain('      NUMERIC_ID: "123"\n');
  });
});
