import { doc, getDoc, setDoc, collection, deleteDoc } from '~/infrastructure/db/db-gateway';
import { db } from '~/lib/firebase';
import type { Chapter, Page } from '~/types';
import { getScrapeSession } from '~/services/scrape/sessionStore';
import { ScrapeAdapter } from '~/services/scrape/scrapeAdapter';
import { sourceGateway } from '~/infrastructure/sources';
import { blobStore } from './blob-store';
import { userScopedCollection, userScopedDoc } from '~/infrastructure/db/user-scope';

export const downloadManager = {
  async downloadChapter(uid: string, chapterId: string, progressCallback?: (progress: number) => void): Promise<void> {
    const chapterSnap = await getDoc(userScopedDoc(uid, 'chapters', chapterId));
    if (!chapterSnap.exists()) throw new Error('Chapter not found in database');
    const chapter = chapterSnap.data() as Chapter;

    const mangaSnap = await getDoc(userScopedDoc(uid, 'manga', chapter.mangaId));
    if (!mangaSnap.exists()) throw new Error('Manga not found in database');

    const parts = chapterId.split(':');
    const sourceId = parts[0];
    if (!sourceId) {
      throw new Error('Invalid chapter id');
    }

    const provider = sourceGateway.getProvider(sourceId);
    if (!provider || !(provider instanceof ScrapeAdapter)) {
      throw new Error('Only scraped content is supported for download currently');
    }

    let url = chapter.url;
    const session = getScrapeSession(sourceId);
    if (session) {
      url = url || session.chapterUrls[chapterId];
    }

    if (!url) {
      throw new Error('Chapter URL not found');
    }

    const response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
    if (!response.ok) throw new Error(`Failed to fetch chapter pages: ${response.status}`);
    const html = await response.text();
    const scrapedPages = provider.parseChapterPage(html);

    const sourceUrl = new URL(url);
    const refererUrl = `${sourceUrl.protocol}//${sourceUrl.host}/`;
    let sizeBytes = 0;

    for (let i = 0; i < scrapedPages.length; i++) {
      const page = scrapedPages[i];
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(page.imageUrl)}&referer=${encodeURIComponent(refererUrl)}`;
      const imgRes = await fetch(proxyUrl);
      if (!imgRes.ok) throw new Error(`Failed to download page ${i + 1}`);

      const blob = await imgRes.blob();
      sizeBytes += blob.size;
      await blobStore.savePage(chapterId, page.index, blob);

      progressCallback?.(Math.round(((i + 1) / scrapedPages.length) * 100));
    }

    await setDoc(doc(userScopedCollection(uid, 'downloadedChapters'), chapterId), {
      id: chapterId,
      chapterId,
      mangaId: chapter.mangaId,
      pageCount: scrapedPages.length,
      downloadedAt: new Date().toISOString(),
      sizeBytes,
    }, { merge: true });
  },

  async isChapterDownloaded(uid: string, chapterId: string): Promise<boolean> {
    const snap = await getDoc(userScopedDoc(uid, 'downloadedChapters', chapterId));
    return snap.exists();
  },

  async getDownloadedPages(uid: string, chapterId: string): Promise<Page[] | null> {
    const snap = await getDoc(userScopedDoc(uid, 'downloadedChapters', chapterId));
    if (!snap.exists()) return null;
    const dc = snap.data() as any;
    const pageCount = dc.pageCount ?? 0;
    const pages: Page[] = [];
    for (let i = 0; i < pageCount; i++) {
      const blob = await blobStore.getPage(chapterId, i);
      if (blob) {
        pages.push({ index: i, imageUrl: URL.createObjectURL(blob) });
      }
    }
    return pages.length > 0 ? pages : null;
  },

  async deleteDownload(uid: string, chapterId: string): Promise<void> {
    await Promise.all([
      deleteDoc(userScopedDoc(uid, 'downloadedChapters', chapterId)),
      blobStore.deleteChapter(chapterId),
    ]);
  },
};
