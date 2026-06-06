import { collection, getDocs, query, where, deleteDoc, doc } from './db-gateway';
import { db } from '~/lib/firebase';
import { userScopedCollection, userScopedDoc } from './user-scope';

export async function deleteDownloadedChaptersByMangaId(uid: string, mangaId: string): Promise<void> {
  const col = userScopedCollection(uid, 'downloadedChapters');
  const snap = await getDocs(query(col, where('mangaId', '==', mangaId)));
  await Promise.all(snap.docs.map((d) => deleteDoc(doc(col, d.id))));
}
