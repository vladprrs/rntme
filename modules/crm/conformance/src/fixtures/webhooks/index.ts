import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export const bitrix24EventPath = resolve(here, 'bitrix24-event.json');
export const hubspotBatchPath = resolve(here, 'hubspot-batch.json');
export const amocrmUpdatePath = resolve(here, 'amocrm-update.urlencoded');
export const pipedriveV2Path = resolve(here, 'pipedrive-v2.json');

// URL forms for vendors that publish webhook samples on their docs:
export const bitrix24EventUrl = 'file://' + bitrix24EventPath;
export const hubspotBatchUrl = 'file://' + hubspotBatchPath;
export const amocrmUpdateUrl = 'file://' + amocrmUpdatePath;
export const pipedriveV2Url = 'file://' + pipedriveV2Path;
