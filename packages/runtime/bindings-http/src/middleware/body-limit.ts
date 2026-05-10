import type { MiddlewareHandler } from 'hono';

export type BodyLimitOptions = {
  code?: string;
};

export function bodyLimit(maxBytes: number, opts: BodyLimitOptions = {}): MiddlewareHandler {
  const code = opts.code ?? 'BODY_LIMIT_EXCEEDED';
  const tooLarge = (c: Parameters<MiddlewareHandler>[0]): Response =>
    c.json({ error: { code, message: `body exceeds ${maxBytes} bytes` } }, 413);

  return async (c, next) => {
    const header = c.req.header('content-length');
    const declared = header !== undefined ? Number(header) : undefined;
    const declaredValid = declared !== undefined && Number.isFinite(declared) && declared >= 0;
    if (declaredValid) {
      if (declared > maxBytes) return tooLarge(c);
      return next();
    }
    const raw = c.req.raw.body;
    if (raw) {
      const reader = raw.getReader();
      let total = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) return tooLarge(c);
        chunks.push(value);
      }
      const body = new Blob(chunks as unknown as BlobPart[]);
      const req = new Request(c.req.url, {
        method: c.req.method,
        headers: c.req.raw.headers,
        body,
      });
      (c.req as unknown as { raw: Request }).raw = req;
    }
    return next();
  };
}
