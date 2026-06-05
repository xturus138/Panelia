"use client";

import { use, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Page } from '~/types';
import { sourceRegistry } from '~/services/sources';
import { db } from '~/db/db';
import { getScrapeSession, type ChapterInfo } from '~/services/scrape/sessionStore';
import { ScrapeAdapter } from '~/services/scrape/scrapeAdapter';
import { useSettingsStore } from '~/store/useSettingsStore';
import {
  ArrowLeft,
  ArrowLeftCircle,
  ArrowRightCircle,
  List,
  ExternalLink,
  Check,
  ChevronDown,
  X,
  Layout,
  Loader2,
  AlertCircle,
  RefreshCw,
  Save,
  FileText,
  Smartphone,
  ScrollText,
  GalleryHorizontal,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useToast } from '~/hooks/useToast';
import { statusService } from '~/infrastructure/services';

type ReadingMode = 'vertical-scroll' | 'webtoon' | 'single-page' | 'horizontal-swipe';

// Generate placeholder pages for testing reader
function generatePlaceholderPages(count: number): Page[] {
  return Array.from({ length: count }).map((_, i) => ({
    index: i,
    imageUrl: `https://placehold.co/800x1200/1a1a1a/cccccc?text=Page+${i + 1}`,
  }));
}

export default function ReaderPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId: rawChapterId } = use(params);
  const chapterId = decodeURIComponent(rawChapterId);
  const router = useRouter();

  const [pages, setPages] = useState<Page[]>([]);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { readerMode, updateSettings } = useSettingsStore();
  const readingMode = readerMode as ReadingMode;
  const setReadingMode = useCallback((mode: ReadingMode) => updateSettings({ readerMode: mode }), [updateSettings]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [savedInLib, setSavedInLib] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showChapterList, setShowChapterList] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [chapterStatus, setChapterStatus] = useState<'unread' | 'viewed' | 'completed'>('unread');
  const [chapterViewed, setChapterViewed] = useState(false);
  const searchParams = useSearchParams();
  const toast = useToast();

  // Manga info from session store
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

  // ---- Load chapter ----
  useEffect(() => {
    if (!chapterId) return;

    if (chapterId.startsWith('scrape:')) {
      loadScrapeChapter(chapterId);
    } else {
      setLoading(true);
      setPages(generatePlaceholderPages(5));
      setLoading(false);
    }
  }, [chapterId]);

  // Resolve session source id from chapterId
  const sourceId = chapterId.startsWith('scrape:') ? chapterId.split(':')[1] : '';

  // ---- Look up manga info from session ----
  useEffect(() => {
    if (!sourceId) return;
    const session = getScrapeSession(sourceId);
    if (session) {
      setMangaInfo({
        sourceId,
        mangaId: session.mangaId,
        title: session.mangaTitle,
        coverUrl: session.mangaCoverUrl,
        sourceUrl: session.sourceUrl,
        chapters: [...session.chapters].sort((a, b) => a.chapterNumber - b.chapterNumber),
      });
      // Check if already saved in library
      db.libraryEntries.get(session.mangaId).then((entry) => {
        setSavedInLib(!!entry);
      });
    }
  }, [sourceId]);

  // ---- Close mode menu on outside click ----
  useEffect(() => {
    if (!showModeMenu) return;
    const handler = (e: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setShowModeMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModeMenu]);

  // ---- Mark chapter as viewed when pages load ----
  useEffect(() => {
    if (pages.length === 0 || chapterViewed) return;
    const mangaId = mangaInfo?.mangaId ?? searchParams.get('manga') ?? '';
    if (!mangaId) return;
    setChapterViewed(true);
    // Don't downgrade a previously completed chapter on reopen
    if (chapterStatus === 'unread') {
      setChapterStatus('viewed');
      statusService.markChapterStatus(chapterId, mangaId, 'viewed', 0);
    }
  }, [pages, chapterId, mangaInfo, searchParams, chapterViewed, chapterStatus]);

  // ---- Mark chapter completed when on last page ----
  useEffect(() => {
    if (pages.length === 0 || chapterStatus === 'completed') return;
    if (currentPageIndex < pages.length - 1) return;
    // Only mark completed if we've already viewed (not first render)
    if (!chapterViewed) return;
    const mangaId = mangaInfo?.mangaId ?? searchParams.get('manga') ?? '';
    if (!mangaId) return;
    setChapterStatus('completed');
    statusService.markChapterStatus(chapterId, mangaId, 'completed', pages.length - 1);
  }, [currentPageIndex, pages.length, chapterId, mangaInfo, searchParams, chapterStatus, chapterViewed]);

  // ---- Update last read page on navigation ----
  useEffect(() => {
    if (!chapterViewed || pages.length === 0) return;
    const mangaId = mangaInfo?.mangaId ?? searchParams.get('manga') ?? '';
    if (!mangaId) return;
    // Debounce: only persist every few page changes (not every render)
    const t = setTimeout(() => {
      if (chapterStatus !== 'completed') {
        statusService.markChapterStatus(chapterId, mangaId, 'viewed', currentPageIndex);
      }
    }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageIndex]);

  async function loadScrapeChapter(chapterId: string) {
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

      // Try the database first (saved/library path)
      loadingToast.update('Mencari chapter di database...');
      const chapter = await db.chapters.get(chapterId);
      if (chapter) {
        if (chapter.lastReadPage) setCurrentPageIndex(chapter.lastReadPage);
        if (chapter.status) setChapterStatus(chapter.status);
      }
      let url = chapter?.url;
      let adapter: any = null;

      if (!url) {
        // Live-read fallback: use the in-memory session store
        const session = getScrapeSession(sId);
        if (!session) {
          throw new Error(`Chapter not found in database and no live session available for ${sId}`);
        }
        url = session.chapterUrls[chapterId];
        if (!url) {
          throw new Error('Chapter URL not found in live session');
        }
        adapter = new ScrapeAdapter(sId, session.config, session.baseUrl);
      }

      // If we don't have an adapter yet (saved path), look it up
      if (!adapter) {
        adapter = sourceRegistry.getOrRehydrate(registrySourceId);
        if (!adapter) {
          const savedSource = await db.scrapeSources.get(sId);
          if (savedSource) {
            sourceRegistry.registerScrapeSource(savedSource.id, savedSource.config, savedSource.baseUrl);
            adapter = sourceRegistry.get(registrySourceId);
          }
        }
        if (!adapter) {
          const session = getScrapeSession(sId);
          if (session) {
            adapter = new ScrapeAdapter(sId, session.config, session.baseUrl);
          }
        }
        if (!adapter) {
          throw new Error(`Scrape adapter not found for source: ${registrySourceId}`);
        }
      }

      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      loadingToast.update('Mengambil halaman chapter...');
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Gagal mengambil chapter: HTTP ${response.status}`);
      }
      const html = await response.text();

      loadingToast.update('Memproses halaman...');
      const scrapedPages = (adapter as any).parseChapterPage(html);

      const sourceUrl = new URL(url);
      const refererUrl = `${sourceUrl.protocol}//${sourceUrl.host}/`;

      const pages: Page[] = scrapedPages.map((p: any) => ({
        index: p.index,
        imageUrl: `/api/proxy?url=${encodeURIComponent(p.imageUrl)}&referer=${encodeURIComponent(refererUrl)}`,
      }));

      setPages(pages);
      loadingToast.dismiss();
    } catch (err) {
      console.error('Error loading scrape chapter:', err);
      loadingToast.dismiss();
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPages([]);
    } finally {
      setLoading(false);
    }
  }

  // ---- Back to manga detail ----
  const handleBack = useCallback(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'panelia:close-reader' }, window.location.origin);
      return;
    }

    if (mangaInfo) {
      // mangaInfo.sourceId already includes "scrape:" prefix for scrape sources
      const compositeId = `${mangaInfo.sourceId}:${mangaInfo.mangaId}`;
      router.push(`/manga/${encodeURIComponent(compositeId)}`);
      return;
    }

    // API source (mangadex) or fallback: use ?manga= query param
    const mangaParam = searchParams.get('manga');
    if (mangaParam) {
      router.push(`/manga/${encodeURIComponent(mangaParam)}`);
      return;
    }

    // Last resort: go back in history
    router.back();
  }, [mangaInfo, searchParams, router]);

  // ---- Save to library ----
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

      // Save scrape source config
      await db.scrapeSources.put({
        id: mangaInfo.sourceId,
        name: mangaInfo.title,
        baseUrl: session.baseUrl,
        config: session.config,
        createdAt: new Date().toISOString(),
      });

      // Save manga
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

      // Save chapters (sorted by chapterNumber asc for consistent ordering)
      const chapterRows = [...mangaInfo.chapters]
        .sort((a, b) => a.chapterNumber - b.chapterNumber)
        .map((ch, idx) => ({
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

      // Add to library
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
      console.error('Failed to save:', err);
      loadingToast.dismiss();
      toast.error('Gagal menyimpan: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }, [mangaInfo]);

  // ---- Chapter navigation ----
  const currentChapterIndex = mangaInfo?.chapters.findIndex((ch) => ch.id === chapterId) ?? -1;
  const prevChapter = currentChapterIndex > 0 ? mangaInfo?.chapters[currentChapterIndex - 1] : null;
  const nextChapter = currentChapterIndex >= 0 && currentChapterIndex < (mangaInfo?.chapters.length ?? 0) - 1
    ? mangaInfo?.chapters[currentChapterIndex + 1]
    : null;

  const navigateToChapter = (chId: string) => {
    setShowChapterList(false);
    setControlsVisible(false);
    // Navigate to new chapter URL, preserving manga query param
    const mangaParam = mangaInfo?.mangaId ? `?manga=${encodeURIComponent(mangaInfo.mangaId)}` : '';
    router.push(`/reader/${encodeURIComponent(chId)}${mangaParam}`);
  };

  // ---- Page navigation (single-page mode) ----
  const goToPrevPage = () => {
    setCurrentPageIndex((i) => Math.max(0, i - 1));
  };
  const goToNextPage = () => {
    setCurrentPageIndex((i) => Math.min(pages.length - 1, i + 1));
  };

  // ---- Toggle controls ----
  const toggleControls = () => setControlsVisible((v) => !v);

  // ---- Reading mode label ----
  const modeLabels: Record<ReadingMode, string> = {
    'vertical-scroll': 'Vertical Scroll',
    'webtoon': 'Webtoon',
    'single-page': 'Single Page',
    'horizontal-swipe': 'Horizontal Swipe',
  };

  // ---- Render pages based on mode ----
  function renderPages() {
    if (readingMode === 'single-page') {
      const page = pages[currentPageIndex];
      if (!page) return null;
      return (
        <div className="flex-1 flex items-center justify-center relative select-none">
          {/* Click zones for single-page mode */}
          <div className="absolute inset-0 flex z-10">
            <div
              className="w-1/3 h-full cursor-pointer"
              onClick={(e) => { e.stopPropagation(); goToPrevPage(); }}
            />
            <div
              className="w-1/3 h-full cursor-pointer"
              onClick={(e) => { e.stopPropagation(); toggleControls(); }}
            />
            <div
              className="w-1/3 h-full cursor-pointer"
              onClick={(e) => { e.stopPropagation(); goToNextPage(); }}
            />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={page.imageUrl}
            alt={`Page ${page.index + 1}`}
            className="max-h-full max-w-full object-contain z-0"
          />
        </div>
      );
    }

    if (readingMode === 'horizontal-swipe') {
      const page = pages[currentPageIndex];
      if (!page) return null;
      return (
        <div className="flex-1 flex items-center justify-center relative select-none">
          <div className="absolute inset-0 flex z-10">
            <div
              className="w-1/3 h-full cursor-pointer"
              onClick={(e) => { e.stopPropagation(); goToPrevPage(); }}
            />
            <div
              className="w-1/3 h-full cursor-pointer"
              onClick={(e) => { e.stopPropagation(); toggleControls(); }}
            />
            <div
              className="w-1/3 h-full cursor-pointer"
              onClick={(e) => { e.stopPropagation(); goToNextPage(); }}
            />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={page.imageUrl}
            alt={`Page ${page.index + 1}`}
            className="max-h-full max-w-full object-contain z-0"
          />
        </div>
      );
    }

    // Vertical scroll / webtoon
    const gap = readingMode === 'webtoon' ? '' : 'gap-2';

    return (
      <div className={`flex flex-col ${gap} w-full max-w-3xl mx-auto`}>
        {pages.map((page) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={page.index}
            src={page.imageUrl}
            alt={`Page ${page.index + 1}`}
            className="w-full object-contain"
            loading="lazy"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col">
      {/* Main content area */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto ${readingMode === 'webtoon' ? '' : readingMode === 'vertical-scroll' ? 'px-0' : ''}`}
        onClick={(e) => {
          // Only toggle controls on click outside interactive elements
          const target = e.target as HTMLElement;
          if (target.closest('button, a, select, .click-zone, .mode-menu')) return;
          if (readingMode === 'single-page' || readingMode === 'horizontal-swipe') return;
          toggleControls();
        }}
      >
        {loading && !pages.length && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-screen p-6 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-white/90 text-[14px] font-medium">Memuat chapter...</p>
            <p className="text-white/50 text-[12px]">Mohon tunggu sebentar...</p>
          </div>
        )}
        {error && !pages.length && (
          <div className="flex-1 flex flex-col items-center justify-center min-h-screen p-6 gap-4">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <div className="text-center max-w-sm">
              <p className="text-white/90 text-[15px] font-semibold mb-1">Gagal Memuat Chapter</p>
              <p className="text-white/60 text-[13px] mb-4">{error}</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={(e) => { e.stopPropagation(); loadScrapeChapter(chapterId); }}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium flex items-center gap-2 hover:bg-primary/90"
                >
                  <RefreshCw className="w-4 h-4" />
                  Coba Lagi
                </button>
                <button
                  onClick={() => router.back()}
                  className="px-4 py-2 rounded-lg bg-white/10 text-white text-[13px] font-medium hover:bg-white/20"
                >
                  Kembali
                </button>
              </div>
            </div>
          </div>
        )}
        {pages.length > 0 && renderPages()}
      </div>

      {/* ---- Overlay Controls ---- */}
      {controlsVisible && (
        <>
          {/* Top Bar */}
          <div className="fixed top-0 left-0 right-0 bg-black/85 backdrop-blur-sm text-white z-20">
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex-shrink-0 text-[12px]"
                  aria-label="Kembali"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Kembali</span>
                </button>
                {mangaInfo && (
                  <span className="text-[13px] font-medium truncate">{mangaInfo.title}</span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Reading mode selector */}
                <div ref={modeMenuRef} className="relative mode-menu">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowModeMenu((v) => !v); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-[12px]"
                    aria-label="Mode Baca"
                  >
                    <Layout className="w-4 h-4" />
                    <span className="hidden sm:inline">Mode</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showModeMenu && (
                    <div className="absolute top-full right-0 mt-1 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[180px] z-30">
                      <button
                        onClick={(e) => { e.stopPropagation(); setReadingMode('vertical-scroll'); setShowModeMenu(false); setCurrentPageIndex(0); }}
                        className={`w-full px-3 py-2.5 text-left text-[13px] flex items-center gap-2.5 ${readingMode === 'vertical-scroll' ? 'text-primary bg-primary/10' : 'text-foreground hover:bg-muted'}`}
                      >
                        <ScrollText className="w-4 h-4" />
                        Scroll Vertikal
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setReadingMode('webtoon'); setShowModeMenu(false); setCurrentPageIndex(0); }}
                        className={`w-full px-3 py-2.5 text-left text-[13px] flex items-center gap-2.5 ${readingMode === 'webtoon' ? 'text-primary bg-primary/10' : 'text-foreground hover:bg-muted'}`}
                      >
                        <Smartphone className="w-4 h-4" />
                        Webtoon
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setReadingMode('single-page'); setShowModeMenu(false); setCurrentPageIndex(0); }}
                        className={`w-full px-3 py-2.5 text-left text-[13px] flex items-center gap-2.5 ${readingMode === 'single-page' ? 'text-primary bg-primary/10' : 'text-foreground hover:bg-muted'}`}
                      >
                        <FileText className="w-4 h-4" />
                        Halaman Tunggal
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setReadingMode('horizontal-swipe'); setShowModeMenu(false); setCurrentPageIndex(0); }}
                        className={`w-full px-3 py-2.5 text-left text-[13px] flex items-center gap-2.5 ${readingMode === 'horizontal-swipe' ? 'text-primary bg-primary/10' : 'text-foreground hover:bg-muted'}`}
                      >
                        <GalleryHorizontal className="w-4 h-4" />
                        Geser Horizontal
                      </button>
                    </div>
                  )}
                </div>

                {/* Chapter list button */}
                {mangaInfo && mangaInfo.chapters.length > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowChapterList(true); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-[12px]"
                    aria-label="Daftar Chapter"
                  >
                    <List className="w-4 h-4" />
                    <span className="hidden sm:inline">Chapter</span>
                  </button>
                )}

                {/* External link */}
                {mangaInfo?.sourceUrl && (
                  <a
                    href={mangaInfo.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-[12px]"
                    aria-label="Buka di Browser"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span className="hidden sm:inline">Buka</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="fixed bottom-0 left-0 right-0 bg-black/85 backdrop-blur-sm text-white z-20">
            {/* Page slider (visible in single-page / horizontal modes) */}
            {(readingMode === 'single-page' || readingMode === 'horizontal-swipe') && pages.length > 1 && (
              <div className="px-4 py-1">
                <input
                  type="range"
                  min={0}
                  max={pages.length - 1}
                  value={currentPageIndex}
                  onChange={(e) => { e.stopPropagation(); setCurrentPageIndex(Number(e.target.value)); }}
                  className="w-full h-1 appearance-none bg-white/20 rounded-full cursor-pointer accent-primary"
                  aria-label="Page slider"
                />
              </div>
            )}

            <div className="flex items-center justify-between px-3 py-2.5">
              {/* Left: Chapter nav */}
              <div className="flex items-center gap-1">
                {prevChapter ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); navigateToChapter(prevChapter.id); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[12px] font-medium"
                  >
                    <ArrowLeftCircle className="w-4 h-4" />
                    <span>Sebelumnya</span>
                  </button>
                ) : (
                  <div className="w-24" />
                )}
              </div>

              {/* Center: Page info & Save */}
              <div className="text-[12px] text-white/70 flex items-center gap-2">
                {(readingMode === 'single-page' || readingMode === 'horizontal-swipe') ? (
                  <span className="px-2 py-1 bg-white/10 rounded text-white/80">
                    Halaman {currentPageIndex + 1} / {pages.length}
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-white/10 rounded text-white/80">
                    {pages.length} Halaman
                  </span>
                )}

                {/* Save button */}
                {mangaInfo && !savedInLib && !saving && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSaveToLibrary(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Simpan</span>
                  </button>
                )}
                {saving && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-[12px]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="hidden sm:inline">Menyimpan...</span>
                  </span>
                )}
                {savedInLib && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-[12px] font-medium">
                    <Check className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Tersimpan</span>
                  </span>
                )}
              </div>

              {/* Right: Next chapter */}
              <div className="flex items-center gap-1">
                {nextChapter ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); navigateToChapter(nextChapter.id); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[12px] font-medium"
                  >
                    <span>Selanjutnya</span>
                    <ArrowRightCircle className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="w-24" />
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ---- Chapter List Drawer ---- */}
      {showChapterList && mangaInfo && (
        <div
          className="fixed inset-0 bg-black/60 z-30"
          onClick={(e) => { e.stopPropagation(); setShowChapterList(false); }}
        >
          <div
            className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-card shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center justify-between bg-card/50">
              <h3 className="font-semibold text-foreground text-[14px]">
                {mangaInfo.chapters.length} Chapter
              </h3>
              <button
                onClick={() => setShowChapterList(false)}
                className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="divide-y divide-border">
              {mangaInfo.chapters.map((ch) => {
                const isCurrent = ch.id === chapterId;
                return (
                  <button
                    key={ch.id}
                    onClick={() => navigateToChapter(ch.id)}
                    className={`w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors relative group ${
                      isCurrent ? 'bg-primary/10' : ''
                    }`}
                  >
                    {isCurrent && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      </div>
                    )}
                    <p className={`text-[13px] ${isCurrent ? 'text-primary font-medium' : 'text-foreground'} ${!isCurrent && 'pl-3'}`}>
                      {ch.title ? `Bab ${ch.chapterNumber}: ${ch.title}` : `Bab ${ch.chapterNumber}`}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="p-3 text-center text-[11px] text-muted-foreground bg-muted/30">
              Klik chapter untuk membaca
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
