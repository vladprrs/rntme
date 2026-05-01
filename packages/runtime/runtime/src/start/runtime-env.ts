export type RuntimeAuthEnv = {
  readonly provider: 'auth0';
  readonly audience: string;
  readonly moduleSlug: string;
  readonly moduleEndpoint: string;
};

export type KafkaJsSaslMechanism = 'scram-sha-256' | 'scram-sha-512';

export type KafkaJsClientConfig = {
  readonly clientId: string;
  readonly brokers: readonly string[];
  readonly ssl?: true;
  readonly sasl?: {
    readonly mechanism: KafkaJsSaslMechanism;
    readonly username: string;
    readonly password: string;
  };
};

export class RuntimeBootError extends Error {
  constructor(
    readonly code:
      | 'RUNTIME_BOOT_AUTH_ENDPOINT_MISSING'
      | 'RUNTIME_BOOT_AUTH_CONFIG_INCOMPLETE'
      | 'RUNTIME_BOOT_AUTH_PROVIDER_UNSUPPORTED'
      | 'RUNTIME_BOOT_AUTH_ARTIFACT_DIR_MISSING'
      | 'RUNTIME_BOOT_AUTH_MODULE_MISSING'
      | 'RUNTIME_BOOT_EVENT_BUS_SASL_INCOMPLETE'
      | 'RUNTIME_BOOT_EVENT_BUS_SASL_MECHANISM_UNSUPPORTED'
      | 'RUNTIME_BOOT_KAFKAJS_UNAVAILABLE',
    message: string,
  ) {
    super(message);
    this.name = 'RuntimeBootError';
  }
}

export function parseRuntimeAuthEnv(env: Record<string, string | undefined>): RuntimeAuthEnv | null {
  const provider = trim(env.RNTME_AUTH_PROVIDER);
  if (provider === undefined) return null;
  if (provider !== 'auth0') {
    throw new RuntimeBootError(
      'RUNTIME_BOOT_AUTH_PROVIDER_UNSUPPORTED',
      `unsupported auth provider "${provider}"`,
    );
  }

  const endpoint = trim(env.RNTME_AUTH_MODULE_ENDPOINT);
  if (endpoint === undefined) {
    throw new RuntimeBootError(
      'RUNTIME_BOOT_AUTH_ENDPOINT_MISSING',
      'RNTME_AUTH_MODULE_ENDPOINT is required when RNTME_AUTH_PROVIDER is set',
    );
  }

  const audience = trim(env.RNTME_AUTH_AUDIENCE);
  const moduleSlug = trim(env.RNTME_AUTH_MODULE_SLUG);
  if (audience === undefined || moduleSlug === undefined) {
    throw new RuntimeBootError(
      'RUNTIME_BOOT_AUTH_CONFIG_INCOMPLETE',
      'RNTME_AUTH_AUDIENCE and RNTME_AUTH_MODULE_SLUG are required when RNTME_AUTH_PROVIDER is set',
    );
  }

  return {
    provider,
    audience,
    moduleSlug,
    moduleEndpoint: endpoint,
  };
}

export function buildKafkaJsClientConfigFromEnv(
  env: Record<string, string | undefined>,
  clientId: string,
): KafkaJsClientConfig | null {
  const brokers = trim(env.RNTME_EVENT_BUS_BROKERS)
    ?.split(',')
    .map((broker) => broker.trim())
    .filter((broker) => broker !== '');
  if (brokers === undefined || brokers.length === 0) return null;

  const protocol = trim(env.RNTME_EVENT_BUS_PROTOCOL) ?? 'plaintext';
  if (protocol !== 'sasl_ssl') {
    return { clientId, brokers };
  }

  const mechanism = trim(env.RNTME_EVENT_BUS_MECHANISM);
  if (mechanism !== 'scram-sha-256' && mechanism !== 'scram-sha-512') {
    throw new RuntimeBootError(
      'RUNTIME_BOOT_EVENT_BUS_SASL_MECHANISM_UNSUPPORTED',
      'RNTME_EVENT_BUS_MECHANISM must be scram-sha-256 or scram-sha-512 for sasl_ssl',
    );
  }

  const username = trim(env.RNTME_EVENT_BUS_USERNAME);
  const password = trim(env.RNTME_EVENT_BUS_PASSWORD);
  if (username === undefined || password === undefined) {
    throw new RuntimeBootError(
      'RUNTIME_BOOT_EVENT_BUS_SASL_INCOMPLETE',
      'RNTME_EVENT_BUS_USERNAME and RNTME_EVENT_BUS_PASSWORD are required for sasl_ssl',
    );
  }

  return {
    clientId,
    brokers,
    ssl: true,
    sasl: {
      mechanism,
      username,
      password,
    },
  };
}

export function parseRuntimeEventBusTopicPrefixFromEnv(
  env: Record<string, string | undefined>,
): string | null {
  return trim(env.RNTME_EVENT_BUS_TOPIC_PREFIX) ?? null;
}

function trim(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
