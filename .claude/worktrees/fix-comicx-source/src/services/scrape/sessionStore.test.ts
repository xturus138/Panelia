import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SiteConfig } from './types';

const config = { name: 'Komiku', baseUrl: 'https://komiku.org' } as SiteConfig;

let sessionStorageStore: Record<string, string> = {};

beforeEach(() => {
  sessionStorageStore = {};
  vi.stubGlobal('window', {});
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => (key in sessionStorageStore ? sessionStorageStore[key] : null),
    setItem: (key: string, value: string) => {
      sessionStorageStore[key] = value;
    },
    removeItem: (key: string) => {
      delete sessionStorageStore[key];
    },
    clear: () => {
      for (const key of Object.keys(sessionStorageStore)) delete sessionStorageStore[key];
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('scrape session store', () => {
  it('restores from sessionStorage after module reload (same-browser navigation)', async () => {
    // Phase 1: browse page sets the session
    vi.resetModules();
    const { setScrapeSession } = await import('./sessionStore');
    setScrapeSession(
      'preset-komiku',
      config,
      'https://komiku.org',
      { 'scrape:preset-komiku:ch:abc123': 'https://komiku.org/chapter-1' },
      'manga-1',
      'Solo Leveling',
      'https://example.com/cover.jpg',
      'https://komiku.org/manga/solo-leveling',
      [{ id: 'scrape:preset-komiku:ch:abc123', title: 'Chapter 1', chapterNumber: 1 }]
    );

    // Phase 2: reader page loads fresh — in-memory Map empty, sessionStorage persists
    vi.resetModules();
    const { getScrapeSession, clearScrapeSession } = await import('./sessionStore');

    expect(getScrapeSession('preset-komiku')?.mangaTitle).toBe('Solo Leveling');
    expect(getScrapeSession('preset-komiku')?.chapterUrls).toEqual({
      'scrape:preset-komiku:ch:abc123': 'https://komiku.org/chapter-1',
    });

    // Verify full cleanup removes from both cache and storage
    clearScrapeSession('preset-komiku');
    vi.resetModules();
    const { getScrapeSession: getAfterClear } = await import('./sessionStore');
    expect(getAfterClear('preset-komiku')).toBeUndefined();
  });
});
