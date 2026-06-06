import { collection, getDocs, query, where, deleteDoc, doc } from './db-gateway';
import { db } from '~/lib/firebase';
import { userScopedCollection, userScopedDoc } from './user-scope';

/** Firestore 'in' queries support at most 10 elements. Chunk into batches. */
async function deleteByChunkedIn(uid: string, chapterIds: string[]): Promise<void> {
  const BATCH_SIZE = 10;
  const col = userScopedCollection(uid, 'readProgress');
  for (let i = 0; i < chapterIds.length; i += BATCH_SIZE) {
    const batch = chapterIds.slice(i, i + BATCH_SIZE);
    const snap = await getDocs(query(col, where('chapterId', 'in', batch)));
    await Promise.all(snap.docs.map((d) => deleteDoc(doc(col, d.id))));
  }
}

export async function deleteReadProgressByChapterIds(uid: string, chapterIds: string[]): Promise<void> {
  if (!chapterIds.length) return;
  await deleteByChunkedIn(uid, chapterIds);
}
