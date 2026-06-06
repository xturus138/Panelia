import { collection, doc, getDoc, setDoc, deleteDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '~/lib/firebase';
import type { Manga, Chapter, LibraryEntry } from '~/domain/types';
import { deleteDownloadedChaptersByMangaId } from './downloads';
import { deleteReadProgressByChapterIds } from './read-progress';

const libraryEntriesCol = collection(db, 'libraryEntries');
const mangaCol = collection(db, 'manga');
const chaptersCol = collection(db, 'chapters');

export async function toggleInLibrary(manga: Manga, chapters?: Chapter[]): Promise<boolean> {
  const exists = await isInLibrary(manga.id);

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

    const batch = writeBatch(db);
    batch.set(doc(mangaCol, manga.id), manga, { merge: true });
    batch.set(doc(libraryEntriesCol, manga.id), entry);
    if (chapters && chapters.length > 0) {
      chapters.forEach((ch) => {
        batch.set(doc(chaptersCol, ch.id), ch, { merge: true });
      });
    }
    await batch.commit();
    return true;
  }
}

export async function removeFromLibrary(mangaId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(libraryEntriesCol, mangaId));
  batch.delete(doc(mangaCol, mangaId));

  const chaptersSnap = await getDocs(query(chaptersCol, where('mangaId', '==', mangaId)));
  const chapterIds = chaptersSnap.docs.map((d) => {
    batch.delete(d.ref);
    return d.id;
  });

  await batch.commit();

  if (chapterIds.length > 0) {
    await deleteReadProgressByChapterIds(chapterIds);
  }
  await deleteDownloadedChaptersByMangaId(mangaId);
}

export async function isInLibrary(mangaId: string): Promise<boolean> {
  const snap = await getDoc(doc(libraryEntriesCol, mangaId));
  return snap.exists();
}
