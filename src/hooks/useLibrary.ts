import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '~/db/db';

export function useLibrary() {
  const libraryEntries = useLiveQuery(() => db.libraryEntries.toArray());
  const mangaList = useLiveQuery(async () => {
    if (!libraryEntries) return [];
    const mangaIds = libraryEntries.map(e => e.mangaId);
    return db.manga.where('id').anyOf(mangaIds).toArray();
  }, [libraryEntries]);

  return { libraryEntries, mangaList };
}