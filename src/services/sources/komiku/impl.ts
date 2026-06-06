import { ScrapeAdapter } from '~/services/scrape/scrapeAdapter';
import { getPreset } from '~/services/scrape/presets';

const preset = getPreset('komiku');

if (!preset) {
  throw new Error('Komiku preset missing');
}

export class KomikuProvider extends ScrapeAdapter {
  constructor() {
    super('komiku', preset!.config, preset!.baseUrl);
  }
}

export const komikuProvider = new KomikuProvider();
export const komikuModule = {
  id: 'komiku',
  name: 'Komiku',
  provider: komikuProvider,
};
