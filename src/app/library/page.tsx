"use client"

import { useLibrary } from '~/hooks/useLibrary'
import { MangaCard } from '~/components/library/MangaCard'
import { Search, RefreshCw, Loader2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '~/db/db'
import { useState, useCallback } from 'react'
import { syncChapters } from '~/db/sync'
import { useToast } from '~/hooks/useToast'

export default function LibraryPage() {
  const { libraryEntries, mangaList } = useLibrary()
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set())
  const [refreshAllLoading, setRefreshAllLoading] = useState(false)
  const toast = useToast()

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
            {mangaList.length} manga in collection
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
      <div className="bg-secondary rounded-xl px-4 py-3 flex items-center gap-3 mb-6">
        <Search className="w-4 h-4 text-muted-foreground" />
        <span className="text-[15px] text-muted-foreground">Search manga...</span>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {mangaList.map(manga => (
            <MangaCard
              key={manga.id}
              manga={manga}
              chapterCount={chapterCounts?.[manga.id]}
              onRefresh={handleRefresh}
              refreshing={refreshingIds.has(manga.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}