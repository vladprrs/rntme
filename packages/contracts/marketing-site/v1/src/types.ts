import type { z } from 'zod';
import type { BundleSourceSchema, MarketingSiteV1ConfigSchema } from './schema.js';

export type BundleSource = z.infer<typeof BundleSourceSchema>;
export type BundleSourceKind = BundleSource['kind'];
export type MarketingSiteV1Config = z.infer<typeof MarketingSiteV1ConfigSchema>;
