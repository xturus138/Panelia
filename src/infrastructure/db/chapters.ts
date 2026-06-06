import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '~/lib/firebase';
import type { Chapter } from '~/domain/types';

const chapterCol = collection(db, 'chapters');

export async function getChapterById(id: string): Promise<Chapter | undefined> {
  const snap = await getDoc(doc(chapterCol, id));
  return snap.exists() ? (snap.data() as Chapter) : undefined;
}

export async function getChaptersByMangaId(mangaId: string): Promise<Chapter[]> {
  const snap = await getDocs(query(chapterCol, where('mangaId', '==', mangaId)));
  return snap.docs.map((d) => d.data() as Chapter);
}

export async function saveChapters(chapters: Chapter[]): Promise<void> {
  if (!chapters.length) return;
  await Promise.all(chapters.map((chapter) => setDoc(doc(chapterCol, chapter.id), chapter, { merge: true })));
}
