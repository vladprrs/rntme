#!/usr/bin/env node
import { loadService } from '../load/load-service.js';
import { startService } from '../start/start-service.js';

function usage(): never {
  // eslint-disable-next-line no-console
  console.error('usage: rntme-runtime <start|validate> [artifacts-dir]');
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, maybeDir] = process.argv.slice(2);
  const dir = maybeDir ?? process.env.RNTME_ARTIFACTS_DIR ?? '/srv/artifacts';

  if (cmd === 'validate') {
    const r = loadService(dir);
    if (!r.ok) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ ok: false, errors: r.errors }, null, 2));
      process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        ok: true,
        service: r.value.manifest.service.name,
        graphs: Object.keys(r.value.graphSpec.graphs).length,
      }),
    );
    return;
  }

  if (cmd === 'start') {
    const r = loadService(dir);
    if (!r.ok) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ ok: false, errors: r.errors }, null, 2));
      process.exit(1);
    }
    const running = await startService(r.value);
    const shutdown = async (): Promise<void> => {
      await running.stop();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    return;
  }

  usage();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ fatal: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
});
