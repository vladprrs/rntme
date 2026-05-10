import './dom-setup.js';
import { render } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, mock } from 'bun:test';

mock.module('@rntme/contracts-client-runtime-v1', () => ({
  useOperation: () => async () => ({
    fileId: 'file-1',
    presigned: { url: 'https://storage.example/upload', headers: {} },
  }),
}));

mock.module('@uppy/react', () => ({
  Dashboard: () => <div data-testid="uppy-dashboard" />,
}));

import { UploadDropzone } from '../../src/client/upload-dropzone.js';

describe('<UploadDropzone>', () => {
  it('mounts without throwing', () => {
    const { container } = render(<UploadDropzone routeId="attachments" entityId="ticket-1" />);
    expect(container.firstChild).not.toBeNull();
  });
});
