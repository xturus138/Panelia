"use client"

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '~/db/db'
import { Download, Trash2, ChevronRight, FileText } from 'lucide-react'

export default function DownloadsPage() {
  const downloadedChapters = useLiveQuery(() =>
    db.downloadedChapters.orderBy('downloadedAt').reverse().toArray()
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
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <div className="text-4xl mb-4">
            <Download className="w-12 h-12 text-muted-foreground/50" />
          </div>
          <h2 className="text-lg font-semibold mb-2">No downloads yet</h2>
          <p className="text-muted-foreground text-sm">
            Download chapters to read offline
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {downloadedWithManga.map((dc) => (
            <div
              key={dc.id}
              className="bg-card rounded-xl p-4 shadow-sm flex items-center gap-3"
            >
              {/* Thumbnail */}
              {dc.manga?.coverUrl && (
                <div className="w-12 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dc.manga.coverUrl}
                    alt={dc.manga.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[14px] text-card-foreground truncate">
                  {dc.manga?.title || 'Unknown Manga'}
                </p>
                <p className="text-[12px] text-muted-foreground flex items-center gap-1 mt-1">
                  <FileText className="w-3 h-3" />
                  Chapter {dc.chapterId.split('-').pop()}
                </p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  {(dc.sizeBytes / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    if (confirm('Delete this download?')) {
                      await db.downloadedChapters.delete(dc.id)
                    }
                  }}
                  className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}