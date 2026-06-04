import { db } from './db';
import type { Manga, Chapter, LibraryEntry } from '~/types';
import { ScrapeAdapter } from '~/services/scrape/scrapeAdapter';
import type { SiteConfig } from '~/services/scrape/types';
import { sourceRegistry } from '~/services/sources';

/**
 * Sync chapters for a given manga from its source.
 * Fetches the latest chapter list from the source and upserts into db.chapters.
 * Updates the library entry's unreadCount to the total number of chapters.
 *
 * @param mangaId The composite manga id (e.g., "mangadex:abc123" or "scrape:preset-komiku:hash")
 * @returns The number of chapters after sync
 */
export async function syncChapters(mangaId: string): Promise<number> {
  // 1. Load manga
  const manga = await db.manga.get(mangaId);
  if (!manga) {
    throw new Error(`Manga not found: ${mangaId}`);
  }

  let chapters: Chapter[] = [];

  // 2. Determine source type and fetch chapters
  if (manga.id.startsWith('scrape:')) {
    // Scrape source: id format is "scrape:{sourceId}:{mangaHash}"
    const parts = manga.id.split(':');
    if (parts.length < 3) {
      throw new Error(`Invalid scrape manga id: ${mangaId}`);
    }
    const sourceKey = parts[1]; // e.g., "preset-komiku"
    const mangaHash = parts.slice(2).join(':'); // the rest

    // Get scrape source config from db
    const scrapeSource = await db.scrapeSources.get(sourceKey);
    if (!scrapeSource) {
      throw new Error(`Scrape source not found: ${sourceKey}`);
    }

    const config: SiteConfig = scrapeSource.config;
    const adapter = new ScrapeAdapter(sourceKey, config, scrapeSource.baseUrl);

    // Fetch manga page
    const mangaUrl = manga.url || scrapeSource.baseUrl;
    const response = await fetch(`/api/proxy?url=${encodeURIComponent(mangaUrl)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch manga page: ${response.status}`);
    }
    const html = await response.text();

    const parsed = adapter.parseMangaPage(html);
    chapters = parsed.chapters.map((ch) => ({
      id: ch.id,
      mangaId: manga.id, // use composite id as foreign key
      chapterNumber: ch.chapterNumber,
      title: ch.title,
      scanlator: ch.scanlator,
      releaseDate: ch.releaseDate,
      pageCount: ch.pageCount,
      read: ch.read,
      lastReadPage: ch.lastReadPage,
      url: ch.url,
    }));
  } else {
    // API source: mangadex or comick
    const [sourcePrefix, rawMangaId] = manga.id.split(':');
    if (!sourcePrefix || !rawMangaId) {
      throw new Error(`Invalid manga id: ${mangaId}`);
    }

    const provider = sourceRegistry.get(sourcePrefix);
    if (!provider) {
      throw new Error(`Provider not found for source: ${sourcePrefix}`);
    }

    const apiChapters = await provider.getChapters(rawMangaId);
    chapters = apiChapters.map((ch) => ({
      id: ch.id,
      mangaId: manga.id, // composite id
      chapterNumber: ch.chapterNumber,
      title: ch.title,
      scanlator: ch.scanlator,
      releaseDate: ch.releaseDate,
      pageCount: ch.pageCount,
      read: ch.read,
      lastReadPage: ch.lastReadPage,
      url: ch.url,
    }));
  }

  // 3. Upsert chapters (Dexie bulkPut inserts or updates by primary key)
  await db.chapters.bulkPut(chapters);

  // 4. Update library entry's unreadCount to total chapter count
  await db.libraryEntries.update(mangaId, { unreadCount: chapters.length });

  return chapters.length;
}