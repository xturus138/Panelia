"use client"

import { useLibrary } from '~/hooks/useLibrary'
import { MangaCard } from '~/components/library/MangaCard'
import { Search, RefreshCw, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '~/db/db'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { syncChapters } from '~/db/sync'
import { useToast } from '~/hooks/useToast'
import { useSettingsStore, useLibraryStore } from '~/presentation/stores'
import { LayoutGrid, List, ArrowUpDown, Folder } from 'lucide-react'
import { EmptyState } from '~/components/common/EmptyState'
import type { LibrarySortMode } from '~/presentation/stores/library-store'
import Link from 'next/link'

const PAGE_SIZE = 24

export default function LibraryPage() {
  const { libraryEntries, mangaList } = useLibrary()
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set())
  const [refreshAllLoading, setRefreshAllLoading] = useState(false)
  const [page, setPage] = useState(1)
  const toast = useToast()
  const { libraryViewMode, updateSettings } = useSettingsStore()
  const { sortMode, setSortMode, activeCategoryId, setActiveCategory } = useLibraryStore()

  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray())

  const [searchQuery, setSearchQuery] = useState('')
  const [showSortMenu, setShowSortMenu] = useState(false)

  const sortOptions: { value: LibrarySortMode; label: string }[] = [
    { value: 'last-read', label: 'Last Read' },
    { value: 'added', label: 'Recently Added' },
    { value: 'alphabetical', label: 'Alphabetical' },
    { value: 'unread', label: 'Unread First' },
  ]

  const filteredManga = useMemo(() => {
    if (!mangaList) return []
    let result = mangaList;
    const q = searchQuery.toLowerCase();
    if (q) {
      result = result.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.genres?.some(g => g.toLowerCase().includes(q))
      );
    }
    if (activeCategoryId) {
      const entryMap = new Map((libraryEntries ?? []).map(e => [e.mangaId, e]));
      result = result.filter((m) => entryMap.get(m.id)?.categories.includes(activeCategoryId));
    }
    // Apply sort
    const entryMap = new Map((libraryEntries ?? []).map(e => [e.mangaId, e]));
    return [...result].sort((a, b) => {
      const aEntry = entryMap.get(a.id);
      const bEntry = entryMap.get(b.id);
      if (sortMode === 'last-read') {
        const aDate = aEntry?.lastViewedAt ?? '';
        const bDate = bEntry?.lastViewedAt ?? '';
        return bDate.localeCompare(aDate);
      }
      if (sortMode === 'added') {
        const aDate = aEntry?.dateAdded ?? '';
        const bDate = bEntry?.dateAdded ?? '';
        return bDate.localeCompare(aDate);
      }
      if (sortMode === 'alphabetical') {
        return a.title.localeCompare(b.title);
      }
      if (sortMode === 'unread') {
        const aUnread = aEntry?.unreadCount ?? 0;
        const bUnread = bEntry?.unreadCount ?? 0;
        return bUnread - aUnread;
      }
      return 0;
    });
  }, [mangaList, libraryEntries, searchQuery, sortMode])

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
          <button
            onClick={() => updateSettings({ libraryViewMode: libraryViewMode === 'grid' ? 'list' : 'grid' })}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center"
            title={libraryViewMode === 'grid' ? 'Switch to List View' : 'Switch to Grid View'}
          >
            {libraryViewMode === 'grid' ? (
              <List className="w-4 h-4 text-muted-foreground" />
            ) : (
              <LayoutGrid className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowSortMenu((v) => !v)}
              className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center"
              title="Sort Library"
            >
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            </button>
            {showSortMenu && (
              <div className="absolute top-full right-0 mt-1 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px] z-30">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortMode(opt.value); setShowSortMenu(false); }}
                    className={`w-full px-3 py-2 text-left text-[13px] ${sortMode === opt.value ? 'text-primary bg-primary/10' : 'text-foreground hover:bg-muted'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
            <Search className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search manga in library..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-secondary rounded-xl pl-11 pr-4 py-3 text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveCategory(null)}
          className={`rounded-full px-3 py-1.5 text-[12px] font-medium whitespace-nowrap ${activeCategoryId === null ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
        >
          All
        </button>
        {(categories ?? []).map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-medium whitespace-nowrap flex items-center gap-1 ${activeCategoryId === cat.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
          >
            <Folder className="w-3.5 h-3.5" />
            {cat.name}
          </button>
        ))}
        <Link href="/categories" className="rounded-full px-3 py-1.5 text-[12px] font-medium whitespace-nowrap bg-secondary text-secondary-foreground">
          Manage
        </Link>
      </div>

      {/* Manga Grid */}
      {mangaList.length === 0 ? (
        <EmptyState
          title="Your library is empty"
          description="Go to Browse to add manga to your collection"
        />
      ) : (
        <>
          {libraryViewMode === 'grid' ? (
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
          ) : (
            <div className="flex flex-col gap-3">
              {pagedManga.map(manga => {
                const entry = libraryEntries?.find(e => e.mangaId === manga.id)
                return (
                  <div
                    key={manga.id}
                    className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-sm"
                  >
                    <div className="w-14 shrink-0 overflow-hidden rounded-lg">
                      <MangaCard
                        manga={manga}
                        chapterCount={chapterCounts?.[manga.id]}
                        unreadCount={entry?.unreadCount}
                        lastViewedAt={entry?.lastViewedAt}
                        onRefresh={handleRefresh}
                        refreshing={refreshingIds.has(manga.id)}
                        className="shadow-none hover:shadow-none hover:scale-100"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[15px] font-semibold text-foreground">{manga.title}</h3>
                      <p className="mt-1 text-[12px] text-muted-foreground truncate">
                        {manga.genres?.length ? manga.genres.slice(0, 3).join(' • ') : 'No genres'}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">
                        {entry?.unreadCount ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                            {entry.unreadCount} unread
                          </span>
                        ) : (
                          <span className="rounded-full bg-secondary px-2 py-0.5">All read</span>
                        )}
                        {chapterCounts?.[manga.id] ? <span>{chapterCounts[manga.id]} ch</span> : null}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

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