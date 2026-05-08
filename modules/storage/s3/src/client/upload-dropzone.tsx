import AwsS3 from '@uppy/aws-s3';
import Uppy from '@uppy/core';
import { Dashboard } from '@uppy/react';
import { useOperation } from '@rntme/contracts-client-runtime-v1';
import * as React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';
import { STORAGE_MODULE_NAME, type PrepareUploadResult } from './operations.js';

export interface UploadDropzoneProps {
  routeId: string;
  entityId: string;
  onUploaded?: (fileId: string) => void;
  height?: number;
}

export function UploadDropzone({
  routeId,
  entityId,
  onUploaded,
  height = 320,
}: UploadDropzoneProps): React.ReactElement {
  const prepare = useOperation<PrepareUploadResult>(STORAGE_MODULE_NAME, 'storage.upload.prepare');
  const commit = useOperation<void>(STORAGE_MODULE_NAME, 'storage.upload.commit');
  const fileIdMap = useRef<Map<string, string>>(new Map());

  const uppy = useMemo(() => {
    const instance = new Uppy({ autoProceed: true });
    instance.use(AwsS3, {
      shouldUseMultipart: false,
      async getUploadParameters(file) {
        const result = await prepare({
          routeId,
          entityId,
          filename: file.name ?? 'unnamed',
          contentType: file.type ?? 'application/octet-stream',
          declaredSize: file.size ?? 0,
        });
        fileIdMap.current.set(file.id, result.fileId);
        return {
          method: 'PUT',
          url: result.presigned.url,
          headers: result.presigned.headers,
          fields: {},
        };
      },
    });
    instance.on('upload-success', async (file) => {
      const fileId = file !== undefined ? fileIdMap.current.get(file.id) : undefined;
      if (fileId !== undefined) {
        await commit({ fileId });
        onUploaded?.(fileId);
      }
    });
    return instance;
  }, [commit, entityId, onUploaded, prepare, routeId]);

  useEffect(() => () => uppy.destroy(), [uppy]);

  return <Dashboard uppy={uppy} height={height} hideUploadButton={false} />;
}
