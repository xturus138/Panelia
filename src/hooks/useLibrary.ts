import { useFirestoreCollection, useFirestoreDoc } from './useFirestoreQuery';
import type { LibraryEntry, Manga } from '~/types';
import { useMemo } from 'react';

export function useLibrary() {
  const libraryEntries = useFirestoreCollection<LibraryEntry>('libraryEntries');
  const allManga = useFirestoreCollection<Manga>('manga');

  const mangaList = useMemo(() => {
    if (!libraryEntries || !allManga) return undefined;
    const ids = new Set(libraryEntries.map((e) => e.mangaId));
    return allManga.filter((m) => ids.has(m.id));
  }, [libraryEntries, allManga]);

  return { libraryEntries, mangaList };
}

export function useManga(id: string | undefined) {
  return useFirestoreDoc<Manga>('manga', id);
}
