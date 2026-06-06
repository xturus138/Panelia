import { sourceRegistry } from './registry';
import type { SourceProvider } from '~/domain/interfaces';

export interface SourceGatewayEntry {
  id: string;
  name: string;
  provider: SourceProvider;
}

export const sourceGateway = {
  list(): SourceGatewayEntry[] {
    return sourceRegistry.getAllProviders();
  },

  getProvider(id: string): SourceProvider | null {
    return sourceRegistry.get(id);
  },

  registerModule(module: { id: string; name: string; provider: SourceProvider }): void {
    sourceRegistry.register(module.id, module.provider);
  },
};
