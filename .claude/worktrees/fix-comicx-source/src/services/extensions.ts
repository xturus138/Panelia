import { Source } from '../types';

const KEIYOSHI_INDEX_URL = 'https://raw.githubusercontent.com/yuzono/manga-repo/repo/index.min.json';
const CACHE_KEY = 'keiyoushi-index';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface KeiyoushiSource {
  id: string;
  name: string;
  baseUrl: string;
  lang: string;
}

interface KeiyoushiExtension {
  name: string;
  pkg: string;
  apk: string;
  lang: string;
  code: number;
  version: string;
  nsfw: number;
  sources: KeiyoushiSource[];
}

export class ExtensionService {
  private cache: KeiyoushiExtension[] | null = null;

  async fetchIndex(): Promise<KeiyoushiExtension[]> {
    const cached = this.getCachedIndex();
    if (cached) {
      return cached;
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(KEIYOSHI_INDEX_URL, {
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: KeiyoushiExtension[] = await response.json();
        this.setCachedIndex(data);
        return data;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < 2) {
          // Exponential backoff: 1s, 2s
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('Failed to fetch Keiyoushi index after retries');
  }

  private getCachedIndex(): KeiyoushiExtension[] | null {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const { timestamp, data } = JSON.parse(cached);
      if (Date.now() - timestamp > CACHE_DURATION) {
        return null;
      }

      return data;
    } catch {
      return null;
    }
  }

  private setCachedIndex(data: KeiyoushiExtension[]): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data,
      }));
    } catch {
      // Ignore storage errors
    }
  }

  clearCache(): void {
    localStorage.removeItem(CACHE_KEY);
  }

  async getSources(): Promise<Source[]> {
    const extensions = await this.fetchIndex();
    const sources: Source[] = [];

    for (const ext of extensions) {
      for (const src of ext.sources) {
        sources.push({
          id: src.id,
          name: src.name,
          baseUrl: src.baseUrl,
          iconUrl: '',
          isInstalled: false,
          isNsfw: ext.nsfw === 1,
          version: ext.code,
          languages: [src.lang],
        });
      }
    }

    return sources;
  }

  async getSourceById(id: string): Promise<Source | null> {
    const sources = await this.getSources();
    return sources.find(s => s.id === id) || null;
  }
}

export const extensionService = new ExtensionService();