export type TransportMiddleware = (
  req: Request,
  next: (req: Request) => Promise<Response>,
) => Promise<Response>;

export type TransportChain = {
  use(mw: TransportMiddleware): void;
  fetch(req: Request): Promise<Response>;
};

export function createTransportChain(baseFetch: (req: Request) => Promise<Response>): TransportChain {
  const middlewares: TransportMiddleware[] = [];
  return {
    use(mw) {
      middlewares.push(mw);
    },
    fetch(req) {
      const composed = middlewares.reduce<(r: Request) => Promise<Response>>(
        (next, mw) => (r) => mw(r, next),
        baseFetch,
      );
      return composed(req);
    },
  };
}
