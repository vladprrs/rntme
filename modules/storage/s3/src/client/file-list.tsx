import { useOperation } from '@rntme/contracts-client-runtime-v1';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { FilePreview } from './file-preview.js';
import { STORAGE_MODULE_NAME, type ListedFile } from './operations.js';

export interface FileListProps {
  routeId: string;
  entityId: string;
}

export function FileList({ routeId, entityId }: FileListProps): React.ReactElement {
  const list = useOperation<{ files: ListedFile[] }>(STORAGE_MODULE_NAME, 'storage.list');
  const remove = useOperation<void>(STORAGE_MODULE_NAME, 'storage.delete');
  const [items, setItems] = useState<ListedFile[] | null>(null);

  useEffect(() => {
    void list({ routeId, entityId }).then((result) => setItems(result.files));
  }, [entityId, list, routeId]);

  if (items === null) return <span aria-busy="true">loading...</span>;
  if (items.length === 0) return <p className="storage-empty">no files yet</p>;

  return (
    <ul className="storage-file-list">
      {items.map((file) => (
        <li key={file.fileId}>
          <FilePreview fileId={file.fileId} contentType={file.contentType} />
          <button
            type="button"
            onClick={async () => {
              await remove({ fileId: file.fileId });
              setItems((current) => (current ?? []).filter((candidate) => candidate.fileId !== file.fileId));
            }}
          >
            delete
          </button>
        </li>
      ))}
    </ul>
  );
}
