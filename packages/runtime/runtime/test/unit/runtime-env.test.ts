import { describe, expect, it } from 'vitest';
import {
  buildKafkaJsClientConfigFromEnv,
  parseRuntimeAuthEnv,
} from '../../src/start/runtime-env.js';

describe('runtime env parsing', () => {
  it('returns null when auth env is absent', () => {
    expect(parseRuntimeAuthEnv({})).toBeNull();
  });

  it('requires an auth endpoint when provider is set', () => {
    expect(() =>
      parseRuntimeAuthEnv({
        RNTME_AUTH_PROVIDER: 'auth0',
        RNTME_AUTH_AUDIENCE: 'https://notes.example.com/api',
        RNTME_AUTH_MODULE_SLUG: 'identity-auth0',
      }),
    ).toThrow(expect.objectContaining({ code: 'RUNTIME_BOOT_AUTH_ENDPOINT_MISSING' }));
  });

  it('requires audience and module slug when provider is set', () => {
    expect(() =>
      parseRuntimeAuthEnv({
        RNTME_AUTH_PROVIDER: 'auth0',
        RNTME_AUTH_MODULE_ENDPOINT: 'identity-auth0:50051',
      }),
    ).toThrow(expect.objectContaining({ code: 'RUNTIME_BOOT_AUTH_CONFIG_INCOMPLETE' }));
  });

  it('parses complete Auth0 runtime env', () => {
    expect(
      parseRuntimeAuthEnv({
        RNTME_AUTH_PROVIDER: 'auth0',
        RNTME_AUTH_AUDIENCE: 'https://notes.example.com/api',
        RNTME_AUTH_MODULE_SLUG: 'identity-auth0',
        RNTME_AUTH_MODULE_ENDPOINT: 'identity-auth0:50051',
      }),
    ).toEqual({
      provider: 'auth0',
      audience: 'https://notes.example.com/api',
      moduleSlug: 'identity-auth0',
      moduleEndpoint: 'identity-auth0:50051',
    });
  });

  it('builds plaintext KafkaJS client config from event bus env', () => {
    expect(
      buildKafkaJsClientConfigFromEnv(
        { RNTME_EVENT_BUS_BROKERS: 'redpanda-1:9092,redpanda-2:9092' },
        'notes',
      ),
    ).toEqual({
      clientId: 'notes',
      brokers: ['redpanda-1:9092', 'redpanda-2:9092'],
      connectionTimeout: 10000,
    });
  });

  it('builds SASL_SSL KafkaJS client config without redacting values before construction', () => {
    expect(
      buildKafkaJsClientConfigFromEnv(
        {
          RNTME_EVENT_BUS_BROKERS: 'redpanda.example.com:9092',
          RNTME_EVENT_BUS_PROTOCOL: 'sasl_ssl',
          RNTME_EVENT_BUS_MECHANISM: 'scram-sha-512',
          RNTME_EVENT_BUS_USERNAME: 'notes-demo',
          RNTME_EVENT_BUS_PASSWORD: 'scram-password',
        },
        'notes',
      ),
    ).toEqual({
      clientId: 'notes',
      brokers: ['redpanda.example.com:9092'],
      connectionTimeout: 10000,
      ssl: true,
      sasl: {
        mechanism: 'scram-sha-512',
        username: 'notes-demo',
        password: 'scram-password',
      },
    });
  });

  it('allows deploy env to override the KafkaJS connection timeout', () => {
    expect(
      buildKafkaJsClientConfigFromEnv(
        {
          RNTME_EVENT_BUS_BROKERS: 'redpanda.example.com:9092',
          RNTME_EVENT_BUS_CONNECTION_TIMEOUT_MS: '15000',
        },
        'notes',
      ),
    ).toEqual({
      clientId: 'notes',
      brokers: ['redpanda.example.com:9092'],
      connectionTimeout: 15000,
    });
  });

  it('rejects incomplete SASL_SSL Kafka env', () => {
    expect(() =>
      buildKafkaJsClientConfigFromEnv(
        {
          RNTME_EVENT_BUS_BROKERS: 'redpanda.example.com:9092',
          RNTME_EVENT_BUS_PROTOCOL: 'sasl_ssl',
          RNTME_EVENT_BUS_MECHANISM: 'scram-sha-256',
          RNTME_EVENT_BUS_USERNAME: 'notes-demo',
        },
        'notes',
      ),
    ).toThrow(expect.objectContaining({ code: 'RUNTIME_BOOT_EVENT_BUS_SASL_INCOMPLETE' }));
  });
});
