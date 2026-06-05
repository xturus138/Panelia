import { describe, expect, it } from 'vitest';
import { sourceRegistry as legacyRegistry } from '~/services/sources';
import { sourceRegistry as infraRegistry } from '~/infrastructure/sources';

describe('source registry compatibility', () => {
  it('exposes the same registry instance from legacy and infrastructure entrypoints', () => {
    expect(legacyRegistry).toBe(infraRegistry);
  });

  it('keeps built-in provider ids registered', () => {
    expect(infraRegistry.get('mangadex')).toBeTruthy();
    expect(infraRegistry.get('comick')).toBeTruthy();
  });
});
