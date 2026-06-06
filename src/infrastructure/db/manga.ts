import { collection, doc, getDoc, getDocs, query, setDoc, deleteDoc, where } from 'firebase/firestore';
import { db } from '~/lib/firebase';
import type { Manga } from '~/domain/types';

const mangaCol = collection(db, 'manga');

export async function getMangaById(id: string): Promise<Manga | undefined> {
  const snap = await getDoc(doc(mangaCol, id));
  return snap.exists() ? (snap.data() as Manga) : undefined;
}

export async function getAllManga(): Promise<Manga[]> {
  const snap = await getDocs(mangaCol);
  return snap.docs.map((d) => d.data() as Manga);
}

export async function saveManga(manga: Manga): Promise<void> {
  await setDoc(doc(mangaCol, manga.id), manga, { merge: true });
}

export async function deleteManga(id: string): Promise<void> {
  await deleteDoc(doc(mangaCol, id));
}

export async function getMangaBySourceId(sourceId: string): Promise<Manga[]> {
  const snap = await getDocs(query(mangaCol, where('sourceId', '==', sourceId)));
  return snap.docs.map((d) => d.data() as Manga);
}
