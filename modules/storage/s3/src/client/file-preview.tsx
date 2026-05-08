import { useOperation } from '@rntme/contracts-client-runtime-v1';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { STORAGE_MODULE_NAME } from './operations.js';

export interface FilePreviewProps {
  fileId: string;
  contentType?: string;
}

export function FilePreview({ fileId, contentType }: FilePreviewProps): React.ReactElement {
  const getUrl = useOperation<{ url: string; expiresAt: string }>(
    STORAGE_MODULE_NAME,
    'storage.getDownloadUrl',
  );
  const [url, setUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await getUrl({ fileId });
    setUrl(result.url);
  }, [fileId, getUrl]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refresh]);

  if (url === null) return <span aria-busy="true">loading...</span>;
  if (contentType?.startsWith('image/')) return <img src={url} alt="" />;
  if (contentType === 'application/pdf') return <embed src={url} type="application/pdf" width="100%" height="600" />;
  return <a href={url}>download</a>;
}
