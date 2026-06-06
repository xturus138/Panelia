import { collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '~/lib/firebase';

const downloadedChaptersCol = collection(db, 'downloadedChapters');

export async function deleteDownloadedChaptersByMangaId(mangaId: string): Promise<void> {
  const snap = await getDocs(query(downloadedChaptersCol, where('mangaId', '==', mangaId)));
  await Promise.all(snap.docs.map((d) => deleteDoc(doc(downloadedChaptersCol, d.id))));
}
