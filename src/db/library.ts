import { db } from './db';
import type { Manga, Chapter, LibraryEntry } from '~/types';
import { deleteDownloadedChaptersByMangaId } from '~/infrastructure/db/downloads';
import { deleteReadProgressByChapterIds } from '~/infrastructure/db/read-progress';

export async function toggleInLibrary(manga: Manga, chapters?: Chapter[]) {
  const exists = await db.libraryEntries.get(manga.id);

  if (exists) {
    await removeFromLibrary(manga.id);
    return false;
  } else {
    const entry: LibraryEntry = {
      mangaId: manga.id,
      categories: [],
      dateAdded: new Date().toISOString(),
      unreadCount: chapters ? chapters.length : 0
    };

    await db.transaction('rw', db.manga, db.libraryEntries, db.chapters, async () => {
      await db.manga.put(manga);
      await db.libraryEntries.put(entry);
      if (chapters && chapters.length > 0) {
        await db.chapters.bulkPut(chapters);
      }
    });
    return true;
  }
}

/**
 * Remove a manga from the library and clean up its associated data.
 * Deletes: library entry, manga, chapters, read progress, downloaded chapters.
 */
export async function removeFromLibrary(mangaId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.manga, db.chapters, db.libraryEntries, db.readProgress, db.downloadedChapters],
    async () => {
      // 1. Delete the library entry
      await db.libraryEntries.delete(mangaId);

      // 2. Delete the manga record
      await db.manga.delete(mangaId);

      // 3. Delete all chapters for this manga
      const chapterIds = await db.chapters
        .where('mangaId')
        .equals(mangaId)
        .primaryKeys();
      if (chapterIds.length > 0) {
        await db.chapters.bulkDelete(chapterIds);
      }

      // 4. Delete all read progress entries for these chapters
      await deleteReadProgressByChapterIds(chapterIds);

      // 5. Delete any downloaded chapters for this manga
      await deleteDownloadedChaptersByMangaId(mangaId);
    }
  );
}

export async function isInLibrary(mangaId: string) {
  return !!(await db.libraryEntries.get(mangaId));
}