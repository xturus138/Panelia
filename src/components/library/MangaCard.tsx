import Link from 'next/link';
import type { Manga } from '~/types';

export function MangaCard({ manga }: { manga: Manga }) {
  return (
    <Link href={`/manga/${manga.id}`} className="block relative aspect-[2/3] overflow-hidden rounded-md group">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={manga.coverUrl} alt={manga.title} className="object-cover w-full h-full transition-transform group-hover:scale-105" />
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
        <span className="text-xs font-semibold text-white line-clamp-2">{manga.title}</span>
      </div>
    </Link>
  );
}