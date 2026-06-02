"use client";

import { use, useEffect, useState } from 'react';
import { mockSource } from '~/services/mock-source';
import { toggleInLibrary, isInLibrary } from '~/db/library';
import type { Manga, Chapter } from '~/types';
import Link from 'next/link';

export default function MangaDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [manga, setManga] = useState<Manga | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [inLib, setInLib] = useState(false);

  useEffect(() => {
    Promise.all([
      mockSource.getMangaDetails(id),
      mockSource.getChapters(id),
      isInLibrary(id)
    ]).then(([m, c, l]) => {
      setManga(m);
      setChapters(c);
      setInLib(l);
    });
  }, [id]);

  if (!manga) return <div className="p-4">Loading...</div>;

  const handleToggleLibrary = async () => {
    const isNowInLib = await toggleInLibrary(manga);
    setInLib(isNowInLib);
  };

  return (
    <div className="pb-20">
      <div className="relative h-64 w-full bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={manga.coverUrl} alt={manga.title} className="w-full h-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute bottom-4 left-4 flex gap-4">
           {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={manga.coverUrl} alt={manga.title} className="w-24 h-36 rounded shadow-lg object-cover" />
          <div className="flex flex-col justify-end">
            <h1 className="text-xl font-bold text-white">{manga.title}</h1>
            <p className="text-sm text-zinc-300">{manga.author}</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <button
          onClick={handleToggleLibrary}
          className="w-full py-2 mb-4 rounded-md font-semibold bg-primary text-primary-foreground"
        >
          {inLib ? 'In Library' : 'Add to Library'}
        </button>

        <p className="text-sm mb-6">{manga.description}</p>

        <h2 className="text-lg font-bold mb-3">{chapters.length} Chapters</h2>
        <div className="flex flex-col gap-2">
          {chapters.map(ch => (
            <Link
              key={ch.id}
              href={`/reader/${ch.id}?manga=${manga.id}`}
              className="p-3 bg-muted rounded-md flex justify-between items-center"
            >
              <span>Chapter {ch.chapterNumber}: {ch.title}</span>
              <span className="text-xs text-muted-foreground">{ch.releaseDate}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}