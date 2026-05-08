import type { ModuleBootContext } from '@rntme/contracts-client-runtime-v1';

export { FileList } from './file-list.js';
export { FilePreview } from './file-preview.js';
export { UploadDropzone } from './upload-dropzone.js';
export {
  STORAGE_MODULE_NAME,
  registerStorageOperations,
  type ListedFile,
  type PrepareUploadResult,
  type UploadParams,
} from './operations.js';

export async function boot(ctx: ModuleBootContext): Promise<void> {
  const { registerStorageOperations } = await import('./operations.js');
  registerStorageOperations(ctx);
}
