'use client'

import { useCallback, useEffect, useState } from 'react'
import { extensionService } from '~/services/extensions'
import { sourceRegistry } from '~/services/sources'
import { MangaCard } from '~/components/library/MangaCard'
import { Search } from 'lucide-react'
import type { Manga, Source } from '~/types'

export default function BrowsePage() {
  const [sources, setSources] = useState<Source[]>([])
  const [activeSource, setActiveSource] = useState<Source | null>(null)
  const [manga, setManga] = useState<Manga[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSources = useCallback(async () => {
    try {
      setLoading(true)
      const data = await extensionService.getSources()
      setSources(data)
      if (data.length > 0) {
        setActiveSource(data[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sources')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadManga = useCallback(async () => {
    if (!activeSource) return
    try {
      setLoading(true)
      const provider = sourceRegistry.get(activeSource.id)
      const data = await provider.getPopular(0)
      setManga(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load manga')
    } finally {
      setLoading(false)
    }
  }, [activeSource])

  useEffect(() => {
    loadSources()
  }, [loadSources])

  useEffect(() => {
    if (activeSource) {
      loadManga()
    }
  }, [activeSource, loadManga])

  if (loading && sources.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading sources...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-6">
        <p className="text-destructive text-center">{error}</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-foreground leading-tight">Browse</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Discover new manga to read
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-secondary rounded-xl px-4 py-3 flex items-center gap-3 mb-6">
        <Search className="w-4 h-4 text-muted-foreground" />
        <span className="text-[15px] text-muted-foreground">Search manga...</span>
      </div>

      {/* Source Selector */}
      {sources.length > 0 && (
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {sources.map(source => (
              <button
                key={source.id}
                onClick={() => setActiveSource(source)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                  activeSource?.id === source.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {source.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Manga Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <p className="text-muted-foreground">Loading manga...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {manga.map(m => (
            <MangaCard key={m.id} manga={m} />
          ))}
        </div>
      )}
    </div>
  )
}