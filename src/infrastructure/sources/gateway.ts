import { sourceRegistry, type SourceProviderEntry } from './registry';
import type { SourceProvider } from '~/domain/interfaces';

class SourceGateway {
  list(): SourceProviderEntry[] {
    return sourceRegistry.getAllProviders();
  }

  getProvider(id: string): SourceProvider | null {
    return sourceRegistry.getOrRehydrate(id);
  }

  registerModule(id: string, provider: SourceProvider): void {
    sourceRegistry.register(id, provider);
  }
}

export const sourceGateway = new SourceGateway();
