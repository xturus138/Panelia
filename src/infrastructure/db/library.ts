import { collection, doc, getDoc, setDoc, deleteDoc, getDocs, query, where, writeBatch } from './db-gateway';
import { db } from '~/lib/firebase';
import type { Manga, Chapter, LibraryEntry } from '~/domain/types';
import { deleteDownloadedChaptersByMangaId } from './downloads';
import { deleteReadProgressByChapterIds } from './read-progress';
import { userScopedCollection, userScopedDoc } from './user-scope';

export async function toggleInLibrary(uid: string, manga: Manga, chapters?: Chapter[]): Promise<boolean> {
  const exists = await isInLibrary(uid, manga.id);

  if (exists) {
    await removeFromLibrary(uid, manga.id);
    return false;
  } else {
    const entry: LibraryEntry = {
      mangaId: manga.id,
      categories: [],
      dateAdded: new Date().toISOString(),
      unreadCount: chapters ? chapters.length : 0
    };

    const batch = writeBatch(db);
    batch.set(userScopedDoc(uid, 'manga', manga.id), manga, { merge: true });
    batch.set(userScopedDoc(uid, 'libraryEntries', manga.id), entry);
    if (chapters && chapters.length > 0) {
      chapters.forEach((ch) => {
        batch.set(userScopedDoc(uid, 'chapters', ch.id), ch, { merge: true });
      });
    }
    await batch.commit();
    return true;
  }
}

export async function removeFromLibrary(uid: string, mangaId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(userScopedDoc(uid, 'libraryEntries', mangaId));
  batch.delete(userScopedDoc(uid, 'manga', mangaId));

  const chaptersCol = userScopedCollection(uid, 'chapters');
  const chaptersSnap = await getDocs(query(chaptersCol, where('mangaId', '==', mangaId)));
  const chapterIds = chaptersSnap.docs.map((d) => {
    batch.delete(d.ref);
    return d.id;
  });

  await batch.commit();

  if (chapterIds.length > 0) {
    await deleteReadProgressByChapterIds(uid, chapterIds);
  }
  await deleteDownloadedChaptersByMangaId(uid, mangaId);
}

export async function isInLibrary(uid: string, mangaId: string): Promise<boolean> {
  const snap = await getDoc(userScopedDoc(uid, 'libraryEntries', mangaId));
  return snap.exists();
}
