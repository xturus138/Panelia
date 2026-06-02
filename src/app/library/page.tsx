"use client";

import { useLibrary } from '~/hooks/useLibrary';
import { MangaCard } from '~/components/library/MangaCard';

export default function LibraryPage() {
  const { mangaList } = useLibrary();

  if (!mangaList) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Library</h1>
      {mangaList.length === 0 ? (
        <p className="text-muted-foreground">Your library is empty. Go to Browse to add manga.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {mangaList.map(manga => (
            <MangaCard key={manga.id} manga={manga} />
          ))}
        </div>
      )}
    </div>
  );
}