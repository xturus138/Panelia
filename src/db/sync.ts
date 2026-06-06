import { doc, getDoc, collection, getDocs, query, where, writeBatch, updateDoc } from '~/infrastructure/db/db-gateway';
import { db } from '~/lib/firebase';
import type { Chapter } from '~/domain/types';
import { sourceGateway } from '~/infrastructure/sources';
import { ScrapeAdapter } from '~/services/scrape/scrapeAdapter';
import { getMangaById } from '~/infrastructure/db/manga';
import { userScopedCollection, userScopedDoc } from '~/infrastructure/db/user-scope';

export async function syncChapters(uid: string, mangaId: string): Promise<number> {
  const manga = await getMangaById(uid, mangaId);
  if (!manga) {
    throw new Error(`Manga not found: ${mangaId}`);
  }

  const [sourcePrefix, rawMangaId] = manga.id.split(':');
  if (!sourcePrefix || !rawMangaId) throw new Error(`Invalid manga id: ${mangaId}`);

  const provider = sourceGateway.getProvider(sourcePrefix);
  if (!provider) throw new Error(`Provider not found for source: ${sourcePrefix}`);

  let chapters: Chapter[] = [];

  if (provider instanceof ScrapeAdapter) {
    const mangaUrl = manga.url || provider.sourceUrl;
    const response = await fetch(`/api/proxy?url=${encodeURIComponent(mangaUrl)}`);
    if (!response.ok) throw new Error(`Failed to fetch manga page: ${response.status}`);
    const html = await response.text();

    const parsed = provider.parseMangaPage(html);
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

  const chaptersCol = userScopedCollection(uid, 'chapters');
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
  await updateDoc(userScopedDoc(uid, 'libraryEntries', mangaId), { unreadCount });

  return mergedChapters.length;
}
