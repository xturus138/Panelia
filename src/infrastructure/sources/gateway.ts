import { sourceRegistry } from './registry';
import type { SourceProvider } from '~/domain/interfaces';
import type { SiteConfig } from '~/services/scrape/types';

export interface SourceGatewayEntry {
  id: string;
  name: string;
  provider: SourceProvider;
  iconUrl?: string;
  isScrape?: boolean;
}

export const sourceGateway = {
  list(): SourceGatewayEntry[] {
    return sourceRegistry.getAllProviders();
  },

  getProvider(id: string): SourceProvider | null {
    return sourceRegistry.get(id);
  },

  getOrRehydrate(id: string): SourceProvider | null {
    return sourceRegistry.getOrRehydrate(id);
  },

  registerModule(module: { id: string; name: string; provider: SourceProvider }): void {
    sourceRegistry.register(module.id, module.provider);
  },

  registerScrapeSource(id: string, config: SiteConfig, sourceUrl: string): void {
    sourceRegistry.registerScrapeSource(id, config, sourceUrl);
  },

  unregisterScrapeSource(id: string): void {
    sourceRegistry.unregisterScrapeSource(id);
  },
};
