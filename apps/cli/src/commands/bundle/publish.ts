import { publishFolder } from '@rntme/bundle-publish';
import type { PublishError, PublishOptions, PublishTarget, S3Reference } from '@rntme/bundle-publish';

export type BundlePublishArgs = {
  readonly folder: string;
  readonly target: PublishTarget;
  readonly keyPrefix?: string | undefined;
  readonly maxBytes?: number | undefined;
  readonly ignore?: readonly string[] | undefined;
  readonly printJson: boolean;
};

type PublishFn = (
  folder: string,
  target: PublishTarget,
  opts?: PublishOptions,
) => ReturnType<typeof publishFolder>;

export type BundlePublishDeps = {
  readonly publish?: PublishFn | undefined;
  readonly stdout?: ((s: string) => void) | undefined;
  readonly stderr?: ((s: string) => void) | undefined;
};

export async function runBundlePublish(args: BundlePublishArgs, deps: BundlePublishDeps = {}): Promise<number> {
  const publish = deps.publish ?? publishFolder;
  const stdout = deps.stdout ?? ((s) => process.stdout.write(`${s}\n`));
  const stderr = deps.stderr ?? ((s) => process.stderr.write(`${s}\n`));

  const opts: PublishOptions = {};
  if (args.keyPrefix !== undefined) opts.keyPrefix = args.keyPrefix;
  if (args.maxBytes !== undefined) opts.maxBytes = args.maxBytes;
  if (args.ignore !== undefined) opts.ignore = [...args.ignore];

  const result = await publish(args.folder, args.target, opts);
  if (!result.ok) {
    for (const error of result.errors) stderr(formatPublishError(error));
    return 1;
  }

  const ref = result.value.ref;
  if (args.printJson) {
    stdout(JSON.stringify(toBundleSource(ref)));
    return 0;
  }

  stdout(`Published ${(result.value.bytes / 1024 / 1024).toFixed(2)} MB in ${(result.value.durationMs / 1000).toFixed(2)}s`);
  stdout(`  bucket: ${ref.bucket}`);
  stdout(`  key:    ${ref.key}`);
  stdout(`  sha256: ${ref.sha256}`);
  stdout('');
  stdout('Paste into project.json modules.<name>.publicConfig.source:');
  stdout(JSON.stringify(toBundleSource(ref), null, 2));
  return 0;
}

function toBundleSource(ref: S3Reference): { kind: 's3'; bucket: string; key: string; sha256: string; endpoint?: string; region?: string } {
  return {
    kind: 's3',
    bucket: ref.bucket,
    key: ref.key,
    sha256: ref.sha256,
    ...(ref.endpoint === undefined ? {} : { endpoint: ref.endpoint }),
    ...(ref.region === undefined ? {} : { region: ref.region }),
  };
}

function formatPublishError(error: PublishError): string {
  return `error: ${error.code}: ${error.message}`;
}
