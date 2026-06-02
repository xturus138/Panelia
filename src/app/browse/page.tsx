"use client";

import { useEffect, useState } from 'react';
import { mockSource } from '~/services/mock-source';
import { MangaCard } from '~/components/library/MangaCard';
import type { Manga } from '~/types';

export default function BrowsePage() {
  const [popular, setPopular] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mockSource.getPopular().then(data => {
      setPopular(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Browse</h1>
      <h2 className="text-lg font-semibold mb-3">Popular (Mock Source)</h2>
      {loading ? (
        <p>Loading sources...</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {popular.map(manga => (
            <MangaCard key={manga.id} manga={manga} />
          ))}
        </div>
      )}
    </div>
  );
}