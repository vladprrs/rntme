export interface OpenRouterClientOptions {
  apiKey: string;
  baseUrl: string;
  httpReferer?: string;
  xTitle?: string;
  fetch?: typeof globalThis.fetch;
}

export interface OrErrorEnvelope {
  httpStatus?: number;
  orError?: { code?: string; message?: string };
  networkError?: unknown;
}

export class OpenRouterClient {
  private readonly opts: OpenRouterClientOptions;
  constructor(opts: OpenRouterClientOptions) {
    this.opts = opts;
  }

  async chatCompletions(body: object): Promise<unknown> {
    const fetchFn = this.opts.fetch ?? globalThis.fetch;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.opts.apiKey}`,
      'Content-Type': 'application/json',
    };
    if (this.opts.httpReferer) headers['HTTP-Referer'] = this.opts.httpReferer;
    if (this.opts.xTitle) headers['X-Title'] = this.opts.xTitle;

    let res: Response;
    try {
      res = await fetchFn(`${this.opts.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch (networkError) {
      throw { networkError } satisfies OrErrorEnvelope;
    }

    if (!res.ok) {
      let orError: { code?: string; message?: string } | undefined;
      try {
        const parsed = (await res.json()) as { error?: { code?: string; message?: string } };
        orError = parsed?.error;
      } catch {
        // ignore parse failure
      }
      const envelope: OrErrorEnvelope = { httpStatus: res.status };
      if (orError) envelope.orError = orError;
      throw envelope;
    }

    return await res.json();
  }
}
