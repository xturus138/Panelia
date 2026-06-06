"use client"

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '~/db/db'
import { Download, Trash2, FileText } from 'lucide-react'
import { EmptyState } from '~/components/common/EmptyState'
import Link from 'next/link'

export default function DownloadsPage() {
  const downloadedChapters = useLiveQuery(() =>
    db.downloadedChapters.toArray()
  )

  // Get manga info for each downloaded chapter
  const downloadedWithManga = useLiveQuery(async () => {
    if (!downloadedChapters) return []
    const result = []
    for (const dc of downloadedChapters) {
      const manga = await db.manga.get(dc.mangaId)
      result.push({ ...dc, manga })
    }
    return result
  }, [downloadedChapters])

  if (downloadedWithManga === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-foreground leading-tight">Downloads</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          {downloadedWithManga.length} downloaded chapters
        </p>
      </div>

      {/* Downloads List */}
      {downloadedWithManga.length === 0 ? (
        <EmptyState
          icon={Download}
          title="No downloads yet"
          description="Download chapters from manga details to read offline"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {downloadedWithManga.map((dc) => (
            <div
              key={dc.id}
              className="bg-card rounded-xl p-4 shadow-sm flex items-center gap-3 relative group"
            >
              <Link href={`/reader/${encodeURIComponent(dc.chapterId)}`} className="absolute inset-0 z-0" />
              {/* Thumbnail */}
              {dc.manga?.coverUrl && (
                <div className="w-12 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative z-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dc.manga.coverUrl}
                    alt={dc.manga.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0 relative z-10">
                <p className="font-medium text-[14px] text-card-foreground truncate">
                  {dc.manga?.title || 'Unknown Manga'}
                </p>
                <p className="text-[12px] text-muted-foreground flex items-center gap-1 mt-1">
                  <FileText className="w-3 h-3" />
                  Chapter {dc.chapterId.split(':').pop()?.replace('ch', '')}
                </p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  {(dc.sizeBytes / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 relative z-10">
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    if (confirm('Delete this download?')) {
                      await db.downloadedChapters.delete(dc.id)
                    }
                  }}
                  className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}