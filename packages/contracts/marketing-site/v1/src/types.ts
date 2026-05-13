import type { z } from 'zod';
import type {
  BundleSourceSchema,
  MarketingSiteV1ConfigSchema,
  ProjectFolderSourceSchema,
} from './schema.js';

export type BundleSource = z.infer<typeof BundleSourceSchema>;
export type BundleSourceKind = BundleSource['kind'];
export type ProjectFolderSource = z.infer<typeof ProjectFolderSourceSchema>;
export type MarketingSiteV1Config = z.infer<typeof MarketingSiteV1ConfigSchema>;
