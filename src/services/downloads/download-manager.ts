import { doc, getDoc, setDoc, collection, deleteDoc } from 'firebase/firestore';
import { db } from '~/lib/firebase';
import type { Chapter, Page } from '~/types';
import { getScrapeSession } from '~/services/scrape/sessionStore';
import { ScrapeAdapter } from '~/services/scrape/scrapeAdapter';
import { sourceRegistry } from '~/infrastructure/sources';

const chaptersCol = collection(db, 'chapters');
const mangaCol = collection(db, 'manga');
const scrapeSourcesCol = collection(db, 'scrapeSources');
const downloadedChaptersCol = collection(db, 'downloadedChapters');

export const downloadManager = {
  async downloadChapter(chapterId: string, progressCallback?: (progress: number) => void): Promise<void> {
    const chapterSnap = await getDoc(doc(chaptersCol, chapterId));
    if (!chapterSnap.exists()) throw new Error('Chapter not found in database');
    const chapter = chapterSnap.data() as Chapter;

    const mangaSnap = await getDoc(doc(mangaCol, chapter.mangaId));
    if (!mangaSnap.exists()) throw new Error('Manga not found in database');
    const manga = mangaSnap.data() as any;

    const parts = chapterId.split(':');
    if (parts[0] !== 'scrape') {
      throw new Error('Only scraped content is supported for download currently');
    }

    const sourceId = parts[1];
    let url = chapter.url;
    let adapter: ScrapeAdapter | null = null;

    const session = getScrapeSession(sourceId);
    if (session) {
      url = url || session.chapterUrls[chapterId];
      adapter = new ScrapeAdapter(sourceId, session.config, session.baseUrl);
    }

    if (!adapter) {
      const savedSourceSnap = await getDoc(doc(scrapeSourcesCol, sourceId));
      if (savedSourceSnap.exists()) {
        const savedSource = savedSourceSnap.data() as any;
        adapter = new ScrapeAdapter(sourceId, savedSource.config, savedSource.baseUrl);
      }
    }

    if (!adapter || !url) {
      throw new Error('Source config or chapter URL not found');
    }

    const response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
    if (!response.ok) throw new Error(`Failed to fetch chapter pages: ${response.status}`);
    const html = await response.text();
    const scrapedPages = adapter.parseChapterPage(html);

    const sourceUrl = new URL(url);
    const refererUrl = `${sourceUrl.protocol}//${sourceUrl.host}/`;
    const downloadedPages: Array<{ index: number; blobUrl: string }> = [];
    let sizeBytes = 0;

    for (let i = 0; i < scrapedPages.length; i++) {
      const page = scrapedPages[i];
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(page.imageUrl)}&referer=${encodeURIComponent(refererUrl)}`;
      const imgRes = await fetch(proxyUrl);
      if (!imgRes.ok) throw new Error(`Failed to download page ${i + 1}`);

      const blob = await imgRes.blob();
      sizeBytes += blob.size;

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const dataUrl = await base64Promise;

      downloadedPages.push({
        index: page.index,
        blobUrl: dataUrl,
      });

      progressCallback?.(Math.round(((i + 1) / scrapedPages.length) * 100));
    }

    await setDoc(doc(downloadedChaptersCol, chapterId), {
      id: chapterId,
      chapterId,
      mangaId: chapter.mangaId,
      pages: downloadedPages,
      downloadedAt: new Date().toISOString(),
      sizeBytes,
    }, { merge: true });
  },

  async isChapterDownloaded(chapterId: string): Promise<boolean> {
    const snap = await getDoc(doc(downloadedChaptersCol, chapterId));
    return snap.exists();
  },

  async getDownloadedPages(chapterId: string): Promise<Page[] | null> {
    const snap = await getDoc(doc(downloadedChaptersCol, chapterId));
    if (!snap.exists()) return null;
    const dc = snap.data() as any;
    return dc.pages.map((p: any) => ({
      index: p.index,
      imageUrl: p.blobUrl,
    }));
  },

  async deleteDownload(chapterId: string): Promise<void> {
    await deleteDoc(doc(downloadedChaptersCol, chapterId));
  },
};
