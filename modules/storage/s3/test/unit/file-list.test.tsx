import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@rntme/contracts-client-runtime-v1', () => ({
  useOperation: (moduleName: string, name: string) => {
    if (name === 'storage.list') {
      return async () => ({ files: [{ fileId: 'file-1', contentType: 'image/png', sizeBytes: 1 }] });
    }
    if (name === 'storage.getDownloadUrl') {
      return async () => ({ url: 'https://storage.example/file-1', expiresAt: '2099-01-01T00:00:00.000Z' });
    }
    return async () => undefined;
  },
}));

import { FileList } from '../../src/client/file-list.js';

describe('<FileList>', () => {
  it('renders one item from the operation', async () => {
    render(<FileList routeId="attachments" entityId="ticket-1" />);
    expect(await screen.findByRole('button', { name: 'delete' })).not.toBeNull();
  });
});
