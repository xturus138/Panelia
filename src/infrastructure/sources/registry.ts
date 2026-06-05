import type { SourceProvider } from '~/domain/interfaces';
import { mangadexProvider } from '~/services/sources/mangadex';
import { comickProvider } from '~/services/sources/comick';
import { ScrapeAdapter } from '~/services/scrape/scrapeAdapter';
import type { SiteConfig } from '~/services/scrape/types';
import { getPreset, presetToScrapeSource } from '~/services/scrape/presets';

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

  /**
   * Get a scrape adapter, auto-rehydrating from presets if not yet registered.
   * For DB-saved sources, call rehydrateFromDb() or ensureScrapeSource() instead.
   */
  getOrRehydrate(id: string): SourceProvider | null {
    const existing = this.providers.get(id);
    if (existing) return existing;

    // Try to rehydrate from preset (e.g. "scrape:preset-komiku" → preset "komiku")
    if (id.startsWith(SCRAPE_PREFIX)) {
      const sourceId = id.slice(SCRAPE_PREFIX.length);
      if (sourceId.startsWith('preset-')) {
        const presetName = sourceId.slice('preset-'.length);
        const preset = getPreset(presetName);
        if (preset) {
          const scrapeSource = presetToScrapeSource(preset);
          this.registerScrapeSource(scrapeSource.id, scrapeSource.config, scrapeSource.baseUrl);
          return this.providers.get(id) ?? null;
        }
      }
    }

    return null;
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
