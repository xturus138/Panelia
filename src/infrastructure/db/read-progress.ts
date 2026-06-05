import { db } from '~/db/db';

export async function deleteReadProgressByChapterIds(chapterIds: string[]): Promise<void> {
  if (!chapterIds.length) return;
  await db.readProgress.where('chapterId').anyOf(chapterIds).delete();
}
