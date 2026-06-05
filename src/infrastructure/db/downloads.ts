import { db } from '~/db/db';

export async function deleteDownloadedChaptersByMangaId(mangaId: string): Promise<void> {
  const ids = await db.downloadedChapters.where('mangaId').equals(mangaId).primaryKeys();
  if (ids.length > 0) {
    await db.downloadedChapters.bulkDelete(ids);
  }
}
