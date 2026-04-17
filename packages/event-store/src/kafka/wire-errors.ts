export class CloudEventDecodeError extends Error {
  constructor(
    public readonly code:
      | 'EVENT_STORE_WIRE_DECODE_MISSING_ATTR'
      | 'EVENT_STORE_WIRE_DECODE_UNKNOWN_SPEC'
      | 'EVENT_STORE_WIRE_DECODE_INVALID_INT',
    message: string,
  ) {
    super(message);
    this.name = 'CloudEventDecodeError';
  }
}
