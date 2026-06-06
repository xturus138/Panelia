import { collection, doc, getDoc, getDocs, query, setDoc, deleteDoc, where } from './db-gateway';
import { db } from '~/lib/firebase';
import type { Manga } from '~/domain/types';
import { userScopedCollection, userScopedDoc } from './user-scope';

export async function getMangaById(uid: string, id: string): Promise<Manga | undefined> {
  const snap = await getDoc(userScopedDoc(uid, 'manga', id));
  return snap.exists() ? (snap.data() as Manga) : undefined;
}

export async function getAllManga(uid: string): Promise<Manga[]> {
  const snap = await getDocs(userScopedCollection(uid, 'manga'));
  return snap.docs.map((d) => d.data() as Manga);
}

export async function saveManga(uid: string, manga: Manga): Promise<void> {
  await setDoc(userScopedDoc(uid, 'manga', manga.id), manga, { merge: true });
}

export async function deleteManga(uid: string, id: string): Promise<void> {
  await deleteDoc(userScopedDoc(uid, 'manga', id));
}

export async function getMangaBySourceId(uid: string, sourceId: string): Promise<Manga[]> {
  const col = userScopedCollection(uid, 'manga');
  const snap = await getDocs(query(col, where('sourceId', '==', sourceId)));
  return snap.docs.map((d) => d.data() as Manga);
}
