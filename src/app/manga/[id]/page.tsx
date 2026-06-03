"use client"

import { use, useEffect, useState } from 'react'
import { mockSource } from '~/services/mock-source'
import { toggleInLibrary, isInLibrary } from '~/db/library'
import type { Manga, Chapter } from '~/types'
import Link from 'next/link'
import { ArrowLeft, Library, Check, ChevronRight } from 'lucide-react'

export default function MangaDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [manga, setManga] = useState<Manga | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [inLib, setInLib] = useState(false)

  useEffect(() => {
    Promise.all([
      mockSource.getMangaDetails(id),
      mockSource.getChapters(id),
      isInLibrary(id)
    ]).then(([m, c, l]) => {
      setManga(m)
      setChapters(c)
      setInLib(l)
    })
  }, [id])

  const handleToggleLibrary = async () => {
    if (!manga) return
    const isNowInLib = await toggleInLibrary(manga)
    setInLib(isNowInLib)
  }

  if (!manga) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="pb-24">
      {/* Hero Header */}
      <div className="relative h-64 w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={manga.coverUrl}
          alt={manga.title}
          className="w-full h-full object-cover opacity-40"
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
        <div className="absolute bottom-0 left-4 right-4 flex gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={manga.coverUrl}
            alt={manga.title}
            className="w-28 h-40 rounded-xl shadow-lg object-cover"
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
          {chapters.map(ch => (
            <Link
              key={ch.id}
              href={`/reader/${ch.id}?manga=${manga.id}`}
              className="bg-card rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[14px] text-card-foreground truncate">
                  Chapter {ch.chapterNumber}: {ch.title}
                </p>
                {ch.releaseDate && (
                  <p className="text-[12px] text-muted-foreground mt-1">{ch.releaseDate}</p>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 ml-2" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}