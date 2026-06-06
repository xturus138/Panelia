import { describe, expect, it } from 'vitest';
import { sourceGateway } from '~/infrastructure/sources/gateway';

describe('source gateway boundary', () => {
  it('gateway exposes all provider ids', () => {
    const ids = sourceGateway.list().map((s) => s.id);
    expect(ids).toContain('mangadex');
    expect(ids).toContain('comick');
  });

  it('provider resolution goes through gateway', () => {
    const mangadex = sourceGateway.getProvider('mangadex');
    const comick = sourceGateway.getProvider('comick');
    expect(mangadex).not.toBeNull();
    expect(comick).not.toBeNull();
    expect(mangadex?.id).toBe('mangadex');
    expect(comick?.id).toBe('comick');
  });

  it('new modules can be registered through gateway', () => {
    sourceGateway.registerModule({
      id: 'test-leak-boundary',
      name: 'Test Leak Boundary',
      provider: {
        id: 'test-leak-boundary',
        name: 'Test Leak Boundary',
        getPopular: async () => [],
        getLatest: async () => [],
        search: async () => [],
        getMangaDetails: async () => ({ id: 'x', sourceId: 'x', title: '', coverUrl: '', author: '', artist: '', status: 'unknown', description: '', genres: [], tags: [] }),
        getChapters: async () => [],
        getPages: async () => [],
      },
    });
    expect(sourceGateway.getProvider('test-leak-boundary')).not.toBeNull();
  });
});
