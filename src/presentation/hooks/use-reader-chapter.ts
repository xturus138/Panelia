import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '~/db/db';
import { sourceRegistry } from '~/infrastructure/sources';
import { statusService } from '~/infrastructure/services';
import { getScrapeSession, type ChapterInfo } from '~/services/scrape/sessionStore';
import { ScrapeAdapter } from '~/services/scrape/scrapeAdapter';
import { useSettingsStore } from '~/presentation/stores';
import type { Page } from '~/domain/types';

import { downloadManager } from '~/services/downloads/download-manager';

export type ReadingMode = 'vertical-scroll' | 'webtoon' | 'single-page' | 'horizontal-swipe';

function generatePlaceholderPages(count: number): Page[] {
  return Array.from({ length: count }).map((_, index) => ({
    index,
    imageUrl: `https://placehold.co/800x1200/1a1a1a/cccccc?text=Page+${index + 1}`,
  }));
}

export function useReaderChapterViewModel(
  chapterId: string,
  toast: {
    loading: (msg: string) => { id: string; update: (msg: string) => void; dismiss: () => void };
    error: (msg: string) => string;
    success: (msg: string) => string
  }
) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pages, setPages] = useState<Page[]>([]);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [savedInLib, setSavedInLib] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showChapterList, setShowChapterList] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [chapterStatus, setChapterStatus] = useState<'unread' | 'viewed' | 'completed'>('unread');
  const [chapterViewed, setChapterViewed] = useState(false);
  const [mangaInfo, setMangaInfo] = useState<{
    sourceId: string;
    mangaId: string;
    title: string;
    coverUrl: string;
    sourceUrl: string;
    chapters: ChapterInfo[];
  } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  const { readerMode, updateSettings } = useSettingsStore();
  const readingMode = readerMode as ReadingMode;
  const setReadingMode = useCallback((mode: ReadingMode) => {
    updateSettings({ readerMode: mode });
    setShowModeMenu(false);
    setCurrentPageIndex(0);
  }, [updateSettings]);

  const sourceId = chapterId.startsWith('scrape:') ? chapterId.split(':')[1] : '';

  const loadScrapeChapter = useCallback(async () => {
    console.log('[Reader] loadScrapeChapter START, chapterId:', chapterId);
    setLoading(true);
    setError(null);
    const loadingToast = toast.loading('Mencari chapter...');
    try {
      const parts = chapterId.split(':');
      if (parts.length < 4 || parts[0] !== 'scrape' || parts[2] !== 'ch') {
        throw new Error('Format ID chapter tidak valid');
      }

      const sId = parts[1];
      const registrySourceId = `scrape:${sId}`;
      console.log('[Reader] sId:', sId, 'registrySourceId:', registrySourceId);

      const chapter = await db.chapters.get(chapterId);
      console.log('[Reader] db.chapters.get:', chapter ? 'found' : 'null');
      if (chapter) {
        if (chapter.lastReadPage) setCurrentPageIndex(chapter.lastReadPage);
        if (chapter.status) setChapterStatus(chapter.status);
      }

      // Check downloaded pages first
      const offlinePages = await downloadManager.getDownloadedPages(chapterId);
      console.log('[Reader] offlinePages:', offlinePages ? `found ${offlinePages.length}` : 'null');
      if (offlinePages) {
        setPages(offlinePages);
        loadingToast.dismiss();
        setLoading(false);
        return;
      }

      let url = chapter?.url;
      console.log('[Reader] url from chapter:', url || 'null');
      let adapter: ScrapeAdapter | null = null;

      if (!url) {
        const session = getScrapeSession(sId);
        console.log('[Reader] session:', session ? 'found' : 'null');
        if (session) {
          url = session.chapterUrls[chapterId];
          console.log('[Reader] url from session:', url || 'null');
          adapter = new ScrapeAdapter(sId, session.config, session.baseUrl);
        }
      }

      if (!adapter) {
        console.log('[Reader] adapter not from session, trying sourceRegistry...');
        const provider = sourceRegistry.getOrRehydrate(registrySourceId);
        adapter = provider instanceof ScrapeAdapter ? provider : null;
        if (!adapter) {
          console.log('[Reader] not in registry, trying db.scrapeSources...');
          const savedSource = await db.scrapeSources.get(sId);
          if (savedSource) {
            sourceRegistry.registerScrapeSource(savedSource.id, savedSource.config, savedSource.baseUrl);
            adapter = sourceRegistry.get(registrySourceId) as ScrapeAdapter | null;
          }
        }
        if (!adapter) {
          console.log('[Reader] not in db, trying builtin presets...');
          const { getPreset } = await import('~/services/scrape/presets');
          const preset = getPreset(sId.replace('preset-', ''));
          console.log('[Reader] preset:', preset ? preset.name : 'null');
          if (preset) {
            adapter = new ScrapeAdapter(sId, preset.config, preset.baseUrl);
          }
        }
        if (!adapter) throw new Error(`Scrape adapter not found for source: ${registrySourceId}`);
      }

      if (!url) {
        // Fallback: Try to reconstruct manga URL and fetch it to find chapter URL
        const mangaIdParam = searchParams.get('manga');
        console.log('[Reader] url still missing, trying fallback... mangaIdParam:', mangaIdParam);
        if (mangaIdParam && mangaIdParam.startsWith('scrape:')) {
          const mangaParts = mangaIdParam.split(':');
          const mangaUrlSlug = mangaParts.slice(2).join(':');
          console.log('[Reader] mangaUrlSlug:', mangaUrlSlug);
          if (mangaUrlSlug) {
            const baseUrl = adapter.sourceUrl;
            console.log('[Reader] baseUrl:', baseUrl);
            const liveMangaUrl = `${baseUrl.replace(/\/+$/, '')}/manga/${mangaUrlSlug}/`;
            console.log('[Reader] liveMangaUrl:', liveMangaUrl);

            const res = await fetch(`/api/proxy?url=${encodeURIComponent(liveMangaUrl)}`);
            console.log('[Reader] manga fetch status:', res.status);
            if (res.ok) {
              const html = await res.text();
              console.log('[Reader] html length:', html.length);
              const processedHtml = html
                .replace(/<head>/i, `<head><base href="${liveMangaUrl}" />`)
                .replace(/\sdata-(?:src|lazy-src|original)\s*=\s*(['"])(.*?)\1/gi,
                  (_, quote, val) => ` src=${quote}${val}${quote} data-processed="true"`);
              const parsedManga = adapter.parseMangaPage(processedHtml);
              console.log('[Reader] parsed chapters count:', parsedManga.chapters.length);
              const matchedChapter = parsedManga.chapters.find(c => c.id === chapterId);
              console.log('[Reader] matchedChapter:', matchedChapter ? matchedChapter.title : 'null');
              if (matchedChapter) url = matchedChapter.url;
            } else {
              console.error('[Reader] manga fetch failed:', await res.text().then(t => t.slice(0, 200)));
            }
          }
        }
      }

      if (!url) {
        console.error('[Reader] FINAL: url still null after all attempts');
        throw new Error('Chapter URL not found and could not be recovered');
      }
      console.log('[Reader] url resolved:', url);

      console.log('[Reader] fetching chapter page...');
      const response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
      console.log('[Reader] chapter fetch status:', response.status);
      if (!response.ok) {
        const errText = await response.text();
        console.error('[Reader] chapter fetch error:', errText.slice(0, 500));
        throw new Error(`Gagal mengambil chapter: HTTP ${response.status}`);
      }
      const html = await response.text();
      console.log('[Reader] chapter html length:', html.length);

      const scrapedPages = adapter.parseChapterPage(html);
      console.log('[Reader] scrapedPages count:', scrapedPages.length);
      // Use full chapter URL as Referer for better CDN/anti-hotlink compatibility
      const refererUrl = url;

      setPages(scrapedPages.map((page) => ({
        index: page.index,
        imageUrl: `/api/proxy?url=${encodeURIComponent(page.imageUrl)}&referer=${encodeURIComponent(refererUrl)}`,
      })));
      console.log('[Reader] SUCCESS: setPages called with', scrapedPages.length, 'pages');
      loadingToast.dismiss();
    } catch (err) {
      console.error('[Reader] loadScrapeChapter ERROR:', err);
      loadingToast.dismiss();
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPages([]);
    } finally {
      setLoading(false);
    }
  }, [chapterId, toast, searchParams]);

  useEffect(() => {
    if (!chapterId) return;
    if (chapterId.startsWith('scrape:')) {
      void loadScrapeChapter();
      return;
    }
    setLoading(true);
    setPages(generatePlaceholderPages(5));
    setLoading(false);
  }, [chapterId, loadScrapeChapter]);

  useEffect(() => {
    if (!sourceId) return;
    const session = getScrapeSession(sourceId);
    if (!session) return;
    setMangaInfo({
      sourceId,
      mangaId: session.mangaId,
      title: session.mangaTitle,
      coverUrl: session.mangaCoverUrl,
      sourceUrl: session.sourceUrl,
      chapters: [...session.chapters].sort((a, b) => a.chapterNumber - b.chapterNumber),
    });
    void db.libraryEntries.get(session.mangaId).then((entry) => setSavedInLib(Boolean(entry)));
  }, [sourceId]);

  useEffect(() => {
    if (pages.length === 0 || chapterViewed) return;
    const mangaId = mangaInfo?.mangaId ?? searchParams.get('manga') ?? '';
    if (!mangaId) return;
    setChapterViewed(true);
    if (chapterStatus === 'unread') {
      setChapterStatus('viewed');
      void statusService.markChapterStatus(chapterId, mangaId, 'viewed', 0);
    }
  }, [pages, chapterViewed, mangaInfo, searchParams, chapterStatus, chapterId]);

  useEffect(() => {
    if (pages.length === 0 || chapterStatus === 'completed') return;
    if (currentPageIndex < pages.length - 1) return;
    if (!chapterViewed) return;
    const mangaId = mangaInfo?.mangaId ?? searchParams.get('manga') ?? '';
    if (!mangaId) return;
    setChapterStatus('completed');
    void statusService.markChapterStatus(chapterId, mangaId, 'completed', pages.length - 1);
  }, [currentPageIndex, pages.length, chapterId, mangaInfo, searchParams, chapterStatus, chapterViewed]);

  useEffect(() => {
    if (!chapterViewed || pages.length === 0) return;
    const mangaId = mangaInfo?.mangaId ?? searchParams.get('manga') ?? '';
    if (!mangaId) return;
    const t = setTimeout(() => {
      if (chapterStatus !== 'completed') {
        void statusService.markChapterStatus(chapterId, mangaId, 'viewed', currentPageIndex);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [currentPageIndex, chapterViewed, pages.length, mangaInfo, searchParams, chapterStatus, chapterId]);

  const handleBack = useCallback(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'panelia:close-reader' }, window.location.origin);
      return;
    }
    if (mangaInfo) {
      const compositeId = `${mangaInfo.sourceId}:${mangaInfo.mangaId}`;
      router.push(`/manga/${encodeURIComponent(compositeId)}`);
      return;
    }
    const mangaParam = searchParams.get('manga');
    if (mangaParam) {
      router.push(`/manga/${encodeURIComponent(mangaParam)}`);
      return;
    }
    router.back();
  }, [mangaInfo, searchParams, router]);

  const handleSaveToLibrary = useCallback(async () => {
    if (!mangaInfo) return;
    setSaving(true);
    const loadingToast = toast.loading('Menyimpan ke library...');
    try {
      const session = getScrapeSession(mangaInfo.sourceId);
      if (!session) {
        loadingToast.dismiss();
        toast.error('Session tidak ditemukan');
        return;
      }

      await db.scrapeSources.put({
        id: mangaInfo.sourceId,
        name: mangaInfo.title,
        baseUrl: session.baseUrl,
        config: session.config,
        createdAt: new Date().toISOString(),
      });

      await db.manga.put({
        id: mangaInfo.mangaId,
        sourceId: 'scrape',
        title: mangaInfo.title,
        coverUrl: mangaInfo.coverUrl,
        author: '',
        artist: '',
        status: 'unknown',
        description: '',
        genres: [],
        tags: [],
        url: mangaInfo.sourceUrl,
      } as any);

      const chapterRows = [...mangaInfo.chapters]
        .sort((a, b) => a.chapterNumber - b.chapterNumber)
        .map((ch) => ({
          id: ch.id,
          mangaId: mangaInfo.mangaId,
          chapterNumber: ch.chapterNumber,
          title: ch.title,
          scanlator: '',
          releaseDate: '',
          pageCount: 0,
          read: false,
          lastReadPage: 0,
          url: session.chapterUrls[ch.id] || '',
          status: 'unread' as const,
        }));
      await db.chapters.bulkPut(chapterRows);

      await db.libraryEntries.put({
        mangaId: mangaInfo.mangaId,
        categories: [],
        dateAdded: new Date().toISOString(),
        unreadCount: chapterRows.length,
      });

      setSavedInLib(true);
      loadingToast.dismiss();
      toast.success(`"${mangaInfo.title}" berhasil disimpan!`);
    } catch (err) {
      loadingToast.dismiss();
      toast.error('Gagal menyimpan: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }, [mangaInfo, toast]);

  const navigateToChapter = useCallback((chId: string) => {
    setShowChapterList(false);
    setControlsVisible(false);
    const mangaParam = mangaInfo?.mangaId ? `?manga=${encodeURIComponent(mangaInfo.mangaId)}` : '';
    router.push(`/reader/${encodeURIComponent(chId)}${mangaParam}`);
  }, [mangaInfo, router]);

  const toggleControls = useCallback(() => setControlsVisible((v) => !v), []);

  return {
    pages,
    controlsVisible,
    setControlsVisible,
    loading,
    error,
    currentPageIndex,
    setCurrentPageIndex,
    savedInLib,
    saving,
    showChapterList,
    setShowChapterList,
    showModeMenu,
    setShowModeMenu,
    chapterStatus,
    mangaInfo,
    scrollContainerRef,
    modeMenuRef,
    readingMode,
    setReadingMode,
    loadScrapeChapter,
    handleBack,
    handleSaveToLibrary,
    navigateToChapter,
    toggleControls,
  };
}