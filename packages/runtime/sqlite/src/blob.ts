export function toBuffer(v: Uint8Array | Buffer): Buffer {
  if (Buffer.isBuffer(v)) return v;
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
}

export function toUint8Array(v: Uint8Array | Buffer): Uint8Array {
  return v;
}
