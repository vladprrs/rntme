import { describe, expect, it } from 'bun:test';
import { toKafkaJsSubscriptionTopic } from '../../src/plugins/kafka-js-bus.js';

describe('KafkaJsEventBus', () => {
  it('converts wildcard topic patterns to KafkaJS regex subscriptions', () => {
    const topic = toKafkaJsSubscriptionTopic('rntme.rnt364.smoke.app.*');

    expect(topic).toBeInstanceOf(RegExp);
    expect(topic).toEqual(/^rntme\.rnt364\.smoke\.app\..*$/);
    expect('rntme.rnt364.smoke.app.note').toMatch(topic as RegExp);
    expect('rntme.rnt364.smoke.other.note').not.toMatch(topic as RegExp);
  });

  it('keeps exact topic subscriptions as strings', () => {
    expect(toKafkaJsSubscriptionTopic('rntme.rnt364.smoke.app.note')).toBe(
      'rntme.rnt364.smoke.app.note',
    );
  });
});
