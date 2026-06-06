import type { SourceProvider } from '~/domain/interfaces';
import { mangadexModule } from '~/services/sources/mangadex/module';
import { comickModule } from '~/services/sources/comick/module';
import { komikuModule } from '~/services/sources/komiku/module';

export interface SourceProviderEntry {
  id: string;
  name: string;
  provider: SourceProvider;
  iconUrl?: string;
  isScrape?: boolean;
}

const STATIC_PROVIDER_MODULES = [mangadexModule, comickModule, komikuModule];

const STATIC_PROVIDERS: SourceProviderEntry[] = STATIC_PROVIDER_MODULES.map((mod) => ({
  id: mod.id,
  name: mod.name,
  provider: mod.provider,
}));

class SourceRegistry {
  private providers: Map<string, SourceProvider> = new Map();

  constructor() {
    for (const entry of STATIC_PROVIDERS) {
      this.providers.set(entry.id, entry.provider);
    }
  }

  register(id: string, provider: SourceProvider): void {
    this.providers.set(id, provider);
  }

  unregister(id: string): void {
    this.providers.delete(id);
  }

  get(id: string): SourceProvider | null {
    return this.providers.get(id) ?? null;
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  getAllProviders(): SourceProviderEntry[] {
    return [...STATIC_PROVIDERS];
  }

  getProviderIds(): string[] {
    return Array.from(this.providers.keys());
  }
}

export const sourceRegistry = new SourceRegistry();
export const mangadexProvider = mangadexModule.provider;
export const comickProvider = comickModule.provider;
export const komikuProvider = komikuModule.provider;
