import type { Hono } from 'hono';
import {
  createGrpcServer,
  type GrpcServerHandle,
} from '@rntme/bindings-grpc';
import type {
  CommandExecutor,
  QueryExecutor,
} from '@rntme/bindings-http/executor-contract';
import type { Surface, SurfaceContext } from './interfaces.js';
import type { ResolvedShape } from '@rntme/bindings';

export type GrpcSurfaceOptions = {
  port: number;
  packageName: string;
  serviceName: string;
  commandExecutor: CommandExecutor;
  queryExecutor: QueryExecutor;
  shapes: Record<string, ResolvedShape>;
};

export class GrpcSurface implements Surface {
  private handle: GrpcServerHandle | null = null;
  private listenedPort = 0;

  constructor(private readonly opts: GrpcSurfaceOptions) {}

  mount(_app: Hono, _ctx: SurfaceContext): void {
    /* no-op */
  }

  async listen(ctx: SurfaceContext): Promise<{ port: number; stop(): Promise<void> }> {
    this.handle = createGrpcServer({
      validated: ctx.service.bindings,
      shapes: this.opts.shapes,
      packageName: this.opts.packageName,
      serviceName: this.opts.serviceName,
      commandExecutor: this.opts.commandExecutor,
      queryExecutor: this.opts.queryExecutor,
      eventStore: ctx.eventStore,
      qsmDb: ctx.qsmDb,
    });
    this.listenedPort = await this.handle.listen(this.opts.port);
    return {
      port: this.listenedPort,
      stop: async (): Promise<void> => {
        if (this.handle !== null) await this.handle.stop();
      },
    };
  }
}
