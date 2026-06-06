import { describe, expect, it } from 'vitest';
import { sourceGateway } from '~/infrastructure/sources/gateway';

describe('source gateway', () => {
  it('lists normalized source modules', () => {
    const ids = sourceGateway.list().map((source) => source.id);
    expect(ids).toContain('mangadex');
    expect(ids).toContain('comick');
  });

  it('resolves providers by id', () => {
    expect(sourceGateway.getProvider('mangadex')).toBeTruthy();
    expect(sourceGateway.getProvider('comick')).toBeTruthy();
  });
});
