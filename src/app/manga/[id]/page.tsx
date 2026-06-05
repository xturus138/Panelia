"use client"

import { use, useEffect, useState, useCallback, useMemo } from 'react'
import { toggleInLibrary, isInLibrary } from '~/db/library'
import { sourceRegistry } from '~/services/sources'
import { db } from '~/db/db'
import type { Manga, Chapter, ReadStatus } from '~/types'
import { ArrowLeft, Library, Check, ChevronRight, Eye, EyeOff, BookOpen, Loader2 } from 'lucide-react'
import { MangaCover } from '~/components/common/MangaCover'
import { useReaderStore } from '~/stores/reader'
import { statusService } from '~/infrastructure/services'
import { useLiveQuery } from 'dexie-react-hooks'

export default function MangaDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = use(params)
  const id = decodeURIComponent(rawId)
  const [manga, setManga] = useState<Manga | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [inLib, setInLib] = useState(false)
  const [loading, setLoading] = useState(true)
  const [readerUrl, setReaderUrl] = useState<string | null>(null)
  const setReaderOpen = useReaderStore((s) => s.setReaderOpen)

  // Load library entry for last viewed info
  const libraryEntry = useLiveQuery(
    () => id ? db.libraryEntries.get(id) : undefined,
    [id]
  );

  const openReader = useCallback((chapterId: string) => {
    setReaderUrl(`/reader/${encodeURIComponent(chapterId)}?manga=${encodeURIComponent(id)}`);
    setReaderOpen(true);
  }, [id, setReaderOpen]);

  const closeReader = useCallback(() => {
    setReaderUrl(null);
    setReaderOpen(false);
  }, [setReaderOpen]);

  useEffect(() => {
    if (!readerUrl) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [readerUrl]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'panelia:close-reader') {
        closeReader();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [closeReader]);

  const handleReaderBackdrop = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) closeReader();
  }, [closeReader]);

  const handleReaderEscape = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') closeReader();
  }, [closeReader]);

  useEffect(() => {
    // Parse composite id
    // API sources:   "mangadex:abc123"  → sourceId="mangadex", mangaId="abc123"
    // Scrape sources:"scrape:preset-komiku:irnihh" → sourceId="scrape:preset-komiku", mangaId="irnihh"
    const parts = id.split(':')
    let sourceId: string, mangaId: string
    if (parts[0] === 'scrape') {
      sourceId = parts[0] + ':' + parts[1]   // "scrape:preset-komiku"
      mangaId = parts.slice(2).join(':')     // "irnihh"
    } else {
      sourceId = parts[0]                     // "mangadex"
      mangaId = parts.slice(1).join(':')      // "abc123"
    }

    // For scrape sources, we can load from DB without a live provider,
    // but try to rehydrate anyway for potential future features.
    const provider = sourceRegistry.getOrRehydrate(sourceId);

    console.log('MangaDetailsPage id:', id, 'sourceId:', sourceId, 'mangaId:', mangaId, 'provider:', !!provider);

    if (sourceId.startsWith('scrape')) {
      // Rehydrate user-defined sources if missing
      if (!provider) {
        db.scrapeSources.get(parts[1]).then(savedSource => {
          if (savedSource) {
            sourceRegistry.registerScrapeSource(savedSource.id, savedSource.config, savedSource.baseUrl);
          }
        });
      }
      setLoading(true)
      console.log('Looking up scrape manga in DB by id:', id);
      Promise.all([
        db.manga.get(id),
        db.chapters.where('mangaId').equals(id).toArray(),
        isInLibrary(id),
      ]).then(([m, c, l]) => {
        console.log('Scrape DB results - Manga:', !!m, 'Chapters:', c.length, 'InLib:', l);
        if (!m) {
          db.manga.toArray().then(all => {
            console.log('All manga in DB:', all.map(m => ({ id: m.id, title: m.title })));
          });
        }
        setManga((m as Manga) || null)
        const sortedScrapeChapters = (c as Chapter[]).sort((a, b) => b.chapterNumber - a.chapterNumber)
        setChapters(sortedScrapeChapters)
        setInLib(l)
        setLoading(false)
      }).catch((err) => {
        console.error('Error loading scrape manga:', err);
        setLoading(false)
      })
      return
    }

    if (!provider || !mangaId) {
      console.log('Provider or mangaId missing. Provider:', !!provider);
      setLoading(false)
      return
    }

    setLoading(true)
    Promise.all([
      provider.getMangaDetails(mangaId),
      provider.getChapters(mangaId),
      isInLibrary(id),
      db.chapters.where('mangaId').equals(id).toArray(),
    ]).then(([m, c, l, localChapters]) => {
      const localMap = new Map(localChapters.map(lc => [lc.id, lc]))
      setManga({ ...m, id, sourceId })
      const sortedChapters = c.sort((a, b) => b.chapterNumber - a.chapterNumber)
      setChapters(sortedChapters.map((ch) => {
        const local = localMap.get(ch.id)
        return {
          ...ch,
          mangaId: id,
          status: local?.status || 'unread',
          read: local?.read || false,
          lastReadPage: local?.lastReadPage || 0,
          viewedAt: local?.viewedAt,
          completedAt: local?.completedAt
        }
      }))
      setInLib(l)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [id])

  const [loadingChapterId, setLoadingChapterId] = useState<string | null>(null)

  const handleToggleLibrary = async () => {
    if (!manga) return
    const isNowInLib = await toggleInLibrary(manga, chapters)
    setInLib(isNowInLib)
  }

  const readCounts = useMemo(() => {
    const viewed = chapters.filter(ch => ch.status !== 'unread').length
    const completed = chapters.filter(ch => ch.status === 'completed').length
    return { viewed, completed, total: chapters.length }
  }, [chapters])

  const lastViewedChapter = useMemo(() => {
    if (!libraryEntry?.lastViewedChapterId) return null
    return chapters.find(ch => ch.id === libraryEntry.lastViewedChapterId) ?? null
  }, [libraryEntry, chapters])

  const toggleChapterStatus = async (chapterId: string, nextStatus: ReadStatus) => {
    if (!manga) return
    setLoadingChapterId(chapterId)
    await statusService.markChapterStatus(chapterId, id, nextStatus, nextStatus === 'unread' ? 0 : 0)
    const updated = await db.chapters.get(chapterId)
    if (updated) {
      setChapters(prev => prev.map(ch => ch.id === chapterId ? updated : ch))
    }
    setLoadingChapterId(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!manga) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <p className="text-muted-foreground">Manga not found</p>
        <button
          onClick={() => window.history.back()}
          className="text-sm text-primary hover:underline"
        >
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="pb-24">
      {/* Hero Header */}
      <div className="relative h-64 w-full">
        <MangaCover
          src={manga.coverUrl}
          alt={manga.title}
          aspectRatio="none"
          objectFit="cover"
          priority
          className="absolute inset-0 w-full h-full opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

        {/* Back Button */}
        <button
          onClick={() => window.history.back()}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Cover + Info */}
        <div className="absolute bottom-0 left-4 right-4 flex gap-4 translate-y-4">
          <MangaCover
            src={manga.coverUrl}
            alt={manga.title}
            aspectRatio="3/4"
            objectFit="cover"
            priority
            className="w-28 h-40 rounded-xl shadow-lg border border-background"
          />
          <div className="flex flex-col justify-end pb-2 flex-1">
            <h1 className="text-xl font-bold text-foreground leading-tight">{manga.title}</h1>
            {manga.author && (
              <p className="text-sm text-muted-foreground mt-1">{manga.author}</p>
            )}
            {manga.genres && manga.genres.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {manga.genres.slice(0, 3).map(genre => (
                  <span key={genre} className="text-[10px] font-medium bg-secondary px-2 py-1 rounded-full">
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-6">
        {/* Add to Library Button */}
        <button
          onClick={handleToggleLibrary}
          className={`w-full py-3.5 rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2 transition-all duration-150 mb-6 ${
            inLib
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'bg-primary text-primary-foreground'
          }`}
        >
          {inLib ? (
            <>
              <Check className="w-4 h-4" />
              In Library
            </>
          ) : (
            <>
              <Library className="w-4 h-4" />
              Add to Library
            </>
          )}
        </button>

        {/* Status Header */}
        {chapters.length > 0 && (
          <div className="bg-secondary/40 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="text-[13px] font-semibold">Reading Progress</span>
              </div>
              <span className="text-[12px] text-muted-foreground">
                {readCounts.completed} of {readCounts.total} read
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(readCounts.completed / readCounts.total) * 100}%` }}
              />
            </div>

            {lastViewedChapter && (
              <div className="flex items-center justify-between pt-1">
                <div className="flex flex-col">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-bold">Last Viewed</span>
                  <span className="text-[13px] font-medium truncate max-w-[180px]">
                    Chapter {lastViewedChapter.chapterNumber}
                  </span>
                </div>
                <button
                  onClick={() => openReader(lastViewedChapter.id)}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold hover:opacity-90"
                >
                  Continue
                </button>
              </div>
            )}

            {!lastViewedChapter && chapters.length > 0 && (
              <button
                onClick={() => openReader(chapters[chapters.length - 1].id)}
                className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold hover:opacity-90"
              >
                Start Reading
              </button>
            )}
          </div>
        )}

        {/* Description */}
        {manga.description && (
          <div className="mb-6">
            <p className="text-sm text-muted-foreground leading-relaxed">{manga.description}</p>
          </div>
        )}

        {/* Chapters Section */}
        <div className="mb-4">
          <h2 className="text-lg font-bold text-foreground">
            {chapters.length} Chapters
          </h2>
        </div>

        <div className="flex flex-col gap-2">
          {chapters.map(ch => {
            const status = ch.status || 'unread';
            const isUnread = status === 'unread';
            const isCompleted = status === 'completed';
            const isLastViewed = libraryEntry?.lastViewedChapterId === ch.id;

            return (
              <div
                key={ch.id}
                className={`rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all w-full text-left ${
                  isLastViewed
                    ? 'bg-primary/10 border border-primary/30'
                    : isCompleted
                    ? 'bg-card/60 opacity-70'
                    : isUnread
                    ? 'bg-card ring-1 ring-primary/10'
                    : 'bg-card'
                }`}
              >
                <button
                  type="button"
                  onClick={() => openReader(ch.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-center gap-2">
                    {isUnread && !isLastViewed && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    )}
                    <p className={`font-medium text-[14px] truncate ${
                      isCompleted ? 'text-muted-foreground line-through' : 'text-card-foreground'
                    }`}>
                      Chapter {ch.chapterNumber}: {ch.title}
                    </p>
                  </div>
                  {ch.releaseDate && (
                    <p className="text-[12px] text-muted-foreground mt-1">{ch.releaseDate}</p>
                  )}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={loadingChapterId === ch.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleChapterStatus(ch.id, isUnread ? 'completed' : 'unread');
                    }}
                    className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-50"
                    title={isUnread ? 'Mark as read' : 'Mark as unread'}
                  >
                    {loadingChapterId === ch.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isUnread ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => openReader(ch.id)}
                    className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                    title="Read chapter"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {readerUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black"
          onClick={handleReaderBackdrop}
          onKeyDown={handleReaderEscape}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`Reader - ${manga?.title || 'Manga'}`}
        >
          <div className="absolute inset-0 flex flex-col bg-black">
            <div className="flex items-center justify-between px-3 py-2.5 bg-black/85 text-white border-b border-white/10">
              <div className="min-w-0">
                <p className="text-[12px] text-white/60">Reader</p>
                <p className="text-[14px] font-medium truncate">{manga?.title || 'Manga'}</p>
              </div>
              <button
                type="button"
                onClick={closeReader}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[12px]"
              >
                Close
              </button>
            </div>
            <iframe
              title={`Reader - ${manga?.title || 'Manga'}`}
              src={readerUrl}
              className="flex-1 w-full border-0"
              allow="fullscreen"
            />
          </div>
        </div>
      )}
    </div>
  )
}