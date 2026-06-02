import { db } from './db';
import type { Manga, LibraryEntry } from '~/types';

export async function toggleInLibrary(manga: Manga) {
  const exists = await db.libraryEntries.get(manga.id);

  if (exists) {
    await db.libraryEntries.delete(manga.id);
    await db.manga.delete(manga.id);
    return false;
  } else {
    const entry: LibraryEntry = {
      mangaId: manga.id,
      categories: [],
      dateAdded: new Date().toISOString(),
      unreadCount: 0
    };

    await db.transaction('rw', db.manga, db.libraryEntries, async () => {
      await db.manga.put(manga);
      await db.libraryEntries.put(entry);
    });
    return true;
  }
}

export async function isInLibrary(mangaId: string) {
  return !!(await db.libraryEntries.get(mangaId));
}