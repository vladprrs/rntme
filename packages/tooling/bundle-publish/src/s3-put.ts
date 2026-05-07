import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';

export type S3Like = Pick<S3Client, 'send'>;

export async function putBundle(client: S3Like, bucket: string, key: string, body: Buffer): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentLength: body.length,
      ContentType: 'application/gzip',
    }) as never,
  );
}
