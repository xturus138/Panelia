import { collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '~/lib/firebase';

const readProgressCol = collection(db, 'readProgress');

export async function deleteReadProgressByChapterIds(chapterIds: string[]): Promise<void> {
  if (!chapterIds.length) return;
  const snap = await getDocs(query(readProgressCol, where('chapterId', 'in', chapterIds)));
  await Promise.all(snap.docs.map((d) => deleteDoc(doc(readProgressCol, d.id))));
}
