// src/services/scrape/presets.ts
// Built-in site presets with verified scrape configs.
// Each preset includes search, manga page, and chapter page configs.

import type { SiteConfig, ScrapeSource } from './types';

export interface Preset {
  name: string;
  baseUrl: string;
  config: SiteConfig;
}

const presets: Record<string, Preset> = {
  komiku: {
    name: 'Komiku',
    baseUrl: 'https://komiku.org',
    config: {
      name: 'Komiku',
      baseUrl: 'https://komiku.org',
      searchPage: {
        // Komiku loads results from api.komiku.org via HTMX (lazy-load)
        urlTemplate: 'https://api.komiku.org/?post_type=manga&s={query}&page={page}',
        resultItem: 'div.bge',
        resultTitle: 'div.kan h3',
        resultUrl: 'div.kan a',
        resultCover: 'div.bgei img',
      },
      // Komiku uses HTMX to load from api.komiku.org/manga/
      // Page 1 uses no /page/ segment, pages 2+ use /page/{page}/
      // This is handled specially in ScrapeAdapter.buildPageUrl()
      popularPage: {
        urlTemplate: 'https://api.komiku.org/manga/{page}?tipe=manhwa',
        resultItem: 'div.bge',
        resultTitle: 'div.kan h3',
        resultUrl: 'div.kan a',
        resultCover: 'div.bgei img',
      },
      mangaPage: {
        title: 'h1',
        cover: '.ims img',
        chapterList: "table#Daftar_Chapter tbody tr[itemprop='itemListElement'] a",
        chapterTitle: '',
        chapterUrl: '',
      },
      chapterPage: {
        images: '#Baca_Komik img',
      },
    },
  },
};

export function getBuiltinPresets(): Preset[] {
  return Object.values(presets);
}

export function getPreset(id: string): Preset | undefined {
  return presets[id];
}

export function presetToScrapeSource(preset: Preset): ScrapeSource {
  return {
    id: `preset-${preset.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    name: preset.name,
    baseUrl: preset.baseUrl,
    config: preset.config,
    createdAt: new Date().toISOString(),
  };
}
