import type { SourceProvider } from '~/domain/interfaces';
// import { mangadexProvider } from '~/services/sources/mangadex'; // TODO: available in future update
// import { comickProvider } from '~/services/sources/comick/impl'; // TODO: available in future update
import { comixProvider } from '~/services/sources/comix';
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
  // { id: 'mangadex', name: 'MangaDex', provider: mangadexProvider }, // TODO: available in future update
  // { id: 'comick', name: 'Comick', provider: comickProvider },
  { id: 'comix', name: 'Comix', provider: comixProvider },
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
    // Normalize id: strip 'scrape:' prefix if present, to avoid double-prefixing
    const normalizedId = id.startsWith(SCRAPE_PREFIX) ? id.slice(SCRAPE_PREFIX.length) : id;
    const adapter = new ScrapeAdapter(normalizedId, config, sourceUrl);
    this.scrapeAdapters.set(normalizedId, adapter);
    this.providers.set(SCRAPE_PREFIX + normalizedId, adapter);
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
        name: adapter.config.name || adapter.name, // Use config name if available (e.g. "Komiku")
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
export { comixProvider };
// export { mangadexProvider, comickProvider, comixProvider };
