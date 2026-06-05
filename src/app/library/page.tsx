"use client"

import { useLibrary } from '~/hooks/useLibrary'
import { MangaCard } from '~/components/library/MangaCard'
import { Search, RefreshCw, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '~/db/db'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { syncChapters } from '~/db/sync'
import { useToast } from '~/hooks/useToast'

const PAGE_SIZE = 24

export default function LibraryPage() {
  const { libraryEntries, mangaList } = useLibrary()
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set())
  const [refreshAllLoading, setRefreshAllLoading] = useState(false)
  const [page, setPage] = useState(1)
  const toast = useToast()

  const [searchQuery, setSearchQuery] = useState('')

  const filteredManga = useMemo(() => {
    if (!mangaList) return []
    if (!searchQuery.trim()) return mangaList
    const q = searchQuery.toLowerCase()
    return mangaList.filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.genres?.some(g => g.toLowerCase().includes(q))
    )
  }, [mangaList, searchQuery])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((filteredManga?.length ?? 0) / PAGE_SIZE)),
    [filteredManga]
  )

  // Reset to last page if the library shrinks past the current page
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pagedManga = useMemo(
    () => (filteredManga ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredManga, page]
  )

  const pageNumbers = useMemo(() => {
    const pages: (number | '…')[] = []
    const window = 1
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= page - window && p <= page + window)) {
        pages.push(p)
      } else if (pages[pages.length - 1] !== '…') {
        pages.push('…')
      }
    }
    return pages
  }, [page, totalPages])

  const handleRefresh = useCallback(async (mangaId: string, silent = false) => {
    setRefreshingIds(prev => new Set(prev).add(mangaId))
    try {
      await syncChapters(mangaId)
      if (!silent) toast.success('Chapters updated')
    } catch (err) {
      console.error(`Failed to sync ${mangaId}:`, err)
      if (!silent) toast.error('Failed to sync chapters')
    } finally {
      setRefreshingIds(prev => {
        const next = new Set(prev)
        next.delete(mangaId)
        return next
      })
    }
  }, [toast])

  const handleRefreshAll = useCallback(async () => {
    if (!mangaList || mangaList.length === 0) return
    setRefreshAllLoading(true)
    const t = toast.loading(`Refreshing ${mangaList.length} manga...`)
    try {
      // Sync in parallel with small limit or sequential? sequential for now to avoid rate limits
      for (const manga of mangaList) {
        await handleRefresh(manga.id, true)
      }
      t.dismiss()
      toast.success('All chapters updated')
    } catch (err) {
      t.dismiss()
      toast.error('Some updates failed')
    } finally {
      setRefreshAllLoading(false)
    }
  }, [mangaList, handleRefresh, toast])

  // Get chapter counts for each manga
  const chapterCounts = useLiveQuery(async () => {
    if (!libraryEntries) return {}
    const counts: Record<string, number> = {}
    for (const entry of libraryEntries) {
      const count = await db.chapters.where('mangaId').equals(entry.mangaId).count()
      counts[entry.mangaId] = count
    }
    return counts
  }, [libraryEntries])

  if (mangaList === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-bold text-foreground leading-tight">Library</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {mangaList.length === 0
              ? 'No manga'
              : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(
                  page * PAGE_SIZE,
                  mangaList.length
                )} of ${mangaList.length}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshAll}
            disabled={refreshAllLoading}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center disabled:opacity-50"
            title="Refresh All"
          >
            {refreshAllLoading ? (
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          <button className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
            <Search className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search manga in library..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-secondary rounded-xl pl-11 pr-4 py-3 text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Manga Grid */}
      {mangaList.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <div className="text-4xl mb-4">📚</div>
          <h2 className="text-lg font-semibold mb-2">Your library is empty</h2>
          <p className="text-muted-foreground text-sm">
            Go to Browse to add manga to your collection
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {pagedManga.map(manga => {
              const entry = libraryEntries?.find(e => e.mangaId === manga.id)
              return (
                <MangaCard
                  key={manga.id}
                  manga={manga}
                  chapterCount={chapterCounts?.[manga.id]}
                  unreadCount={entry?.unreadCount}
                  lastViewedAt={entry?.lastViewedAt}
                  onRefresh={handleRefresh}
                  refreshing={refreshingIds.has(manga.id)}
                />
              )
            })}
          </div>

          {totalPages > 1 && (
            <nav
              className="flex items-center justify-center gap-1 mt-6"
              aria-label="Library pagination"
            >
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {pageNumbers.map((p, i) =>
                p === '…' ? (
                  <span
                    key={`gap-${i}`}
                    className="w-9 h-9 flex items-center justify-center text-muted-foreground"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    aria-current={p === page ? 'page' : undefined}
                    className={`min-w-9 h-9 px-3 rounded-lg text-sm font-medium transition-colors ${
                      p === page
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}