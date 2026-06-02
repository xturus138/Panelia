'use client';

import { useEffect, useState } from 'react';
import { extensionService } from '~/services/extensions';
import { sourceRegistry } from '~/services/sources';
import { MangaCard } from '~/components/library/MangaCard';
import type { Manga, Source } from '~/types';

export default function BrowsePage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [activeSource, setActiveSource] = useState<Source | null>(null);
  const [manga, setManga] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSources();
  }, []);

  useEffect(() => {
    if (activeSource) {
      loadManga();
    }
  }, [activeSource]);

  async function loadSources() {
    try {
      setLoading(true);
      const data = await extensionService.getSources();
      setSources(data);
      if (data.length > 0) {
        setActiveSource(data[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sources');
    } finally {
      setLoading(false);
    }
  }

  async function loadManga() {
    if (!activeSource) return;

    try {
      setLoading(true);
      const provider = sourceRegistry.get(activeSource.id);
      const data = await provider.getPopular(0);
      setManga(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load manga');
    } finally {
      setLoading(false);
    }
  }

  if (loading && sources.length === 0) {
    return <div className="p-4">Loading sources...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Browse</h1>

      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">Sources</h2>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {sources.map(source => (
            <button
              key={source.id}
              onClick={() => setActiveSource(source)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                activeSource?.id === source.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              {source.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-4">Loading manga...</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {manga.map(m => (
            <MangaCard key={m.id} manga={m} />
          ))}
        </div>
      )}
    </div>
  );
}
