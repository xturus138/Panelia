import { doc, getDoc, collection, getDocs, query, where, writeBatch, updateDoc } from 'firebase/firestore';
import { db } from '~/lib/firebase';
import type { Chapter } from '~/domain/types';
import { ScrapeAdapter } from '~/services/scrape/scrapeAdapter';
import type { SiteConfig, ScrapeSource } from '~/services/scrape/types';
import { sourceRegistry } from '~/infrastructure/sources';
import { getMangaById } from '~/infrastructure/db/manga';
import { getScrapeSourceById } from '~/infrastructure/db/scrape-sources';

const chaptersCol = collection(db, 'chapters');
const libraryEntriesCol = collection(db, 'libraryEntries');

export async function syncChapters(mangaId: string): Promise<number> {
  const manga = await getMangaById(mangaId);
  if (!manga) {
    throw new Error(`Manga not found: ${mangaId}`);
  }

  let chapters: Chapter[] = [];

  if (manga.id.startsWith('scrape:')) {
    const parts = manga.id.split(':');
    if (parts.length < 3) throw new Error(`Invalid scrape manga id: ${mangaId}`);
    const sourceKey = parts[1];
    const mangaHash = parts.slice(2).join(':');

    const scrapeSource = await getScrapeSourceById(sourceKey);
    if (!scrapeSource) throw new Error(`Scrape source not found: ${sourceKey}`);

    const config: SiteConfig = scrapeSource.config;
    const adapter = new ScrapeAdapter(sourceKey, config, scrapeSource.baseUrl);

    const mangaUrl = manga.url || scrapeSource.baseUrl;
    const response = await fetch(`/api/proxy?url=${encodeURIComponent(mangaUrl)}`);
    if (!response.ok) throw new Error(`Failed to fetch manga page: ${response.status}`);
    const html = await response.text();

    const parsed = adapter.parseMangaPage(html);
    chapters = parsed.chapters.map((ch) => ({
      id: ch.id,
      mangaId: manga.id,
      chapterNumber: ch.chapterNumber,
      title: ch.title,
      scanlator: ch.scanlator,
      releaseDate: ch.releaseDate,
      pageCount: ch.pageCount,
      read: ch.read,
      lastReadPage: ch.lastReadPage,
      url: ch.url,
      status: ch.status || 'unread',
      viewedAt: ch.viewedAt,
      completedAt: ch.completedAt,
    }));
  } else {
    const [sourcePrefix, rawMangaId] = manga.id.split(':');
    if (!sourcePrefix || !rawMangaId) throw new Error(`Invalid manga id: ${mangaId}`);

    const provider = sourceRegistry.get(sourcePrefix);
    if (!provider) throw new Error(`Provider not found for source: ${sourcePrefix}`);

    const apiChapters = await provider.getChapters(rawMangaId);
    chapters = apiChapters.map((ch) => ({
      id: ch.id,
      mangaId: manga.id,
      chapterNumber: ch.chapterNumber,
      title: ch.title,
      scanlator: ch.scanlator,
      releaseDate: ch.releaseDate,
      pageCount: ch.pageCount,
      read: ch.read,
      lastReadPage: ch.lastReadPage,
      url: ch.url,
      status: ch.status || 'unread',
      viewedAt: ch.viewedAt,
      completedAt: ch.completedAt,
    }));
  }

  const existingSnap = await getDocs(query(chaptersCol, where('mangaId', '==', mangaId)));
  const existingMap = new Map(existingSnap.docs.map((d) => [d.id, d.data() as Chapter]));

  const mergedChapters = chapters.map((ch) => {
    const existing = existingMap.get(ch.id);
    return {
      ...ch,
      status: existing?.status || 'unread',
      read: existing?.read || false,
      lastReadPage: existing?.lastReadPage || 0,
      viewedAt: existing?.viewedAt,
      completedAt: existing?.completedAt,
    };
  });

  const latestChapterIds = new Set(mergedChapters.map((c) => c.id));
  const staleChapterIds = Array.from(existingMap.keys()).filter((id) => !latestChapterIds.has(id));

  const batch = writeBatch(db);
  staleChapterIds.forEach((id) => {
    batch.delete(doc(chaptersCol, id));
  });
  mergedChapters.forEach((ch) => {
    batch.set(doc(chaptersCol, ch.id), ch, { merge: true });
  });

  await batch.commit();

  const unreadCount = mergedChapters.filter((c) => c.status !== 'completed').length;
  await updateDoc(doc(libraryEntriesCol, mangaId), { unreadCount });

  return mergedChapters.length;
}
