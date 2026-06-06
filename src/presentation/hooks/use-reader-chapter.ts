import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, getDoc, setDoc } from '~/infrastructure/db/db-gateway';
import { db } from '~/lib/firebase';
import { sourceRegistry } from '~/infrastructure/sources';
import { statusService } from '~/infrastructure/services';
import { getScrapeSession, type ChapterInfo } from '~/services/scrape/sessionStore';
import { ScrapeAdapter } from '~/services/scrape/scrapeAdapter';
import { useSettingsStore } from '~/presentation/stores';
import type { Page } from '~/domain/types';
import { downloadManager } from '~/services/downloads/download-manager';
import { useAuth } from '~/lib/auth-context';

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
  const { uid, loading: authLoading } = useAuth();
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

      if (!uid) throw new Error('Login required');
      const chapterSnap = await getDoc(doc(db, 'users', uid, 'chapters', chapterId));
      const chapter = chapterSnap.exists() ? chapterSnap.data() as any : null;
      if (chapter) {
        if (chapter.lastReadPage) setCurrentPageIndex(chapter.lastReadPage);
        if (chapter.status) setChapterStatus(chapter.status);
      }

      const offlinePages = await downloadManager.getDownloadedPages(uid, chapterId);
      if (offlinePages) {
        setPages(offlinePages);
        loadingToast.dismiss();
        setLoading(false);
        return;
      }

      let url = chapter?.url;
      let adapter: ScrapeAdapter | null = null;

      if (!url) {
        const session = getScrapeSession(sId);
        if (session) {
          url = session.chapterUrls[chapterId];
          adapter = new ScrapeAdapter(sId, session.config, session.baseUrl);
        }
      }

      if (!adapter) {
        const provider = sourceRegistry.getOrRehydrate(registrySourceId);
        adapter = provider instanceof ScrapeAdapter ? provider : null;
        if (!adapter) {
          const savedSourceSnap = await getDoc(doc(db, 'users', uid, 'scrapeSources', sId));
          if (savedSourceSnap.exists()) {
            const savedSource = savedSourceSnap.data() as any;
            sourceRegistry.registerScrapeSource(savedSource.id, savedSource.config, savedSource.baseUrl);
            adapter = sourceRegistry.get(registrySourceId) as ScrapeAdapter | null;
          }
        }
        if (!adapter) {
          const { getPreset } = await import('~/services/scrape/presets');
          const preset = getPreset(sId.replace('preset-', ''));
          if (preset) {
            adapter = new ScrapeAdapter(sId, preset.config, preset.baseUrl);
          }
        }
        if (!adapter) throw new Error(`Scrape adapter not found for source: ${registrySourceId}`);
      }

      if (!url) {
        const mangaIdParam = searchParams.get('manga');
        if (mangaIdParam && mangaIdParam.startsWith('scrape:')) {
          const mangaParts = mangaIdParam.split(':');
          const mangaUrlSlug = mangaParts.slice(2).join(':');
          if (mangaUrlSlug) {
            const baseUrl = adapter.sourceUrl;
            const liveMangaUrl = `${baseUrl.replace(/\/+$/, '')}/manga/${mangaUrlSlug}/`;

            const res = await fetch(`/api/proxy?url=${encodeURIComponent(liveMangaUrl)}`);
            if (res.ok) {
              const html = await res.text();
              const processedHtml = html
                .replace(/<head>/i, `<head><base href="${liveMangaUrl}" />`)
                .replace(/\sdata-(?:src|lazy-src|original)\s*=\s*(['"])(.*?)\1/gi,
                  (_, quote, val) => ` src=${quote}${val}${quote} data-processed="true"`);
              const parsedManga = adapter.parseMangaPage(processedHtml);
              const matchedChapter = parsedManga.chapters.find(c => c.id === chapterId);
              if (matchedChapter) url = matchedChapter.url;
            }
          }
        }
      }

      if (!url) {
        throw new Error('Chapter URL not found and could not be recovered');
      }

      const response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gagal mengambil chapter: HTTP ${response.status} ${errText.slice(0, 200)}`);
      }
      const html = await response.text();

      const scrapedPages = adapter.parseChapterPage(html);
      const refererUrl = url;

      setPages(scrapedPages.map((page) => ({
        index: page.index,
        imageUrl: `/api/proxy?url=${encodeURIComponent(page.imageUrl)}&referer=${encodeURIComponent(refererUrl)}`,
      })));
      loadingToast.dismiss();
    } catch (err) {
      loadingToast.dismiss();
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPages([]);
    } finally {
      setLoading(false);
    }
  }, [chapterId, uid, toast, searchParams]);

  useEffect(() => {
    if (!chapterId) return;
    if (!chapterId.startsWith('scrape:')) {
      setLoading(true);
      setPages(generatePlaceholderPages(5));
      setLoading(false);
      return;
    }
    if (authLoading) return;
    if (!uid) {
      setError('Login required');
      setLoading(false);
      return;
    }
    void loadScrapeChapter();
  }, [chapterId, authLoading, uid, loadScrapeChapter]);

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
    if (!uid) {
      setSavedInLib(false);
      return;
    }
    void getDoc(doc(db, 'users', uid, 'libraryEntries', session.mangaId)).then((snap) => setSavedInLib(Boolean(snap.exists())));
  }, [sourceId, uid]);

  useEffect(() => {
    if (pages.length === 0 || chapterViewed) return;
    const mangaId = mangaInfo?.mangaId ?? searchParams.get('manga') ?? '';
    if (!mangaId) return;
    setChapterViewed(true);
    if (chapterStatus === 'unread') {
      setChapterStatus('viewed');
      if (!uid) return;
    void statusService.markChapterStatus(uid, chapterId, mangaId, 'viewed', 0);
    }
  }, [pages, chapterViewed, mangaInfo, searchParams, chapterStatus, chapterId]);

  useEffect(() => {
    if (pages.length === 0 || chapterStatus === 'completed') return;
    if (currentPageIndex < pages.length - 1) return;
    if (!chapterViewed) return;
    const mangaId = mangaInfo?.mangaId ?? searchParams.get('manga') ?? '';
    if (!mangaId) return;
    setChapterStatus('completed');
    if (!uid) return;
    void statusService.markChapterStatus(uid, chapterId, mangaId, 'completed', pages.length - 1);
  }, [currentPageIndex, pages.length, chapterId, mangaInfo, searchParams, chapterStatus, chapterViewed]);

  useEffect(() => {
    if (!chapterViewed || pages.length === 0) return;
    const mangaId = mangaInfo?.mangaId ?? searchParams.get('manga') ?? '';
    if (!mangaId) return;
    const t = setTimeout(() => {
      if (chapterStatus !== 'completed') {
        if (!uid) return;
        void statusService.markChapterStatus(uid, chapterId, mangaId, 'viewed', currentPageIndex);
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

      if (!uid) {
        toast.error('Login required');
        return;
      }
      await setDoc(doc(db, 'users', uid, 'scrapeSources', mangaInfo.sourceId), {
        id: mangaInfo.sourceId,
        name: mangaInfo.title,
        baseUrl: session.baseUrl,
        config: session.config,
        createdAt: new Date().toISOString(),
      }, { merge: true });

      await setDoc(doc(db, 'users', uid, 'manga', mangaInfo.mangaId), {
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
      } as any, { merge: true });

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
      await Promise.all(chapterRows.map((row) => setDoc(doc(db, 'users', uid, 'chapters', row.id), row, { merge: true })));

      await setDoc(doc(db, 'users', uid, 'libraryEntries', mangaInfo.mangaId), {
        mangaId: mangaInfo.mangaId,
        categories: [],
        dateAdded: new Date().toISOString(),
        unreadCount: chapterRows.length,
      }, { merge: true });

      setSavedInLib(true);
      loadingToast.dismiss();
      toast.success(`"${mangaInfo.title}" berhasil disimpan!`);
    } catch (err) {
      loadingToast.dismiss();
      toast.error('Gagal menyimpan: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }, [mangaInfo, uid, toast]);

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
