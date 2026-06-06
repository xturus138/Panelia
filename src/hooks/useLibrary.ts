import { useMemo } from 'react';
import { useAuth } from '~/lib/auth-context';
import { useFirestoreCollection, useFirestoreDoc } from './useFirestoreQuery';
import type { LibraryEntry, Manga } from '~/types';

export function useLibrary() {
  const { uid } = useAuth();
  const libraryEntries = useFirestoreCollection<LibraryEntry>(uid, 'libraryEntries');
  const allManga = useFirestoreCollection<Manga>(uid, 'manga');

  const mangaList = useMemo(() => {
    if (!libraryEntries || !allManga) return undefined;
    const ids = new Set(libraryEntries.map((e) => e.mangaId));
    return allManga.filter((m) => ids.has(m.id));
  }, [libraryEntries, allManga]);

  return { libraryEntries, mangaList };
}

export function useManga(id: string | undefined) {
  const { uid } = useAuth();
  return useFirestoreDoc<Manga>(uid, 'manga', id);
}
