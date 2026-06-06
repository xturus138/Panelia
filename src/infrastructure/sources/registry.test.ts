import { describe, expect, it } from 'vitest';
import { sourceRegistry as legacyRegistry } from '~/services/sources';
import { sourceRegistry as infraRegistry, sourceGateway } from '~/infrastructure/sources';

describe('source registry compatibility', () => {
  it('exposes the same registry instance from legacy and infrastructure entrypoints', () => {
    expect(legacyRegistry).toBe(infraRegistry);
  });

  it('keeps built-in provider ids registered', () => {
    expect(infraRegistry.get('mangadex')).toBeTruthy();
    expect(infraRegistry.get('comick')).toBeTruthy();
  });

  it('normalizes provider metadata through gateway', () => {
    const providers = sourceGateway.list();
    expect(providers.find((provider) => provider.id === 'mangadex')?.name).toBe('MangaDex');
    expect(providers.find((provider) => provider.id === 'comick')?.name).toBe('Comick');
  });
});
