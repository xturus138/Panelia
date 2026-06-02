import type { SourceProvider } from '~/types';
import { mockSource } from './mock-source';

class SourceRegistry {
  private providers: Map<string, SourceProvider> = new Map();

  register(id: string, provider: SourceProvider): void {
    this.providers.set(id, provider);
  }

  get(id: string): SourceProvider {
    return this.providers.get(id) || mockSource;
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }
}

export const sourceRegistry = new SourceRegistry();
