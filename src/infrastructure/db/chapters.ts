import { collection, doc, getDoc, getDocs, query, setDoc, where } from './db-gateway';
import { db } from '~/lib/firebase';
import type { Chapter } from '~/domain/types';
import { userScopedCollection, userScopedDoc } from './user-scope';

export async function getChapterById(uid: string, id: string): Promise<Chapter | undefined> {
  const snap = await getDoc(userScopedDoc(uid, 'chapters', id));
  return snap.exists() ? (snap.data() as Chapter) : undefined;
}

export async function getChaptersByMangaId(uid: string, mangaId: string): Promise<Chapter[]> {
  const col = userScopedCollection(uid, 'chapters');
  const snap = await getDocs(query(col, where('mangaId', '==', mangaId)));
  return snap.docs.map((d) => d.data() as Chapter);
}

export async function saveChapters(uid: string, chapters: Chapter[]): Promise<void> {
  if (!chapters.length) return;
  await Promise.all(chapters.map((chapter) => setDoc(userScopedDoc(uid, 'chapters', chapter.id), chapter, { merge: true })));
}
