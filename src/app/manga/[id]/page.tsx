"use client"

import { use, useEffect, useCallback } from 'react'
import { useMangaDetailsViewModel } from '~/presentation/hooks'
import { ArrowLeft, Library, Check, ChevronRight, Eye, EyeOff, BookOpen, Loader2 } from 'lucide-react'
import { MangaCover } from '~/components/common/MangaCover'

export default function MangaDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = use(params)
  const id = decodeURIComponent(rawId)
  const {
    manga,
    chapters,
    inLib,
    loading,
    readerUrl,
    loadingChapterId,
    libraryEntry,
    readCounts,
    lastViewedChapter,
    openReader,
    closeReader,
    handleToggleLibrary,
    toggleChapterStatus,
  } = useMangaDetailsViewModel(id)

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