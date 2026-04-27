/**
 * Canonical Message fixtures: short, deterministic, suitable for the generic
 * mock-vendor (which returns a fixed Completion shape) and acceptable for
 * live-vendor smoke runs (won't burn many tokens).
 */

export const userHello = {
  role: 'user' as const,
  content: [{ type: 1 /* TEXT */, text: { text: 'Hello' } }],
};

export const userMath = {
  role: 'user' as const,
  content: [{ type: 1 /* TEXT */, text: { text: 'What is 2+2?' } }],
};

export const userWeather = {
  role: 'user' as const,
  content: [{ type: 1 /* TEXT */, text: { text: "What's the weather in Berlin?" } }],
};

export const systemHelpful = {
  role: 'system' as const,
  content: [{ type: 1 /* TEXT */, text: { text: 'You are a helpful assistant.' } }],
};

export const assistantAck = {
  role: 'assistant' as const,
  content: [{ type: 1 /* TEXT */, text: { text: 'Got it.' } }],
};
