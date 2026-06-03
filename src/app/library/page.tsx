"use client"

import { useLibrary } from '~/hooks/useLibrary'
import { MangaCard } from '~/components/library/MangaCard'
import { Search } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '~/db/db'

export default function LibraryPage() {
  const { libraryEntries, mangaList } = useLibrary()

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
        <button className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
          <Search className="w-4 h-4 text-muted-foreground" />
        </button>
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
        <div className="grid grid-cols-2 gap-4">
          {mangaList.map(manga => (
            <MangaCard
              key={manga.id}
              manga={manga}
              chapterCount={chapterCounts?.[manga.id]}
            />
          ))}
        </div>
      )}
    </div>
  )
}