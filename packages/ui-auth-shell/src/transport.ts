export type AuthedTransportOptions = {
  baseFetch: typeof fetch;
  getToken: () => string | null;
  onUnauthenticated: () => void;
};

export function createAuthedTransport(opts: AuthedTransportOptions): typeof fetch {
  return async (input, init) => {
    const token = opts.getToken();
    const headers = new Headers(init?.headers);
    if (token) headers.set('authorization', `Bearer ${token}`);

    const response = await opts.baseFetch(input, {
      ...(init ?? {}),
      headers
    });

    if (response.status === 401) {
      opts.onUnauthenticated();
      throw new Error('UI_AUTH_SHELL_UNAUTHENTICATED');
    }

    return response;
  };
}
