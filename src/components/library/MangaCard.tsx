"use client"

import Link from "next/link"
import { useState, useRef, useEffect, useMemo } from "react"
import type { Manga } from "~/types"
import { cn } from "~/lib/utils"
import { Trash2, MoreVertical, RefreshCw, Clock } from "lucide-react"
import { removeFromLibrary } from "~/infrastructure/db/library"
import { MangaCover } from "~/components/common/MangaCover"
import { useAuth } from '~/lib/auth-context'

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return "Just now"
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays}d ago`
  return date.toLocaleDateString()
}

interface MangaCardProps {
  manga: Manga
  className?: string
  chapterCount?: number
  unreadCount?: number
  lastViewedAt?: string
  sourceId?: string
  onDeleted?: (mangaId: string) => void
  onRefresh?: (mangaId: string) => void | Promise<void>
  refreshing?: boolean
}

export function MangaCard({ manga, className, chapterCount, unreadCount, lastViewedAt, sourceId, onDeleted, onRefresh, refreshing }: MangaCardProps) {
  const { uid } = useAuth();
  // Append sourceId to URL for multi-source support
  const href = sourceId ? `/manga/${sourceId}:${manga.id}` : `/manga/${manga.id}`
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const lastReadText = useMemo(() => {
    if (!lastViewedAt) return null;
    return formatRelativeTime(lastViewedAt);
  }, [lastViewedAt]);

  const displayUnread = unreadCount ?? 0;

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [menuOpen])

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (deleting) return
    setDeleting(true)
    try {
      if (!uid) return;
      await removeFromLibrary(uid, manga.id)
      onDeleted?.(manga.id)
    } catch (err) {
      console.error("Failed to delete manga:", err)
    } finally {
      setDeleting(false)
      setConfirmOpen(false)
      setMenuOpen(false)
    }
  }

  return (
    <div
      className={cn(
        "group relative bg-card rounded-xl overflow-hidden shadow-sm",
        "transition-all duration-150 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
        className
      )}
    >
      <Link href={href} className="block">
        {/* Cover Image with Badge */}
        <div className="relative">
          <MangaCover
            src={manga.coverUrl}
            alt={manga.title}
            aspectRatio="3/4"
            objectFit="cover"
            className="transition-transform duration-150 group-hover:scale-105"
          />
          {/* Unread Badge */}
          {displayUnread > 0 && (
            <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm backdrop-blur-sm z-10">
              {displayUnread}
            </div>
          )}

          {/* Chapter Badge */}
          {chapterCount !== undefined && chapterCount > 0 && (
            <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full z-10">
              Ch. {chapterCount}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="p-3">
          <h3 className="font-semibold text-[13px] text-card-foreground truncate mb-1 leading-tight">
            {manga.title}
          </h3>
          {manga.genres && manga.genres.length > 0 && (
            <p className="text-[11px] text-muted-foreground truncate">
              {manga.genres.slice(0, 2).join(" • ")}
            </p>
          )}
          {lastReadText && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary/40 px-1.5 py-0.5 rounded mt-1.5 w-fit">
              <Clock className="w-3 h-3" />
              <span>{lastReadText}</span>
            </div>
          )}
        </div>
      </Link>

      {/* More menu button (top-left) */}
      <div ref={menuRef} className="absolute top-2 left-2 z-10">
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setMenuOpen((v) => !v)
          }}
          className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          aria-label="More options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {menuOpen && (
          <div className="absolute top-9 left-0 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
            {onRefresh && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setMenuOpen(false)
                  onRefresh(manga.id)
                }}
                disabled={refreshing}
                className="w-full px-3 py-2 text-left text-[13px] hover:bg-secondary/60 flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
                {refreshing ? 'Refreshing…' : 'Refresh Chapters'}
              </button>
            )}
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setMenuOpen(false)
                setConfirmOpen(true)
              }}
              className="w-full px-3 py-2 text-left text-[13px] text-destructive hover:bg-destructive/10 flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove from Library
            </button>
          </div>
        )}
      </div>

      {/* Confirm delete modal */}
      {confirmOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setConfirmOpen(false)
          }}
        >
          <div
            className="bg-card rounded-xl p-5 max-w-sm w-full shadow-2xl"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            <h3 className="text-lg font-bold text-card-foreground mb-2">Remove from Library?</h3>
            <p className="text-[13px] text-muted-foreground mb-4">
              <span className="font-semibold text-card-foreground">{manga.title}</span> and all its chapters will be removed from your library. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setConfirmOpen(false)
                }}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-[13px] font-medium hover:bg-secondary/80 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-[13px] font-medium hover:bg-destructive/90 disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
