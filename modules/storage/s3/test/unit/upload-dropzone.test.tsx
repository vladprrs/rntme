import { render } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@rntme/contracts-client-runtime-v1', () => ({
  useOperation: () => async () => ({
    fileId: 'file-1',
    presigned: { url: 'https://storage.example/upload', headers: {} },
  }),
}));

vi.mock('@uppy/react', () => ({
  Dashboard: () => <div data-testid="uppy-dashboard" />,
}));

import { UploadDropzone } from '../../src/client/upload-dropzone.js';

describe('<UploadDropzone>', () => {
  it('mounts without throwing', () => {
    const { container } = render(<UploadDropzone routeId="attachments" entityId="ticket-1" />);
    expect(container.firstChild).not.toBeNull();
  });
});
