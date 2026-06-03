import type { SourceProvider } from '~/types';
import { mangadexProvider } from './mangadex';
import { comickProvider } from './comick';
import { ScrapeAdapter } from '~/services/scrape/scrapeAdapter';
import type { SiteConfig } from '~/services/scrape/types';

export interface SourceProviderEntry {
  id: string;
  name: string;
  provider: SourceProvider;
  iconUrl?: string;
  isScrape?: boolean;
}

const STATIC_PROVIDERS: SourceProviderEntry[] = [
  { id: 'mangadex', name: 'MangaDex', provider: mangadexProvider },
  { id: 'comick', name: 'Comick', provider: comickProvider },
];

const SCRAPE_PREFIX = 'scrape:';

class SourceRegistry {
  private providers: Map<string, SourceProvider> = new Map();
  private scrapeAdapters: Map<string, ScrapeAdapter> = new Map();

  constructor() {
    for (const entry of STATIC_PROVIDERS) {
      this.providers.set(entry.id, entry.provider);
    }
  }

  registerScrapeSource(id: string, config: SiteConfig, sourceUrl: string): void {
    const adapter = new ScrapeAdapter(id, config, sourceUrl);
    this.scrapeAdapters.set(id, adapter);
    this.providers.set(SCRAPE_PREFIX + id, adapter);
  }

  unregisterScrapeSource(id: string): void {
    this.scrapeAdapters.delete(id);
    this.providers.delete(SCRAPE_PREFIX + id);
  }

  register(id: string, provider: SourceProvider): void {
    this.providers.set(id, provider);
  }

  get(id: string): SourceProvider | null {
    return this.providers.get(id) ?? null;
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  getAllProviders(): SourceProviderEntry[] {
    const providers = [...STATIC_PROVIDERS];
    for (const [id, adapter] of this.scrapeAdapters.entries()) {
      providers.push({
        id: SCRAPE_PREFIX + id,
        name: adapter.id,
        provider: adapter,
        isScrape: true,
      });
    }
    return providers;
  }

  getProviderIds(): string[] {
    return Array.from(this.providers.keys());
  }
}

export const sourceRegistry = new SourceRegistry();
export { mangadexProvider, comickProvider };
