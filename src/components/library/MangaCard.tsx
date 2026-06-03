"use client"

import Link from "next/link"
import type { Manga } from "~/types"
import { cn } from "~/lib/utils"

interface MangaCardProps {
  manga: Manga
  className?: string
  chapterCount?: number
}

export function MangaCard({ manga, className, chapterCount }: MangaCardProps) {
  return (
    <Link
      href={`/manga/${manga.id}`}
      className={cn(
        "group block bg-card rounded-xl overflow-hidden shadow-sm",
        "transition-all duration-150 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
        className
      )}
    >
      {/* Cover Image with Badge */}
      <div className="relative aspect-[0.7] bg-muted overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={manga.coverUrl}
          alt={manga.title}
          className="w-full h-full object-cover transition-transform duration-150 group-hover:scale-105"
        />
        {/* Chapter Badge */}
        {chapterCount !== undefined && chapterCount > 0 && (
          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-1 rounded-full">
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
      </div>
    </Link>
  )
}