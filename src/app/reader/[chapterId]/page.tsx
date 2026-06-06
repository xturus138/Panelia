"use client";

import { use, useEffect, useRef, useState } from 'react';
import { useReaderChapterViewModel, type ReadingMode } from '~/presentation/hooks/use-reader-chapter';
import { useToast } from '~/hooks/useToast';
import { useSettingsStore } from '~/presentation/stores';
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
  Download,
} from 'lucide-react';
import { downloadManager } from '~/services/downloads/download-manager';


const PageSkeleton = () => (
  <div className="w-full h-screen bg-gradient-to-b from-slate-800 to-slate-900 animate-pulse flex items-center justify-center">
    <div className="text-white/40 text-sm">Loading page...</div>
  </div>
);


export default function ReaderPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId: rawChapterId } = use(params);
  const chapterId = decodeURIComponent(rawChapterId);
  const toast = useToast();

  const {
    pages,
    controlsVisible,
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
  } = useReaderChapterViewModel(chapterId, toast);

  const { brightness, readingDirection, pageFitMode } = useSettingsStore();

  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    void downloadManager.isChapterDownloaded(chapterId).then(setDownloaded);
  }, [chapterId]);

  const handleDownload = async () => {
    if (downloading || downloaded) return;
    setDownloading(true);
    const t = toast.loading('Downloading chapter...');
    try {
      await downloadManager.downloadChapter(chapterId);
      setDownloaded(true);
      t.dismiss();
      toast.success('Chapter downloaded for offline reading');
    } catch (err) {
      t.dismiss();
      toast.error('Failed to download: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDownloading(false);
    }
  };


  useEffect(() => {
    if (!showModeMenu) return;
    const handler = (e: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setShowModeMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModeMenu, modeMenuRef, setShowModeMenu]);

  const goToPrevPage = () => {
    if (readingDirection === 'rtl') {
      setCurrentPageIndex((i) => Math.min(pages.length - 1, i + 1));
    } else {
      setCurrentPageIndex((i) => Math.max(0, i - 1));
    }
  };
  const goToNextPage = () => {
    if (readingDirection === 'rtl') {
      setCurrentPageIndex((i) => Math.max(0, i - 1));
    } else {
      setCurrentPageIndex((i) => Math.min(pages.length - 1, i + 1));
    }
  };

  // Swipe gesture support for horizontal-swipe mode
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const lastTapRef = useRef(0);
  const [zoomed, setZoomed] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const now = Date.now();
    const doubleTap = now - lastTapRef.current < 300;
    lastTapRef.current = now;
    if (doubleTap && readingMode === 'single-page') {
      setZoomed((v) => !v);
      touchStartX.current = null;
      touchEndX.current = null;
      return;
    }
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        goToNextPage();
      } else {
        goToPrevPage();
      }
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const imageClass = zoomed
    ? 'z-0 max-h-none max-w-none w-auto h-auto object-contain scale-150'
    : 'z-0 ' +
      (pageFitMode === 'fit-width'
        ? 'w-full h-full object-contain'
        : pageFitMode === 'fit-height'
        ? 'max-h-full object-contain'
        : pageFitMode === 'fill'
        ? 'w-full h-full object-cover'
        : 'max-h-full max-w-full object-contain');

  useEffect(() => {
    if (readingMode !== 'single-page' && readingMode !== 'horizontal-swipe') return;
    const next = pages[currentPageIndex + 1];
    const prev = pages[currentPageIndex - 1];
    [next, prev].forEach((page) => {
      if (!page) return;
      const img = new Image();
      img.src = page.imageUrl;
    });
  }, [currentPageIndex, pages, readingMode]);

  useEffect(() => {
    setZoomed(false);
  }, [chapterId, readingMode]);

  const [pageLoadStates, setPageLoadStates] = useState<Record<number, 'loading' | 'loaded' | 'error'>>({});

  useEffect(() => {
    console.log('[Reader] pageLoadStates changed:', JSON.stringify(pageLoadStates));
  }, [pageLoadStates]);

  const handlePageLoad = (index: number) => {
    console.log(`[Reader] handlePageLoad called for page ${index}`);
    setPageLoadStates((prev) => ({ ...prev, [index]: 'loaded' }));
  };

  const handlePageError = (index: number) => {
    console.log(`[Reader] handlePageError called for page ${index}`);
    setPageLoadStates((prev) => ({ ...prev, [index]: 'error' }));
  };

  function renderPages() {
    console.log(`[Reader] renderPages: readingMode=${readingMode}, pages.length=${pages.length}, currentPageIndex=${currentPageIndex}, pageLoadStates=`, JSON.stringify(pageLoadStates));
    if (readingMode === 'single-page' || readingMode === 'horizontal-swipe') {
      const page = pages[currentPageIndex];
      if (!page) return null;
      const pageState = pageLoadStates[currentPageIndex] || 'loading';
      console.log(`[Reader] renderPages single-page: page=${page.index}, imageUrl=${page.imageUrl.slice(0, 80)}..., pageState=${pageState}`);
      return (
        <div className={`flex-1 flex items-center justify-center relative select-none ${zoomed ? 'overflow-auto' : ''}`}>
          <div className="absolute inset-0 flex z-10">
            <div className="w-1/3 h-full cursor-pointer" onClick={(e) => { e.stopPropagation(); goToPrevPage(); }} />
            <div className="w-1/3 h-full cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleControls(); }} />
            <div className="w-1/3 h-full cursor-pointer" onClick={(e) => { e.stopPropagation(); goToNextPage(); }} />
          </div>
          {pageState === 'loading' && <PageSkeleton />}
          {pageState === 'error' && (
            <div className="flex flex-col items-center justify-center gap-3">
              <AlertCircle className="w-10 h-10 text-destructive" />
              <p className="text-white/60 text-sm">Failed to load page</p>
            </div>
          )}
          {pageState !== 'error' && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={page.imageUrl}
                alt={`Page ${page.index + 1}`}
                className={imageClass}
                onLoad={() => handlePageLoad(currentPageIndex)}
                onError={(e) => { console.log(`[Reader] img onError for page ${currentPageIndex}:`, e); handlePageError(currentPageIndex); }}
              />
            </>
          )}
        </div>
      );
    }

    const gap = readingMode === 'webtoon' ? '' : 'gap-2';
    return (
      <div className={`flex flex-col ${gap} w-full max-w-3xl mx-auto`}>
        {pages.map((page) => {
          const pageState = pageLoadStates[page.index] || 'loading';
          return (
            <div key={page.index} className="relative w-full">
              {pageState === 'loading' && <PageSkeleton />}
              {pageState === 'error' && (
                <div className="w-full h-screen flex flex-col items-center justify-center bg-slate-900 gap-2">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                  <p className="text-white/60 text-xs">Page {page.index + 1} failed to load</p>
                </div>
              )}
              {pageState !== 'error' && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={page.index}
                    src={page.imageUrl}
                    alt={`Page ${page.index + 1}`}
                    className="w-full object-contain"
                    loading="lazy"
                    onLoad={() => handlePageLoad(page.index)}
                    onError={(e) => { console.log(`[Reader] img onError for page ${page.index}:`, e); handlePageError(page.index); }}
                      />
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col">
      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto ${readingMode === 'webtoon' ? '' : readingMode === 'vertical-scroll' ? 'px-0' : ''}`}
        style={{ filter: `brightness(${brightness}%)` }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('button, a, select, .click-zone, .mode-menu')) return;
          if (readingMode === 'single-page' || readingMode === 'horizontal-swipe') return;
          toggleControls();
        }}
        onTouchStart={readingMode === 'horizontal-swipe' ? handleTouchStart : undefined}
        onTouchMove={readingMode === 'horizontal-swipe' ? handleTouchMove : undefined}
        onTouchEnd={readingMode === 'horizontal-swipe' ? handleTouchEnd : undefined}
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
                  onClick={(e) => { e.stopPropagation(); loadScrapeChapter(); }}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium flex items-center gap-2 hover:bg-primary/90"
                >
                  <RefreshCw className="w-4 h-4" />
                  Coba Lagi
                </button>
                <button onClick={handleBack} className="px-4 py-2 rounded-lg bg-white/10 text-white text-[13px] font-medium hover:bg-white/20">
                  Kembali
                </button>
              </div>
            </div>
          </div>
        )}
        {pages.length > 0 && renderPages()}
      </div>

      {controlsVisible && (
        <>
          <div className="fixed top-0 left-0 right-0 bg-black/85 backdrop-blur-sm text-white z-20">
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <button onClick={handleBack} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex-shrink-0 text-[12px]" aria-label="Kembali">
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Kembali</span>
                </button>
                {mangaInfo && <span className="text-[13px] font-medium truncate">{mangaInfo.title}</span>}
              </div>

              <div className="flex items-center gap-1">
                <div ref={modeMenuRef} className="relative mode-menu">
                  <button onClick={(e) => { e.stopPropagation(); setShowModeMenu((v) => !v); }} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-[12px]" aria-label="Mode Baca">
                    <Layout className="w-4 h-4" />
                    <span className="hidden sm:inline">Mode</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showModeMenu && (
                    <div className="absolute top-full right-0 mt-1 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[180px] z-30">
                      {(['vertical-scroll', 'webtoon', 'single-page', 'horizontal-swipe'] as ReadingMode[]).map((mode) => {
                        const icons: Record<ReadingMode, typeof ScrollText> = { 'vertical-scroll': ScrollText, 'webtoon': Smartphone, 'single-page': FileText, 'horizontal-swipe': GalleryHorizontal };
                        const labels: Record<ReadingMode, string> = { 'vertical-scroll': 'Scroll Vertikal', 'webtoon': 'Webtoon', 'single-page': 'Halaman Tunggal', 'horizontal-swipe': 'Geser Horizontal' };
                        const Icon = icons[mode];
                        return (
                          <button key={mode} onClick={(e) => { e.stopPropagation(); setReadingMode(mode); }} className={`w-full px-3 py-2.5 text-left text-[13px] flex items-center gap-2.5 ${readingMode === mode ? 'text-primary bg-primary/10' : 'text-foreground hover:bg-muted'}`}>
                            <Icon className="w-4 h-4" />
                            {labels[mode]}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                  disabled={downloading || downloaded}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-colors ${downloaded ? 'text-green-400 bg-green-500/10' : 'hover:bg-white/10 text-white'}`}
                  aria-label="Download"
                >
                  {downloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : downloaded ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">{downloaded ? 'Downloaded' : 'Download'}</span>
                </button>

                {mangaInfo && mangaInfo.chapters.length > 0 && (
                  <button onClick={(e) => { e.stopPropagation(); setShowChapterList(true); }} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-[12px]" aria-label="Daftar Chapter">
                    <List className="w-4 h-4" />
                    <span className="hidden sm:inline">Chapter</span>
                  </button>
                )}

                {mangaInfo?.sourceUrl && (
                  <a href={mangaInfo.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-[12px]" aria-label="Buka di Browser">
                    <ExternalLink className="w-4 h-4" />
                    <span className="hidden sm:inline">Buka</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-black/85 backdrop-blur-sm text-white z-20">
            {(readingMode === 'single-page' || readingMode === 'horizontal-swipe') && pages.length > 1 && (
              <div className="px-4 py-1">
                <input type="range" min={0} max={pages.length - 1} value={currentPageIndex} onChange={(e) => { e.stopPropagation(); setCurrentPageIndex(Number(e.target.value)); }} className="w-full h-1 appearance-none bg-white/20 rounded-full cursor-pointer accent-primary" aria-label="Page slider" />
              </div>
            )}

            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-1">
                {mangaInfo?.chapters && (() => {
                  const ci = mangaInfo.chapters.findIndex((ch) => ch.id === chapterId);
                  const prev = ci > 0 ? mangaInfo.chapters[ci - 1] : null;
                  return prev ? (
                    <button onClick={(e) => { e.stopPropagation(); navigateToChapter(prev.id); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[12px] font-medium">
                      <ArrowLeftCircle className="w-4 h-4" />
                      <span>Sebelumnya</span>
                    </button>
                  ) : <div className="w-24" />;
                })()}
              </div>

              <div className="text-[12px] text-white/70 flex items-center gap-2">
                {(readingMode === 'single-page' || readingMode === 'horizontal-swipe') ? (
                  <span className="px-2 py-1 bg-white/10 rounded text-white/80">Halaman {currentPageIndex + 1} / {pages.length}</span>
                ) : (
                  <span className="px-2 py-1 bg-white/10 rounded text-white/80">{pages.length} Halaman</span>
                )}

                {mangaInfo && !savedInLib && !saving && (
                  <button onClick={(e) => { e.stopPropagation(); handleSaveToLibrary(); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90">
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

              <div className="flex items-center gap-1">
                {mangaInfo?.chapters && (() => {
                  const ci = mangaInfo.chapters.findIndex((ch) => ch.id === chapterId);
                  const next = ci >= 0 && ci < mangaInfo.chapters.length - 1 ? mangaInfo.chapters[ci + 1] : null;
                  return next ? (
                    <button onClick={(e) => { e.stopPropagation(); navigateToChapter(next.id); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[12px] font-medium">
                      <span>Selanjutnya</span>
                      <ArrowRightCircle className="w-4 h-4" />
                    </button>
                  ) : <div className="w-24" />;
                })()}
              </div>
            </div>
          </div>
        </>
      )}

      {showChapterList && mangaInfo && (
        <div className="fixed inset-0 bg-black/60 z-30" onClick={(e) => { e.stopPropagation(); setShowChapterList(false); }}>
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-card shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border flex items-center justify-between bg-card/50">
              <h3 className="font-semibold text-foreground text-[14px]">{mangaInfo.chapters.length} Chapter</h3>
              <button onClick={() => setShowChapterList(false)} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground" aria-label="Tutup">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="divide-y divide-border">
              {mangaInfo.chapters.map((ch) => {
                const isCurrent = ch.id === chapterId;
                return (
                  <button key={ch.id} onClick={() => navigateToChapter(ch.id)} className={`w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors relative group ${isCurrent ? 'bg-primary/10' : ''}`}>
                    {isCurrent && <div className="absolute left-3 top-1/2 -translate-y-1/2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /></div>}
                    <p className={`text-[13px] ${isCurrent ? 'text-primary font-medium' : 'text-foreground'} ${!isCurrent && 'pl-3'}`}>
                      {ch.title ? `Bab ${ch.chapterNumber}: ${ch.title}` : `Bab ${ch.chapterNumber}`}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="p-3 text-center text-[11px] text-muted-foreground bg-muted/30">Klik chapter untuk membaca</div>
          </div>
        </div>
      )}
    </div>
  );
}